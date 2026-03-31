import { useState } from "react";
import { useBooks } from "@/context/BooksContext";
import HeroSection from "@/components/HeroSection";
import BookSection from "@/components/BookSection";
import { Link } from "react-router-dom";

// ✅ mapping ภาษาไทย → tagName ใน DB
const GENRE_MAP: Record<string, string> = {
  "แฟนตาซี":        "แฟนตาซี",
  "โรแมนติก":       "โรแมนติก",
  "แอ็กชัน":        "แอ็กชัน",
  "คอมเมดี้":       "คอมเมดี้",
  "ดราม่า":         "ดราม่า",
  "สืบสวน":         "สืบสวน",
  "สยองขวัญ":       "สยองขวัญ",
  "ชีวิตประจำวัน":  "ชีวิตประจำวัน",
  "ผจญภัย":         "ผจญภัย",
  "เหนือธรรมชาติ":  "ไซไฟ",
  "GL/BL":          "GL/BL",
};

const GENRE_LABELS = Object.keys(GENRE_MAP);

const Index = () => {
  const { books = [] } = useBooks();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  // ✅ filter ด้วย tagName จาก DB
  const dbGenre = selectedGenre ? GENRE_MAP[selectedGenre] : null;

  const filterByGenre = (list: typeof books) =>
    dbGenre
      ? list.filter((b) => (b.genres ?? []).includes(dbGenre))
      : list;

  const popularBooks    = filterByGenre(books.filter((b) => b.isPopular));
  const newBooks        = filterByGenre(books.filter((b) => b.isNew));
  const mangaBooks      = filterByGenre(books.filter((b) => b.type === "manga")).slice(0, 6);
  const novelBooks      = filterByGenre(books.filter((b) => b.type === "novel")).slice(0, 6);
  const lightNovelBooks = filterByGenre(books.filter((b) => b.type === "light-novel")).slice(0, 6);

  return (
    <div className="min-h-screen">
      <HeroSection />

      <div className="container">
        {/* ✅ Genre pills — คลิกกรอง inline */}
        <div className="flex flex-wrap gap-2 py-6">
          {/* ปุ่ม "ทั้งหมด" */}
          <button
            onClick={() => setSelectedGenre(null)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              !selectedGenre
                ? "bg-primary text-primary-foreground border-primary"
                : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
            }`}
          >
            ทั้งหมด
          </button>

          {GENRE_LABELS.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(selectedGenre === g ? null : g)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                selectedGenre === g
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {!selectedGenre && popularBooks.length > 0 && (
          <BookSection
            title="🔥 ยอดนิยม"
            subtitle="หนังสือที่ได้รับความนิยมสูงสุด"
            books={popularBooks}
          />
        )}

        {!selectedGenre && newBooks.length > 0 && (
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

        {/* ✅ แสดงเมื่อกรอง genre แล้วไม่พบหนังสือเลย */}
        {selectedGenre &&
          mangaBooks.length === 0 &&
          novelBooks.length === 0 &&
          lightNovelBooks.length === 0 && (
            <div className="py-20 text-center text-muted-foreground">
              ไม่พบหนังสือในแนว "{selectedGenre}"
            </div>
          )}
      </div>
    </div>
  );
};

export default Index;