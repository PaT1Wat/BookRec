import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Heart } from "lucide-react";

import { useBooks } from "@/context/BooksContext";
import { useFavorites } from "@/lib/favorites";
import BookCard from "@/components/BookCard";

const FavoritesPage = () => {
  const { books = [], loading: booksLoading } = useBooks() as any;
  const { favorites = [], loading: favoritesLoading } = useFavorites() as any;

  const loading = booksLoading || favoritesLoading;

  const favoriteBooks = useMemo(() => {
    const bookMap = new Map(
      books.map((book: any) => [String(book.bookID ?? book.id), book])
    );

    const uniqueIds = [...new Set(favorites.map((id: any) => String(id)))];

    return uniqueIds.map((id) => bookMap.get(id)).filter(Boolean);
  }, [books, favorites]);

  if (loading) {
    return (
      <div className="container py-8">
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
          <Heart className="h-5 w-5 text-primary-foreground" />
        </div>

        <div>
          <h1 className="text-2xl font-bold">ชั้นหนังสือของฉัน</h1>
          <p className="text-sm text-muted-foreground">
            หนังสือที่คุณบันทึกไว้ • {favoriteBooks.length} เล่ม
          </p>
        </div>
      </div>

      {favoriteBooks.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {favoriteBooks.map((book: any) => (
            <BookCard key={String(book.bookID ?? book.id)} book={book} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-20 text-center">
          <BookOpen className="mb-4 h-16 w-16 text-muted-foreground/30" />

          <p className="text-lg font-medium text-muted-foreground">
            ยังไม่มีหนังสือในชั้น
          </p>

          <Link
            to="/"
            className="mt-6 rounded-xl gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            ไปค้นหาหนังสือ
          </Link>
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;