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
  const { books = [], loading, rawPayload, lastError } = useBooks();
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
        {/* Debug: if books failed to load, show a visible hint */}
        {!loading && books.length === 0 && (
          <div className="py-12 text-center text-destructive">
            ไม่พบหนังสือในระบบ — ตรวจสอบค่าตัวแปรสภาพแวดล้อมของ Supabase
            และดูคอนโซลเบราเซอร์ (ค้นหาข้อความ "BOOK DATA" / "BOOK ERROR").
          </div>
        )}
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

        {/* Debug panel: show raw payload or error to help diagnose missing data */}
        {!loading && books.length === 0 && (
          <div className="mt-8 rounded border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <div className="font-semibold">Debug: ข้อมูลหนังสือไม่ถูกดึงมา</div>
            {lastError && (
              <div className="mt-2">
                <div className="text-xs font-medium">BOOK ERROR:</div>
                <pre className="mt-1 max-h-40 overflow-auto break-words text-xs">{JSON.stringify(lastError, null, 2)}</pre>
              </div>
            )}
            {rawPayload && (
              <div className="mt-2">
                <div className="text-xs font-medium">RAW BOOK PAYLOAD:</div>
                <pre className="mt-1 max-h-40 overflow-auto break-words text-xs">{JSON.stringify(rawPayload, null, 2)}</pre>
              </div>
            )}
            <div className="mt-3 text-xs text-muted-foreground">ตรวจสอบค่าตัวแปรสภาพแวดล้อมของ Supabase และคอนโซล (ค้นหาข้อความ "Supabase URL" / "RAW BOOK PAYLOAD").</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;