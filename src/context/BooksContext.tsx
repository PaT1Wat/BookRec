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
  rawPayload?: any;
  lastError?: any;
  addBook: (book: FormData) => Promise<void>;
  updateBook: (id: string, book: FormData) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  patchBook: (
    id: string,
    patch: Partial<{ rating: number; reviewCount: number }>
  ) => void;
  refetch: () => Promise<void>;
}

const BooksContext = createContext<BooksContextType | null>(null);

/* =======================
   ✅ type slug -> type_id
======================= */
const TYPE_ID_MAP: Record<string, number> = {
  manga: 1,
  novel: 2,
  "light-novel": 3,
};

/* =======================
   ✅ type_id -> type slug
======================= */
const TYPE_SLUG_MAP: Record<number, string> = {
  1: "manga",
  2: "novel",
  3: "light-novel",
};

/* =======================
   ✅ Map DB → UI
======================= */
function mapRow(row: any): Book {
  // ถ้ามี join book_type ให้ใช้ slug จาก relation ก่อน
  // ถ้าไม่มี ค่อย fallback จาก type_id
  const resolvedType =
    row.book_type?.slug ??
    (typeof row.type_id === "number" ? TYPE_SLUG_MAP[row.type_id] : undefined) ??
    "manga";

  const resolvedTags = Array.isArray(row.bookTag)
    ? row.bookTag
        .map((bt: any) => bt.tag?.tagName)
        .filter(Boolean)
    : [];

  return {
    // ✅ id หลักของ frontend ให้ตรงกับ bookID เสมอ
    id: String(row.bookID ?? ""),
    // ✅ เก็บ bookID แยกไว้ด้วยสำหรับ debug / recommendation mapping
    bookID: row.bookID ?? null,

    title: row.title ?? "",
    titleEn: row.titleEn ?? "",
    description: row.description ?? "",
    coverUrl: row.coverImage ?? "",
    publishDate: row.publishDate ?? "",
    slug: row.slug ?? "",

    authorName: row.author?.authorName ?? "",
    author: row.author?.authorName ?? "",

    publisher: row.publisher?.publisherName ?? "",
    publisherName: row.publisher?.publisherName ?? "",

    // ✅ ต้องเป็น slug ไม่ใช่ "1" "2" "3"
    type: resolvedType,

    tags: resolvedTags,
    genres: resolvedTags,

    isNew: row.is_new ?? false,
    isPopular: row.is_popular ?? false,
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    price: Number(row.price ?? 0),
  } as Book;
}

/* =======================
   🔥 FIND OR CREATE AUTHOR
======================= */
const findOrCreateAuthor = async (
  authorName: string
): Promise<number | null> => {
  const name = authorName.trim();
  if (!name) return null;

  const { data: existing, error: findError } = (await supabase
    .from("author" as any)
    .select("authorID")
    .ilike("authorName", name)
    .maybeSingle()) as any;

  if (findError) throw findError;
  if (existing) return existing.authorID;

  const { data: newAuthor, error: insertError } = (await supabase
    .from("author" as any)
    .insert({ authorName: name })
    .select("authorID")
    .single()) as any;

  if (insertError) throw insertError;
  return newAuthor.authorID;
};

/* =======================
   🔥 FIND OR CREATE PUBLISHER
======================= */
const findOrCreatePublisher = async (
  publisherName: string
): Promise<number | null> => {
  const name = publisherName.trim();
  if (!name) return null;

  const { data: existingList, error: findError } = (await supabase
    .from("publisher" as any)
    .select("publisherID")
    .ilike("publisherName", name)
    .limit(1)) as any;

  if (findError) throw findError;

  if (existingList && existingList.length > 0) {
    return existingList[0].publisherID;
  }

  const { data: newPub, error: insertError } = (await supabase
    .from("publisher" as any)
    .insert({
      publisherName: name,
      website: null,
    })
    .select("publisherID")
    .single()) as any;

  if (insertError) throw insertError;

  return newPub.publisherID;
};

/* =======================
   🔥 INSERT TAG RELATION
======================= */
const insertTags = async (bookID: number, tags: string[]) => {
  // กัน tag ซ้ำ เช่น ["โรแมนติก", "โรแมนติก"]
  const uniqueTags = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];

  for (const tagName of uniqueTags) {
    let { data: tag } = (await supabase
      .from("tag" as any)
      .select("tagID")
      .eq("tagName", tagName)
      .maybeSingle()) as any;

    if (!tag) {
      const { data: newTag } = (await supabase
        .from("tag" as any)
        .insert({ tagName })
        .select("tagID")
        .single()) as any;
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
  const [rawPayload, setRawPayload] = useState<any>(null);
  const [lastError, setLastError] = useState<any>(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);

    const { data, error } = (await supabase
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
        type_id,

        book_type!fk_book_type (
          id,
          name,
          slug
        ),

        author!books_authorID_fkey (
          authorID,
          authorName
        ),

        publisher!book_publisherID_fkey (
          publisherID,
          publisherName
        ),

        bookTag (
          tag:tagID (
            tagID,
            tagName
          )
        )
      `
      )
      .order("bookID", { ascending: false })) as any;

    console.debug("RAW BOOK PAYLOAD:", data);
    console.log("BOOK DATA:", data);
    console.log("BOOK ERROR:", error);

    setRawPayload(data ?? null);
    setLastError(error ?? null);

    if (error) {
      console.error("Fetch error:", error);
      setBooks([]);
    } else if (data) {
      try {
        setBooks(data.map(mapRow));
      } catch (e) {
        console.error("Mapping error:", e, data);
        setBooks([]);
      }
    }

    setLoading(false);
  }, []);

  const patchBook = useCallback(
    (id: string, patch: Partial<{ rating: number; reviewCount: number }>) => {
      console.debug("patchBook called", { id, patch });

      setBooks((prev) => {
        const next = prev.map((b) =>
          b.id === String(id)
            ? {
                ...b,
                ...(patch.rating !== undefined ? { rating: patch.rating } : {}),
                ...(patch.reviewCount !== undefined
                  ? { reviewCount: patch.reviewCount }
                  : {}),
              }
            : b
        );

        console.debug(
          "books after patch (sample)",
          next.find((b) => b.id === String(id))
        );
        return next;
      });
    },
    []
  );

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    try {
      const channel = supabase
        .channel("realtime:books_reviews")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "review" },
          () => {
            console.debug("Realtime: review changed, refetching books");
            fetchBooks();
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "books" },
          () => {
            console.debug("Realtime: books changed, refetching books");
            fetchBooks();
          }
        )
        .subscribe();

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.debug("Failed to remove realtime channel", e);
        }
      };
    } catch (e) {
      console.debug("Realtime not available", e);
      return;
    }
  }, [fetchBooks]);

  /* =======================
     ➕ Add
  ======================= */
  const addBook = useCallback(
    async (book: FormData) => {
      const authorID = book.authorName
        ? await findOrCreateAuthor(book.authorName)
        : null;

      const publisherID = book.publisherName
        ? await findOrCreatePublisher(book.publisherName)
        : null;

      const { data, error } = (await supabase
        .from("books" as any)
        .insert({
          title: book.title,
          titleEn: book.titleEn ?? null,
          description: book.description ?? "",
          coverImage: book.coverUrl ?? "",
          publishDate: book.publishDate ?? null,
          slug: book.slug ?? null,
          authorID,
          publisherID,
          type_id: book.type ? TYPE_ID_MAP[book.type] ?? null : null,
          is_new: book.isNew ?? false,
          is_popular: book.isPopular ?? false,
          rating: book.rating ?? 0,
          review_count: book.reviewCount ?? 0,
          price: book.price ?? 0,
        })
        .select("bookID")
        .single()) as any;

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

      const authorID = book.authorName
        ? await findOrCreateAuthor(book.authorName)
        : null;

      const publisherID = book.publisherName
        ? await findOrCreatePublisher(book.publisherName)
        : null;

      const { error } = (await supabase
        .from("books" as any)
        .update({
          title: book.title,
          titleEn: book.titleEn ?? null,
          description: book.description ?? "",
          coverImage: book.coverUrl ?? "",
          publishDate: book.publishDate ?? null,
          slug: book.slug ?? null,
          authorID,
          publisherID,
          type_id: book.type ? TYPE_ID_MAP[book.type] ?? null : null,
          is_new: book.isNew ?? false,
          is_popular: book.isPopular ?? false,
          rating: book.rating ?? 0,
          review_count: book.reviewCount ?? 0,
          price: book.price ?? 0,
        })
        .eq("bookID", bookID)) as any;

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

      const { error } = (await supabase
        .from("books" as any)
        .delete()
        .eq("bookID", bookID)) as any;

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
      value={{
        books,
        loading,
        rawPayload,
        lastError,
        addBook,
        updateBook,
        deleteBook,
        patchBook,
        refetch: fetchBooks,
      }}
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