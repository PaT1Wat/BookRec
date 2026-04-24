import { useState, useEffect } from "react";
import { useBooks } from "@/context/BooksContext";
import HeroSection from "@/components/HeroSection";
import BookSection from "@/components/BookSection";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const RECOMMEND_LIMIT = 12;

// ✅ mapping ภาษาไทย → tagName ใน DB
const GENRE_MAP: Record<string, string> = {
  "แฟนตาซี": "แฟนตาซี",
  "โรแมนติก": "โรแมนติก",
  "แอ็กชัน": "แอ็กชัน",
  "คอมเมดี้": "คอมเมดี้",
  "ดราม่า": "ดราม่า",
  "สืบสวน": "สืบสวน",
  "สยองขวัญ": "สยองขวัญ",
  "ชีวิตประจำวัน": "ชีวิตประจำวัน",
  "ผจญภัย": "ผจญภัย",
  "เหนือธรรมชาติ": "ไซไฟ",
  "GL/BL": "GL/BL",
};

const GENRE_LABELS = Object.keys(GENRE_MAP);

const Index = () => {
  const { books = [], loading, rawPayload, lastError } = useBooks();
  const { user } = useAuth();

  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);

  const dbGenre = selectedGenre ? GENRE_MAP[selectedGenre] : null;

  const filterByGenre = (list: typeof books) =>
    dbGenre ? list.filter((b) => (b.genres ?? []).includes(dbGenre)) : list;

  const popularBooks = filterByGenre(books.filter((b) => b.isPopular));
  const newBooks = filterByGenre(books.filter((b) => b.isNew));
  const mangaBooks = filterByGenre(books.filter((b) => b.type === "manga")).slice(0, 6);
  const novelBooks = filterByGenre(books.filter((b) => b.type === "novel")).slice(0, 6);
  const lightNovelBooks = filterByGenre(books.filter((b) => b.type === "light-novel")).slice(0, 6);

  useEffect(() => {
    const fetchRecs = async () => {
      if (books.length === 0) {
        setRecommendedIds([]);
        return;
      }

      try {
        setRecommendedIds([]);

        // guest → fallback popular ตามแนวที่เลือก
        if (!user) {
          const fallbackIds = books
            .filter((b) => b.isPopular)
            .filter((b) => (dbGenre ? (b.genres ?? []).includes(dbGenre) : true))
            .slice(0, RECOMMEND_LIMIT)
            .map((b) => String((b as any).bookID ?? b.id));

          console.log("[recs] guest fallback ids:", fallbackIds);
          setRecommendedIds(fallbackIds);
          return;
        }

        const [
          { data: favs, error: favErr },
          { data: revs, error: revErr },
          { data: interactions, error: intErr },
        ] = await Promise.all([
          supabase.from("favorite").select("favoriteID").eq("user_id", user.id),
          supabase.from("review").select("reviewID").eq("user_id", user.id),
          supabase.from("interaction").select("interactionID").eq("user_id", user.id),
        ]);

        if (favErr || revErr || intErr) {
          console.error("[recs] Error checking interactions:", favErr || revErr || intErr);

          const fallbackIds = books
            .filter((b) => b.isPopular)
            .filter((b) => (dbGenre ? (b.genres ?? []).includes(dbGenre) : true))
            .slice(0, RECOMMEND_LIMIT)
            .map((b) => String((b as any).bookID ?? b.id));

          setRecommendedIds(fallbackIds);
          return;
        }

        const hasInteraction =
          (favs?.length ?? 0) > 0 ||
          (revs?.length ?? 0) > 0 ||
          (interactions?.length ?? 0) > 0;

        console.log("[recs] user:", user.id);
        console.log("[recs] favorites count:", favs?.length ?? 0);
        console.log("[recs] reviews count:", revs?.length ?? 0);
        console.log("[recs] interaction count:", interactions?.length ?? 0);
        console.log("[recs] hasInteraction:", hasInteraction);

        if (!hasInteraction) {
          const fallbackIds = books
            .filter((b) => b.isPopular)
            .filter((b) => (dbGenre ? (b.genres ?? []).includes(dbGenre) : true))
            .slice(0, RECOMMEND_LIMIT)
            .map((b) => String((b as any).bookID ?? b.id));

          console.log("[recs] cold-start fallback ids:", fallbackIds);
          setRecommendedIds(fallbackIds);
          return;
        }

        const genreParam = dbGenre
          ? `?genre=${encodeURIComponent(dbGenre)}`
          : "";

        const resp = await fetch(`${BACKEND_URL}/recommend/${user.id}${genreParam}`);

        console.log("[recs] backend url:", `${BACKEND_URL}/recommend/${user.id}${genreParam}`);
        console.log("[recs] backend response ok:", resp.ok);

        if (!resp.ok) {
          const fallbackIds = books
            .filter((b) => b.isPopular)
            .filter((b) => (dbGenre ? (b.genres ?? []).includes(dbGenre) : true))
            .slice(0, RECOMMEND_LIMIT)
            .map((b) => String((b as any).bookID ?? b.id));

          console.warn("[recs] backend failed, fallback to popular");
          setRecommendedIds(fallbackIds);
          return;
        }

        const json = await resp.json();
        const ids = (json.bookIDs || []).map((id: unknown) => String(id));

        console.log("[recs] backend ids:", ids);

        if (ids.length === 0) {
          const fallbackIds = books
            .filter((b) => b.isPopular)
            .filter((b) => (dbGenre ? (b.genres ?? []).includes(dbGenre) : true))
            .slice(0, RECOMMEND_LIMIT)
            .map((b) => String((b as any).bookID ?? b.id));

          console.log("[recs] empty backend ids, fallback ids:", fallbackIds);
          setRecommendedIds(fallbackIds);
          return;
        }

        setRecommendedIds(ids);
      } catch (err) {
        console.error("[recs] Failed to fetch recommendations:", err);

        const fallbackIds = books
          .filter((b) => b.isPopular)
          .filter((b) => (dbGenre ? (b.genres ?? []).includes(dbGenre) : true))
          .slice(0, RECOMMEND_LIMIT)
          .map((b) => String((b as any).bookID ?? b.id));

        setRecommendedIds(fallbackIds);
      }
    };

    fetchRecs();
  }, [user?.id, books, dbGenre]);

  const recommendedBooks = recommendedIds
    .map((id) =>
      books.find((b) => {
        const candidateId = String((b as any).bookID ?? b.id);
        return candidateId === String(id);
      })
    )
    .filter(Boolean)
    .slice(0, RECOMMEND_LIMIT) as typeof books;

  console.log("[recs] selectedGenre:", selectedGenre);
  console.log("[recs] dbGenre:", dbGenre);
  console.log("[recs] recommendedIds final:", recommendedIds);
  console.log("[recs] recommendedBooks final:", recommendedBooks);
  console.log("[recs] sample book ids:", books.slice(0, 10).map((b) => (b as any).bookID ?? b.id));
  console.log("[recs] first book object:", books[0]);

  return (
    <div className="min-h-screen">
      <HeroSection />

      <div className="container">
        {!loading && books.length === 0 && (
          <div className="py-12 text-center text-destructive">
            ไม่พบหนังสือในระบบ — ตรวจสอบค่าตัวแปรสภาพแวดล้อมของ Supabase
            และดูคอนโซลเบราเซอร์ (ค้นหาข้อความ "BOOK DATA" / "BOOK ERROR").
          </div>
        )}

        <div className="flex flex-wrap gap-2 py-6">
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

        {/* ✅ แนะนำทั่วไป เมื่อไม่ได้เลือกแนว */}
        {!selectedGenre &&
          (recommendedBooks.length > 0 ? (
            <BookSection
              title={user ? "💡 สำหรับคุณ" : "🔥 แนะนำเบื้องต้น"}
              subtitle={
                user
                  ? "หนังสือที่ระบบแนะนำตามความชอบของคุณ"
                  : "หนังสือยอดนิยมที่คุณอาจสนใจ"
              }
              books={recommendedBooks}
            />
          ) : (
            <section className="py-8">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-foreground font-display">
                  {user ? "💡 สำหรับคุณ" : "🔥 แนะนำเบื้องต้น"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  ยังไม่มีข้อมูลแนะนำในตอนนี้
                </p>
              </div>
            </section>
          ))}

        {/* ✅ แนะนำตามแนวจาก backend จริง */}
        {selectedGenre &&
          (recommendedBooks.length > 0 ? (
            <BookSection
              title={`💡 แนะนำแนว${selectedGenre}`}
              subtitle={`หนังสือแนะนำในแนว ${selectedGenre} สำหรับคุณ`}
              books={recommendedBooks}
            />
          ) : (
            <section className="py-8">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-foreground font-display">
                  {`💡 แนะนำแนว${selectedGenre}`}
                </h2>
                <p className="text-sm text-muted-foreground">
                  ยังไม่มีหนังสือแนะนำในแนวนี้ตอนนี้
                </p>
              </div>
            </section>
          ))}

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
          <BookSection title="📖 มังงะ" subtitle="การ์ตูนญี่ปุ่นสุดฮิต" books={mangaBooks} />
        )}

        {novelBooks.length > 0 && (
          <BookSection title="📚 นิยาย" subtitle="นิยายหลากหลายแนว" books={novelBooks} />
        )}

        {lightNovelBooks.length > 0 && (
          <BookSection
            title="📝 ไลท์โนเวล"
            subtitle="นิยายภาพสไตล์ญี่ปุ่น"
            books={lightNovelBooks}
          />
        )}

        {selectedGenre &&
          mangaBooks.length === 0 &&
          novelBooks.length === 0 &&
          lightNovelBooks.length === 0 && (
            <div className="py-20 text-center text-muted-foreground">
              ไม่พบหนังสือในแนว "{selectedGenre}"
            </div>
          )}

        {!loading && books.length === 0 && (
          <div className="mt-8 rounded border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <div className="font-semibold">Debug: ข้อมูลหนังสือไม่ถูกดึงมา</div>
            {lastError && (
              <div className="mt-2">
                <div className="text-xs font-medium">BOOK ERROR:</div>
                <pre className="mt-1 max-h-40 overflow-auto break-words text-xs">
                  {JSON.stringify(lastError, null, 2)}
                </pre>
              </div>
            )}
            {rawPayload && (
              <div className="mt-2">
                <div className="text-xs font-medium">RAW BOOK PAYLOAD:</div>
                <pre className="mt-1 max-h-40 overflow-auto break-words text-xs">
                  {JSON.stringify(rawPayload, null, 2)}
                </pre>
              </div>
            )}
            <div className="mt-3 text-xs text-muted-foreground">
              ตรวจสอบค่าตัวแปรสภาพแวดล้อมของ Supabase และคอนโซล
              (ค้นหาข้อความ "Supabase URL" / "RAW BOOK PAYLOAD").
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;