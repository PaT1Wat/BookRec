import { useBooks } from "@/context/BooksContext";
import HeroSection from "@/components/HeroSection";
import BookSection from "@/components/BookSection";
import RecommendationSection from "@/components/RecommendationSection";
import { genres } from "@/data/books";
import { Link } from "react-router-dom";

const Index = () => {
  const { books } = useBooks();
  const popularBooks = books.filter(b => b.isPopular);
  const newBooks = books.filter(b => b.isNew);
  const mangaBooks = books.filter(b => b.type === "manga").slice(0, 6);
  const novelBooks = books.filter(b => b.type === "novel").slice(0, 6);

  return (
    <div className="min-h-screen">
      <HeroSection />

      <div className="container">
        {/* Genre tags */}
        <div className="flex flex-wrap gap-2 py-6">
          {genres.slice(0, 10).map(g => (
            <Link
              key={g}
              to={`/search?genre=${g}`}
              className="rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              {g}
            </Link>
          ))}
        </div>

        <BookSection title="🔥 ยอดนิยม" subtitle="หนังสือที่ได้รับความนิยมสูงสุด" books={popularBooks} />
        <BookSection title="✨ มาใหม่" subtitle="หนังสือที่เพิ่งเข้ามาใหม่ในระบบ" books={newBooks} />
        <BookSection title="📖 มังงะ" subtitle="การ์ตูนญี่ปุ่นสุดฮิต" books={mangaBooks} />
        <BookSection title="📚 นิยาย" subtitle="นิยายหลากหลายแนว" books={novelBooks} />
      </div>
    </div>
  );
};

export default Index;
