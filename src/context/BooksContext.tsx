import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { books as initialBooks, type Book, type BookType, type Genre } from "@/data/books";

interface BooksContextType {
  books: Book[];
  addBook: (book: Omit<Book, "id">) => void;
  updateBook: (id: string, book: Partial<Book>) => void;
  deleteBook: (id: string) => void;
  searchBooks: (query: string, filters?: { type?: BookType; genres?: Genre[] }) => Book[];
}

const BooksContext = createContext<BooksContextType | null>(null);

export function BooksProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>(initialBooks);

  const addBook = useCallback((book: Omit<Book, "id">) => {
    const id = String(Date.now());
    setBooks(prev => [...prev, { ...book, id }]);
  }, []);

  const updateBook = useCallback((id: string, data: Partial<Book>) => {
    setBooks(prev => prev.map(b => (b.id === id ? { ...b, ...data } : b)));
  }, []);

  const deleteBook = useCallback((id: string) => {
    setBooks(prev => prev.filter(b => b.id !== id));
  }, []);

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
    <BooksContext.Provider value={{ books, addBook, updateBook, deleteBook, searchBooks }}>
      {children}
    </BooksContext.Provider>
  );
}

export function useBooks() {
  const ctx = useContext(BooksContext);
  if (!ctx) throw new Error("useBooks must be used within BooksProvider");
  return ctx;
}
