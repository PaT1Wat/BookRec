import { useBooks } from "@/context/BooksContext";
import HeroSection from "@/components/HeroSection";
import BookSection from "@/components/BookSection";
import { genres } from "@/data/books";
import { Link } from "react-router-dom";

const Index = () => {
  const { books = [] } = useBooks();

  const popularBooks = books.filter((b) => b.isPopular);
  const newBooks = books.filter((b) => b.isNew);
  const mangaBooks = books.filter((b) => b.type === "manga").slice(0, 6);
  const novelBooks = books.filter((b) => b.type === "novel").slice(0, 6);
  const lightNovelBooks = books.filter((b) => b.type === "lightnovel").slice(0, 6); // เพิ่ม

  return (
    <div className="min-h-screen">
      <HeroSection />

      <div className="container">
        {/* Genre tags */}
        <div className="flex flex-wrap gap-2 py-6">
          {genres.slice(0, 10).map((g) => (
            <Link
              key={g}
              to={`/search?genre=${g}`}
              className="rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              {g}
            </Link>
          ))}
        </div>

        {popularBooks.length > 0 && (
          <BookSection
            title="🔥 ยอดนิยม"
            subtitle="หนังสือที่ได้รับความนิยมสูงสุด"
            books={popularBooks}
          />
        )}

        {newBooks.length > 0 && (
          <BookSection
            title="✨ มาใหม่"
            subtitle="หนังสือที่เพิ่งเข้ามาใหม่ในระบบ"
            books={newBooks}
          />
        )}

        {mangaBooks.length > 0 && (
          <BookSection
            title="📖 มังงะ"
            subtitle="การ์ตูนญี่ปุ่นสุดฮิต"
            books={mangaBooks}
          />
        )}

        {novelBooks.length > 0 && (
          <BookSection
            title="📚 นิยาย"
            subtitle="นิยายหลากหลายแนว"
            books={novelBooks}
          />
        )}

        {lightNovelBooks.length > 0 && (
          <BookSection
            title="📝 ไลท์โนเวล"
            subtitle="นิยายภาพสไตล์ญี่ปุ่น"
            books={lightNovelBooks}
          />
        )}
      </div>
    </div>
  );
};

export default Index;