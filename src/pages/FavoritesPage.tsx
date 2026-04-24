import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Heart } from "lucide-react";

import { useBooks } from "@/context/BooksContext";
import { useFavorites } from "@/lib/favorites";
import BookCard from "@/components/BookCard";

const FavoritesPage = () => {
  const { books = [], loading } = useBooks() as any;
  const { favorites } = useFavorites();

  const favoriteBooks = useMemo(() => {
    const bookMap = new Map(
      books.map((b: any) => [String(b.id ?? b.bookID), b])
    );

    return favorites
      .map((id: string | number) => bookMap.get(String(id)))
      .filter(Boolean);
  }, [books, favorites]);

  if (loading) {
    return (
      <div className="container py-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
            <Heart className="h-5 w-5 text-primary-foreground" />
          </div>

          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">
              ชั้นหนังสือของฉัน
            </h1>
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[320px] rounded-2xl border border-border bg-card animate-pulse"
            />
          ))}
        </div>
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
          <h1 className="text-2xl font-bold font-display text-foreground">
            ชั้นหนังสือของฉัน
          </h1>
          <p className="text-sm text-muted-foreground">
            หนังสือที่คุณบันทึกไว้ • {favoriteBooks.length} เล่ม
          </p>
        </div>
      </div>

      {favoriteBooks.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {favoriteBooks.map((book: any) => (
            <BookCard key={String(book.id ?? book.bookID)} book={book} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-20 text-center">
          <BookOpen className="mb-4 h-16 w-16 text-muted-foreground/30" />

          <p className="text-lg font-medium text-muted-foreground">
            ยังไม่มีหนังสือในชั้น
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            กดไอคอน ❤️ บนหนังสือเพื่อเพิ่มในชั้นหนังสือ
          </p>

          <Link
            to="/"
            className="mt-6 rounded-xl gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            ไปค้นหาหนังสือ
          </Link>
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;