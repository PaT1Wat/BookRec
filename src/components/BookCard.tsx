import { Link } from "react-router-dom";
import { Star, Heart } from "lucide-react";
import { Book } from "@/data/books";
import { useFavorites } from "@/lib/favorites";
import { Badge } from "@/components/ui/badge";

interface BookCardProps {
  book: Book;
}

const BookCard = ({ book }: BookCardProps) => {
  const { toggle, check } = useFavorites();
  const isFav = check(book.id);

  return (
    <div className="group relative animate-fade-in-up">
      <Link to={`/book/${book.id}`} className="block">
        <div className="relative overflow-hidden rounded-xl shadow-card transition-all duration-300 group-hover:shadow-card-hover group-hover:-translate-y-1">
          <div className="aspect-[2/3] overflow-hidden bg-muted">
            <img
              src={book.coverUrl}
              alt={book.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          </div>
          {book.isNew && (
            <Badge className="absolute left-2 top-2 border-0 gradient-primary text-primary-foreground text-xs">
              ใหม่
            </Badge>
          )}
          {book.isPopular && (
            <Badge variant="secondary" className="absolute left-2 top-2 border-0 bg-star text-primary-foreground text-xs">
              ยอดนิยม
            </Badge>
          )}
        </div>
      </Link>

      <button
        onClick={(e) => { e.preventDefault(); toggle(book.id); }}
        className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full transition-all ${
          isFav
            ? "bg-destructive text-destructive-foreground"
            : "bg-card/80 backdrop-blur text-muted-foreground hover:text-destructive"
        }`}
      >
        <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
      </button>

      <div className="mt-3 space-y-1">
        <Link to={`/book/${book.id}`}>
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {book.title}
          </h3>
        </Link>
        <p className="text-xs text-muted-foreground">{book.author}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-star text-star" />
            <span className="text-xs font-medium text-foreground">{book.rating}</span>
            <span className="text-xs text-muted-foreground">({book.reviewCount})</span>
          </div>
          <span className="text-sm font-bold text-primary">฿{book.price}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {book.genres.slice(0, 2).map(g => (
            <span key={g} className="rounded-full bg-tag-bg px-2 py-0.5 text-[10px] font-medium text-tag-fg">
              {g}
            </span>
          ))}
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
            {book.type === "manga" ? "มังงะ" : "นิยาย"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BookCard;
