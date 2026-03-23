import { Book } from "@/data/books";
import BookCard from "./BookCard";

interface BookSectionProps {
  title: string;
  subtitle?: string;
  books: Book[];
}

const BookSection = ({ title, subtitle, books }: BookSectionProps) => {
  if (books.length === 0) return null;

  return (
    <section className="py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground font-display">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {books.map((book, i) => (
          <div
            key={book.id}
            className={`animate-fade-in-up delay-${(i % 6) + 1}`}
          >
            <BookCard book={book} />
          </div>
        ))}
      </div>
    </section>
  );
};

export default BookSection;