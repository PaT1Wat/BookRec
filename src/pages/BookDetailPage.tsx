import { useParams, Link } from "react-router-dom";
import { Star, Heart, ArrowLeft, BookOpen, User, Building2, Tag } from "lucide-react";
import { books } from "@/data/books";
import { useFavorites } from "@/lib/favorites";
import BookCard from "@/components/BookCard";

const BookDetailPage = () => {
  const { id } = useParams();
  const book = books.find(b => b.id === id);
  const { toggle, check } = useFavorites();

  if (!book) {
    return (
      <div className="container py-20 text-center">
        <p className="text-lg text-muted-foreground">ไม่พบหนังสือ</p>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">กลับหน้าแรก</Link>
      </div>
    );
  }

  const isFav = check(book.id);
  const relatedBooks = books.filter(b => b.id !== book.id && b.genres.some(g => book.genres.includes(g))).slice(0, 4);

  return (
    <div className="container py-8">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="h-4 w-4" /> กลับ
      </Link>

      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        {/* Cover */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl shadow-card">
            <img src={book.coverUrl} alt={book.title} className="w-full object-cover aspect-[2/3]" />
          </div>
          <button
            onClick={() => toggle(book.id)}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all ${
              isFav
                ? "bg-destructive/10 text-destructive border border-destructive/30"
                : "gradient-primary text-primary-foreground"
            }`}
          >
            <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
            {isFav ? "ลบออกจากชั้นหนังสือ" : "เพิ่มในชั้นหนังสือ"}
          </button>
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {book.type === "manga" ? "มังงะ" : "นิยาย"}
            </span>
            <h1 className="mt-3 text-3xl font-extrabold text-foreground font-display">{book.title}</h1>
            {book.titleEn && <p className="mt-1 text-lg text-muted-foreground">{book.titleEn}</p>}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-5 w-5 ${i < Math.round(book.rating) ? "fill-star text-star" : "text-muted-foreground/30"}`}
                />
              ))}
            </div>
            <span className="text-lg font-bold text-foreground">{book.rating}</span>
            <span className="text-sm text-muted-foreground">({book.reviewCount} รีวิว)</span>
          </div>

          <div className="text-2xl font-bold text-primary">฿{book.price}</div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-secondary p-3">
              <User className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">ผู้แต่ง</p>
                <p className="text-sm font-medium text-foreground">{book.author}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-secondary p-3">
              <Building2 className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">สำนักพิมพ์</p>
                <p className="text-sm font-medium text-foreground">{book.publisher}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">เรื่องย่อ</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{book.description}</p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">แนว & แท็ก</h3>
            <div className="flex flex-wrap gap-2">
              {book.genres.map(g => (
                <Link
                  key={g}
                  to={`/search?genre=${g}`}
                  className="rounded-full bg-tag-bg px-3 py-1 text-xs font-medium text-tag-fg hover:bg-primary/10 transition-colors"
                >
                  {g}
                </Link>
              ))}
              {book.tags.map(t => (
                <span key={t} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Related books */}
      {relatedBooks.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-6 text-xl font-bold text-foreground font-display">📚 หนังสือที่คล้ายกัน</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {relatedBooks.map(b => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default BookDetailPage;
