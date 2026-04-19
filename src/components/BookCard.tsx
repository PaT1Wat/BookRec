import { Link } from "react-router-dom";
import { Heart, Star } from "lucide-react";
import { Book } from "@/data/books";
import { useFavorites } from "@/lib/favorites";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface BookCardProps {
  book: Book;
}

const BookCard = ({ book }: BookCardProps) => {
  const { toggle, check } = useFavorites();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const isFav = check(book.id);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      await toggle(book.id);
      toast({ title: isFav ? "ลบออกแล้ว 💔" : "เพิ่มในรายการแล้ว ❤️" });
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="group relative animate-fade-in-up">
      <Link to={`/book/${book.id}`} className="block">

        {/* COVER */}
        <div className="relative overflow-hidden rounded-xl shadow-card transition-all duration-300 group-hover:shadow-card-hover group-hover:-translate-y-1">
          <div className="aspect-[2/3] overflow-hidden bg-muted">
            <img
              src={book.coverUrl || "/placeholder.svg"}
              alt={book.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          </div>

          {/* BADGE ยอดนิยม / ใหม่ */}
          {book.isPopular && (
            <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
              ยอดนิยม
            </span>
          )}
          {book.isNew && !book.isPopular && (
            <span className="absolute left-2 top-2 rounded-full bg-blue-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
              ใหม่
            </span>
          )}
        </div>
      </Link>

      {/* ❤️ FAVORITE BUTTON */}
      <button
        aria-label={isFav ? "ลบออกจากรายการโปรด" : "เพิ่มในรายการโปรด"}
        onClick={handleToggle}
        disabled={loading}
        className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200
          ${isFav
            ? "bg-white text-red-500"
            : "bg-white/80 backdrop-blur text-muted-foreground hover:text-red-400"
          }
          ${loading ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
      </button>

      {/* INFO */}
      <div className="mt-2 space-y-1 px-0.5">

        {/* ชื่อหนังสือ */}
        <Link to={`/book/${book.id}`}>
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
            {book.title}
          </h3>
        </Link>

        {/* ✅ ชื่ออังกฤษ — เพิ่มตรงนี้ */}
        {book.titleEn && (
          <p className="text-xs text-muted-foreground truncate italic">
            {book.titleEn}
          </p>
        )}

        {/* ผู้แต่ง */}
        <p className="text-xs text-muted-foreground truncate">
          {book.authorName || book.author || "-"}
        </p>

        {/* ⭐ Rating + ราคา */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Render 5 small stars filled according to rounded rating */}
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => {
                const filled = i < Math.round(book.rating ?? 0);
                return (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                  />
                );
              })}
            </div>
            <span className="text-xs font-medium text-foreground">{(book.rating ?? 0).toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">({book.reviewCount ?? 0})</span>
          </div>

          {(book.price ?? 0) > 0 && (
            <span className="text-sm font-bold text-primary">฿{book.price}</span>
          )}
        </div>

        {/* TAGS */}
        {book.tags && book.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {book.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookCard;