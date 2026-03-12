import { useBooks } from "@/context/BooksContext";
import { useFavorites } from "@/lib/favorites";
import BookCard from "@/components/BookCard";
import { BookOpen, Heart } from "lucide-react";
import { Link } from "react-router-dom";

const FavoritesPage = () => {
  const { books } = useBooks();
  const { favorites } = useFavorites();
  const favoriteBooks = books.filter(b => favorites.includes(b.id));

  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
          <Heart className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">ชั้นหนังสือของฉัน</h1>
          <p className="text-sm text-muted-foreground">{favoriteBooks.length} เล่ม</p>
        </div>
      </div>

      {favoriteBooks.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {favoriteBooks.map(book => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">ยังไม่มีหนังสือในชั้น</p>
          <p className="mt-1 text-sm text-muted-foreground">กดไอคอน ❤️ บนหนังสือเพื่อเพิ่มในชั้นหนังสือ</p>
          <Link
            to="/"
            className="mt-6 rounded-xl gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            ไปค้นหาหนังสือ
          </Link>
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;
