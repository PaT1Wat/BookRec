import { Link } from "react-router-dom";
import { Heart, Star } from "lucide-react";
import { Book } from "@/data/books";
import { useFavorites } from "@/lib/favorites";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface BookCardProps {
  book: Book;
}

const BookCard = ({ book }: BookCardProps) => {
  const { toggle, check } = useFavorites();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const isFav = check(book.id);

  const favoriteCount     = Number((book as any).favoriteCount     ?? 0);
  const reviewActionCount = Number((book as any).reviewActionCount ?? 0);
  const viewCount         = Number((book as any).viewCount         ?? 0);
  const reviewCount       = Number(book.reviewCount ?? 0);

  // ─── คะแนนที่แสดง: ถ้ามี rating จริงให้ใช้ ถ้าไม่มีให้คำนวณจาก favorite + review ───
  const computedRating = Math.min(
    5,
    (favoriteCount * 5.0 + reviewActionCount * 4.5) /
      Math.max(favoriteCount + reviewActionCount, 1)
  );
  const displayRating = (book.rating ?? 0) > 0 ? (book.rating ?? 0) : computedRating;

  const logInteraction = async (actionType: string) => {
    if (!user) return;
    try {
      await supabase.from("interaction" as any).insert({
        bookID: Number(book.id),
        user_id: user.id,
        actionType,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.debug("Failed to log favorite interaction:", actionType, err);
    }
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const wasFav = check(book.id);
      await toggle(book.id);
      await logInteraction(wasFav ? "unfavorite" : "favorite");
      toast({ title: wasFav ? "ลบออกแล้ว 💔" : "เพิ่มในรายการแล้ว ❤️" });
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
          <div className="absolute left-2 top-2 flex flex-row gap-1">
            {book.isPopular && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                ยอดนิยม
              </span>
            )}
            {book.isNew && (
              <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                ใหม่
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* ❤️ FAVORITE BUTTON */}
      <button
        aria-label={isFav ? "ลบออกจากรายการโปรด" : "เพิ่มในรายการโปรด"}
        onClick={handleToggle}
        disabled={loading}
        className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200
          ${isFav ? "bg-white text-red-500" : "bg-white/80 backdrop-blur text-muted-foreground hover:text-red-400"}
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

        {/* ชื่ออังกฤษ */}
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
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => {
                const filled = i < Math.round(displayRating);
                return (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${
                      filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                    }`}
                  />
                );
              })}
            </div>
            <span className="text-xs font-medium text-foreground">
              {displayRating.toFixed(1)}
            </span>
          </div>

          {(book.price ?? 0) > 0 && (
            <span className="text-sm font-bold text-primary">฿{book.price}</span>
          )}
        </div>

        {/* ❤️💬👁️ Interaction stats + ผลรวม */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5">
          {favoriteCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Heart className="h-2.5 w-2.5 fill-red-400 text-red-400" />
              {favoriteCount}
            </span>
          )}
          {reviewActionCount > 0 && (
            <span className="flex items-center gap-0.5">
              💬 {reviewActionCount}
            </span>
          )}
          {viewCount > 0 && (
            <span className="flex items-center gap-0.5">
              👁️ {viewCount}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            ({favoriteCount + reviewActionCount + viewCount})
          </span>
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