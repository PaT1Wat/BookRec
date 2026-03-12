import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type Book, type BookType, type Genre } from "@/data/books";

interface BooksContextType {
  books: Book[];
  loading: boolean;
  addBook: (book: Omit<Book, "id">) => Promise<void>;
  updateBook: (id: string, book: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  searchBooks: (query: string, filters?: { type?: BookType; genres?: Genre[] }) => Book[];
  refetch: () => Promise<void>;
}

const BooksContext = createContext<BooksContextType | null>(null);

function mapRow(row: any): Book {
  return {
    id: row.id,
    title: row.title,
    titleEn: row.title_en || undefined,
    author: row.author,
    publisher: row.publisher,
    type: row.type as BookType,
    genres: (row.genres || []) as Genre[],
    tags: row.tags || [],
    description: row.description,
    coverUrl: row.cover_url,
    price: Number(row.price),
    rating: Number(row.rating),
    reviewCount: row.review_count,
    isNew: row.is_new,
    isPopular: row.is_popular,
  };
}

function toRow(book: Partial<Book>) {
  const row: any = {};
  if (book.title !== undefined) row.title = book.title;
  if (book.titleEn !== undefined) row.title_en = book.titleEn || null;
  if (book.author !== undefined) row.author = book.author;
  if (book.publisher !== undefined) row.publisher = book.publisher;
  if (book.type !== undefined) row.type = book.type;
  if (book.genres !== undefined) row.genres = book.genres;
  if (book.tags !== undefined) row.tags = book.tags;
  if (book.description !== undefined) row.description = book.description;
  if (book.coverUrl !== undefined) row.cover_url = book.coverUrl;
  if (book.price !== undefined) row.price = book.price;
  if (book.rating !== undefined) row.rating = book.rating;
  if (book.reviewCount !== undefined) row.review_count = book.reviewCount;
  if (book.isNew !== undefined) row.is_new = book.isNew;
  if (book.isPopular !== undefined) row.is_popular = book.isPopular;
  return row;
}

export function BooksProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBooks = useCallback(async () => {
    const { data, error } = await supabase.from("books").select("*").order("created_at", { ascending: false });
    if (!error && data) setBooks(data.map(mapRow));
    setLoading(false);
  }, []);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  const addBook = useCallback(async (book: Omit<Book, "id">) => {
    const { error } = await supabase.from("books").insert(toRow(book));
    if (error) throw error;
    await fetchBooks();
  }, [fetchBooks]);

  const updateBook = useCallback(async (id: string, data: Partial<Book>) => {
    const { error } = await supabase.from("books").update(toRow(data)).eq("id", id);
    if (error) throw error;
    await fetchBooks();
  }, [fetchBooks]);

  const deleteBook = useCallback(async (id: string) => {
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) throw error;
    await fetchBooks();
  }, [fetchBooks]);

  const searchBooks = useCallback(
    (query: string, filters?: { type?: BookType; genres?: Genre[] }) => {
      let result = books;
      if (query) {
        const q = query.toLowerCase();
        result = result.filter(
          b =>
            b.title.toLowerCase().includes(q) ||
            b.titleEn?.toLowerCase().includes(q) ||
            b.author.toLowerCase().includes(q) ||
            b.tags.some(t => t.includes(q)) ||
            b.genres.some(g => g.includes(q)) ||
            b.description.toLowerCase().includes(q)
        );
      }
      if (filters?.type) result = result.filter(b => b.type === filters.type);
      if (filters?.genres?.length)
        result = result.filter(b => filters.genres!.some(g => b.genres.includes(g)));
      return result;
    },
    [books]
  );

  return (
    <BooksContext.Provider value={{ books, loading, addBook, updateBook, deleteBook, searchBooks, refetch: fetchBooks }}>
      {children}
    </BooksContext.Provider>
  );
}

export function useBooks() {
  const ctx = useContext(BooksContext);
  if (!ctx) throw new Error("useBooks must be used within BooksProvider");
  return ctx;
}
