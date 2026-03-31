import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { type Book } from "@/data/books";

export type FormData = {
  title: string;
  titleEn?: string;
  description?: string;
  coverUrl?: string;
  publishDate?: string;
  slug?: string;
  authorName?: string;
  publisherName?: string;
  type?: string;
  tags?: string[];
  isNew?: boolean;
  isPopular?: boolean;
  rating?: number;
  reviewCount?: number;
  price?: number;
};

interface BooksContextType {
  books: Book[];
  loading: boolean;
  addBook: (book: FormData) => Promise<void>;
  updateBook: (id: string, book: FormData) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const BooksContext = createContext<BooksContextType | null>(null);

/* =======================
   ✅ Map DB → UI
======================= */
function mapRow(row: any): Book {
  return {
    id: String(row.bookID),
    title: row.title ?? "",
    titleEn: row.titleEn ?? "",
    description: row.description ?? "",
    coverUrl: row.coverImage ?? "",
    publishDate: row.publishDate ?? "",
    slug: row.slug ?? "",

    // ✅ ดึงจาก join author table
    authorName: row.author?.authorName ?? "",
    author: row.author?.authorName ?? "",

    publisher: row.publisher?.publisherName ?? "",
    publisherName: row.publisher?.publisherName ?? "",

    type: row.type?.slug ?? "manga",

    tags: row.bookTag?.map((bt: any) => bt.tag?.tagName).filter(Boolean) ?? [],
    genres: row.bookTag?.map((bt: any) => bt.tag?.tagName).filter(Boolean) ?? [],

    isNew: row.is_new ?? false,
    isPopular: row.is_popular ?? false,
    rating: row.rating ?? 0,
    reviewCount: row.review_count ?? 0,
    price: row.price ?? 0,
  };
}

/* =======================
   🔥 FIND OR CREATE AUTHOR
======================= */
const findOrCreateAuthor = async (authorName: string): Promise<number | null> => {
  if (!authorName.trim()) return null;

  const { data: existing } = await supabase
    .from("author" as any)
    .select("authorID")
    .eq("authorName", authorName.trim())
    .maybeSingle() as any;

  if (existing) return (existing as any).authorID;

  const { data: newAuthor, error } = await supabase
    .from("author" as any)
    .insert({ authorName: authorName.trim() })
    .select("authorID")
    .single() as any;

  if (error) throw error;
  return (newAuthor as any).authorID;
};

/* =======================
   🔥 FIND OR CREATE PUBLISHER
======================= */
const findOrCreatePublisher = async (publisherName: string): Promise<number | null> => {
  if (!publisherName.trim()) return null;

  const { data: existing } = await supabase
    .from("publisher" as any)
    .select("publisherID")
    .eq("publisherName", publisherName.trim())
    .maybeSingle() as any;

  if (existing) return (existing as any).publisherID;

  const { data: newPub, error } = await supabase
    .from("publisher" as any)
    .insert({ publisherName: publisherName.trim() })
    .select("publisherID")
    .single() as any;

  if (error) throw error;
  return (newPub as any).publisherID;
};

/* =======================
   🔥 INSERT TAG RELATION
======================= */
const insertTags = async (bookID: number, tags: string[]) => {
  for (const tagName of tags) {
    let { data: tag } = await supabase
      .from("tag" as any)
      .select("tagID")
      .eq("tagName", tagName)
      .maybeSingle() as any;

    if (!tag) {
      const { data: newTag } = await supabase
        .from("tag" as any)
        .insert({ tagName })
        .select("tagID")
        .single() as any;
      tag = newTag as any;
    }

    await supabase.from("bookTag" as any).insert({
      bookID,
      tagID: (tag as any).tagID,
    });
  }
};

const updateTags = async (bookID: number, tags: string[]) => {
  await supabase.from("bookTag" as any).delete().eq("bookID", bookID);
  await insertTags(bookID, tags);
};

/* =======================
   ✅ Provider
======================= */
export function BooksProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBooks = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("books")
      .select(
        `
        bookID,
        title,
        titleEn,
        description,
        coverImage,
        publishDate,
        slug,
        is_new,
        is_popular,
        rating,
        review_count,
        price,

        author:authorID (
          authorID,
          authorName
        ),

        publisher:publisherID (
          publisherID,
          publisherName
        ),

        type:type_id (
          id,
          name,
          slug
        ),

        bookTag (
          tag:tagID (
            tagID,
            tagName
          )
        )
      ` as any
      )
      .order("bookID", { ascending: false });

    if (error) {
      console.error("Fetch error:", error);
    } else {
      setBooks((data as any[]).map(mapRow));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  /* =======================
     ➕ Add
  ======================= */
  const addBook = useCallback(
    async (book: FormData) => {
      // ✅ แปลง authorName → authorID
      const authorID = book.authorName
        ? await findOrCreateAuthor(book.authorName)
        : null;

      const publisherID = book.publisherName
        ? await findOrCreatePublisher(book.publisherName)
        : null;

      const { data, error } = await supabase
        .from("books" as any)
        .insert({
          title: book.title,
          titleEn: book.titleEn,
          description: book.description,
          coverImage: book.coverUrl,
          publishDate: book.publishDate,
          slug: book.slug,
          authorID,        // ✅ ส่ง ID
          publisherID,
          is_new: book.isNew ?? false,
          is_popular: book.isPopular ?? false,
          rating: book.rating ?? 0,
          review_count: book.reviewCount ?? 0,
          price: book.price ?? 0,
        })
        .select("bookID")
        .single() as any;

      if (error) {
        console.error("Insert error:", error);
        throw error;
      }

      const bookID = (data as any).bookID;
      if (book.tags?.length) await insertTags(bookID, book.tags);

      await fetchBooks();
    },
    [fetchBooks]
  );

  /* =======================
     ✏️ Update
  ======================= */
  const updateBook = useCallback(
    async (id: string, book: FormData) => {
      const bookID = Number(id);

      // ✅ แปลง authorName → authorID
      const authorID = book.authorName
        ? await findOrCreateAuthor(book.authorName)
        : null;

      const publisherID = book.publisherName
        ? await findOrCreatePublisher(book.publisherName)
        : null;

      const { error } = await supabase
        .from("books" as any)
        .update({
          title: book.title,
          titleEn: book.titleEn,
          description: book.description,
          coverImage: book.coverUrl,
          publishDate: book.publishDate,
          slug: book.slug,
          authorID,        // ✅ ส่ง ID
          publisherID,
          is_new: book.isNew ?? false,
          is_popular: book.isPopular ?? false,
          rating: book.rating ?? 0,
          review_count: book.reviewCount ?? 0,
          price: book.price ?? 0,
        })
        .eq("bookID", bookID);

      if (error) {
        console.error("Update error:", error);
        throw error;
      }

      if (book.tags) await updateTags(bookID, book.tags);

      await fetchBooks();
    },
    [fetchBooks]
  );

  /* =======================
     🗑️ Delete
  ======================= */
  const deleteBook = useCallback(
    async (id: string) => {
      const bookID = Number(id);
      await supabase.from("bookTag" as any).delete().eq("bookID", bookID);

      const { error } = await supabase
        .from("books" as any)
        .delete()
        .eq("bookID", bookID);

      if (error) {
        console.error("Delete error:", error);
        throw error;
      }

      await fetchBooks();
    },
    [fetchBooks]
  );

  return (
    <BooksContext.Provider
      value={{ books, loading, addBook, updateBook, deleteBook, refetch: fetchBooks }}
    >
      {children}
    </BooksContext.Provider>
  );
}

export function useBooks() {
  const ctx = useContext(BooksContext);
  if (!ctx) throw new Error("useBooks must be used within BooksProvider");
  return ctx;
}