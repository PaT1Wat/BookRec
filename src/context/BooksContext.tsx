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
  isHidden?: boolean;
  rating?: number;
  reviewCount?: number;
  price?: number;
};

interface BooksContextType {
  books: Book[];        // ✅ เฉพาะหนังสือที่ไม่ได้ซ่อน (สำหรับหน้า user ทั่วไป)
  allBooks: Book[];     // ✅ หนังสือทั้งหมด รวมที่ซ่อน (สำหรับ Admin)
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
  const resolvedType =
    row.book_type?.slug ??
    (typeof row.type_id === "number" ? TYPE_SLUG_MAP[row.type_id] : undefined) ??
    "manga";

  const resolvedTags = Array.isArray(row.bookTag)
    ? row.bookTag
        .map((bt: any) => bt.tag?.tagName ?? bt.tagName)
        .filter(Boolean)
    : [];

  return {
    id: String(row.bookID ?? ""),
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
    type: resolvedType,
    tags: resolvedTags,
    genres: resolvedTags,
    isNew: row.is_new ?? false,
    isPopular: row.is_popular ?? false,
    isHidden: row.is_hidden ?? false,
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
    .insert({ publisherName: name, website: null })
    .select("publisherID")
    .single()) as any;

  if (insertError) throw insertError;
  return newPub.publisherID;
};

/* =======================
   🔥 INSERT TAG RELATION
======================= */
const insertTags = async (bookID: number, tags: string[]) => {
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
  const [books, setBooks] = useState<Book[]>([]);         // ✅ visible only
  const [allBooks, setAllBooks] = useState<Book[]>([]);   // ✅ all including hidden
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
        is_hidden,
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

    setRawPayload(data ?? null);
    setLastError(error ?? null);

    if (error) {
      console.error("Fetch error:", error);
      setBooks([]);
      setAllBooks([]);
    } else if (data) {
      try {
        const { data: stats, error: statsError } = (await supabase
          .from("book_interaction_stats" as any)
          .select("*")) as any;

        if (statsError) {
          console.error("Stats fetch error:", statsError);
        }

        const statsMap = new Map(
          (stats ?? []).map((s: any) => [String(s.bookID), s])
        );

        const booksWithStats = data.map((row: any) => {
          const book = mapRow(row);
          const stat: any = statsMap.get(String(book.bookID));

          return {
            ...book,
            rating: Number(book.rating ?? 0),
            reviewCount: Number(stat?.reviewCount ?? book.reviewCount ?? 0),
            favoriteCount: Number(stat?.favoriteCount ?? 0),
            reviewActionCount: Number(stat?.reviewActionCount ?? 0),
            viewCount: Number(stat?.viewCount ?? 0),
            interactionCount: Number(stat?.interactionCount ?? 0), // ✅ เพิ่ม interactionCount รวมทุก action
            interactionScore: Number(stat?.interactionScore ?? 0), // ✅ เพิ่ม interactionScore ที่คำนวณจาก interaction ต่างๆ
            clickScore: Number(stat?.clickScore ?? 0), // ✅ เพิ่ม clickScore ที่คำนวณจากการคลิก
            negativeReviewCount: Number(stat?.negativeReviewCount ?? 0), // ✅ เพิ่ม negativeReviewCount สำหรับนับรีวิวที่ให้คะแนนต่ำ (1-2 ดาว)
          };
        });

        booksWithStats.sort((a: any, b: any) => {
          const dateA = new Date((a as any).updated_at ?? 0).getTime();
          const dateB = new Date((b as any).updated_at ?? 0).getTime();
          return dateB - dateA;
        });

        // ✅ allBooks = ทั้งหมด (Admin ใช้)
        setAllBooks(booksWithStats);

        // ✅ books = กรองเฉพาะที่ไม่ซ่อน (หน้า user ทั่วไปใช้)
        setBooks(booksWithStats.filter((b: Book) => !b.isHidden));

      } catch (e) {
        console.error("Mapping error:", e, data);
        setBooks([]);
        setAllBooks([]);
      }
    }

    setLoading(false);
  }, []);

  const patchBook = useCallback(
    (id: string, patch: Partial<{ rating: number; reviewCount: number }>) => {
      const applyPatch = (prev: Book[]) =>
        prev.map((b) =>
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

      setBooks(applyPatch);
      setAllBooks(applyPatch);
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
          () => fetchBooks()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "books" },
          () => fetchBooks()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "interaction" },
          () => fetchBooks()
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
          is_hidden: book.isHidden ?? false,
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
          is_hidden: book.isHidden ?? false,
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
        allBooks,
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