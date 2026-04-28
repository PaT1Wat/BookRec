import { useState, useEffect, useMemo  } from "react";
import { useBooks } from "@/context/BooksContext";
import HeroSection from "@/components/HeroSection";
import BookSection from "@/components/BookSection";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const RECOMMEND_LIMIT = 12;

const shuffleArray = (array: string[]) => {
  return [...array].sort(() => Math.random() - 0.5);
};

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
  "BL ( Boy Love )": "BL ( Boy Love )",
  "GL ( Girl Love )": "GL ( Girl Love )",
};

const GENRE_LABELS = Object.keys(GENRE_MAP);

const Index = () => {
  const { books = [], loading, rawPayload, lastError } = useBooks();
  const { user } = useAuth();

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);

  const [recsLoading, setRecsLoading] = useState(true);
  
  const dbGenres = selectedGenres.map((g) => GENRE_MAP[g]).filter(Boolean);

  useEffect(() => {
    if (!user) {
      setPreferredGenres([]);
      return;
    }

    const fetchPreferredGenres = async () => {
      const { data, error } = await supabase
        .from("user_tags")
        .select(`
          tagID,
          tag:tagID (
            tagName,
            tagType
          )
        `)
        .eq("user_id", user.id);

      if (error) {
        console.error("[preferred genres] error:", error);
        setPreferredGenres([]);
        return;
      }

      const genres =
        data
          ?.filter((item: any) => item.tag?.tagType === "genre")
          .map((item: any) => item.tag?.tagName)
          .filter(Boolean) ?? [];

      console.log("[preferred genres]:", genres);

      setPreferredGenres(genres);
    };

    fetchPreferredGenres();
  }, [user?.id]);

  const filterByGenre = (list: typeof books) =>
    dbGenres.length > 0
      ? list.filter((b) => {
          const genres = b.genres ?? b.tags ?? [];
          return dbGenres.every((g) => genres.includes(g));
        })
      : list;

  const getPreferredFallbackIds = () => {
    const sourceGenres = dbGenres.length > 0 ? dbGenres : preferredGenres;

    const matched = books
      .filter((b) => {
        const bookGenres = b.genres ?? b.tags ?? [];

        if (sourceGenres.length === 0) {
          return b.isPopular;
        }

        return sourceGenres.every((g) => bookGenres.includes(g));
      })
      .slice(0, RECOMMEND_LIMIT)
      .map((b) => String((b as any).bookID ?? b.id));

    if (matched.length > 0) return matched;

   return books
      .filter((b) => b.isPopular)
      .slice(0, RECOMMEND_LIMIT)
      .map((b) => String((b as any).bookID ?? b.id));
  };

  const popularBooks = filterByGenre(books.filter((b) => b.isPopular));
  const newBooks = filterByGenre(books.filter((b) => b.isNew));
  const mangaBooks = filterByGenre(books.filter((b) => b.type === "manga")).slice(0, 6);
  const novelBooks = filterByGenre(books.filter((b) => b.type === "novel")).slice(0, 6);
  const lightNovelBooks = filterByGenre(books.filter((b) => b.type === "light-novel")).slice(0, 6);

  useEffect(() => {
    const fetchRecs = async () => {
      try {
        setRecsLoading(true);

        let resultIds: string[] = [];

        if (books.length === 0) {
          setRecommendedIds([]);
          return;
        }

        if (!user) {
          resultIds = getPreferredFallbackIds();
        } else {
          const [
            { data: favs },
            { data: revs },
            { data: interactions },
          ] = await Promise.all([
            supabase.from("favorite").select("bookID").eq("user_id", user.id),
            supabase.from("review").select("reviewID").eq("user_id", user.id),
            supabase.from("interaction").select("interactionID").eq("user_id", user.id),
          ]);

          const hasInteraction =
            (favs?.length ?? 0) > 0 ||
            (revs?.length ?? 0) > 0 ||
            (interactions?.length ?? 0) > 0;

          if (!hasInteraction) {
            resultIds = getPreferredFallbackIds();
          } else {
            const rgenreParam = dbGenres.length > 0
              ? `?genre=${encodeURIComponent(dbGenres.join(","))}`
              : "";

            const resp = await fetch(`${BACKEND_URL}/recommend/${user.id}${rgenreParam}`);

            if (resp.ok) {
              const json = await resp.json();
              const ids = (json.bookIDs || []).map((id: unknown) => String(id));

              resultIds = ids.length > 0 ? ids : getPreferredFallbackIds();
            } else {
              resultIds = getPreferredFallbackIds();
            }
          }
        }

        setRecommendedIds(shuffleArray(resultIds));
        
      } catch (err) {
        console.error(err);
        setRecommendedIds(shuffleArray(getPreferredFallbackIds()));
      } finally {
        setRecsLoading(false);
      }
    };

    fetchRecs();
  }, [user?.id, books, dbGenres.join(","), preferredGenres]);

  const recommendedBooks = useMemo(() => {
    const byBackend = recommendedIds
      .map((id) =>
        books.find((b) => {
          const candidateId = String((b as any).bookID ?? b.id);
          return candidateId === String(id);
        })
      )
      .filter(Boolean);

    if (byBackend.length > 0) {
      return byBackend.slice(0, RECOMMEND_LIMIT);
    }

    return books
      .filter((b) => b.isPopular)
      .filter((b) => (dbGenres.length > 0 ? dbGenres.every((g) => ((b.genres ?? b.tags ?? []) as string[]).includes(g)) : true))
      .slice(0, RECOMMEND_LIMIT);
  }, [recommendedIds, books, dbGenres]);

  const displayBooks = useMemo(() => {
    if (selectedGenres.length > 0 && recsLoading) {
      return filterByGenre(books).slice(0, RECOMMEND_LIMIT);
  }

    return recommendedBooks;
  }, [selectedGenres, recsLoading, books, recommendedBooks, dbGenres]);

  console.log("[recs] selectedGenre:", selectedGenres);
  console.log("[recs] dbGenre:", dbGenres);
  console.log("[recs] recommendedIds final:", recommendedIds);
  console.log("[recs] recommendedBooks final:", recommendedBooks);
  console.log("[recs] sample book ids:", books.slice(0, 10).map((b) => (b as any).bookID ?? b.id));
  console.log("[recs] first book object:", books[0]);

  const handleGenreClick = (genre: string | null) => {
    if (genre === null) {
      setSelectedGenres([]);
      setRecsLoading(true);

      const instantIds = books
        .filter((book) => book.isPopular)
        .slice(0, RECOMMEND_LIMIT)
        .map((book) => String((book as any).bookID ?? book.id));

      setRecommendedIds(shuffleArray(instantIds));
      return;
    }

    const nextGenres = selectedGenres.includes(genre)
      ? selectedGenres.filter((g) => g !== genre)
      : selectedGenres.length >= 3
      ? selectedGenres
      : [...selectedGenres, genre];

    const nextDbGenres = nextGenres.map((g) => GENRE_MAP[g]).filter(Boolean);

    setSelectedGenres(nextGenres);
    setRecsLoading(true);

    const instantIds = books
      .filter((book) => {
        if (nextDbGenres.length === 0) return book.isPopular;

        const genres = book.genres ?? book.tags ?? [];
        return nextDbGenres.every((g) => genres.includes(g));
      })
      .slice(0, RECOMMEND_LIMIT)
      .map((book) => String((book as any).bookID ?? book.id));

    setRecommendedIds(shuffleArray(instantIds));
  };

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
            onClick={() => handleGenreClick(null)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedGenres.length === 0
                ? "bg-primary text-primary-foreground border-primary"
                : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
            }`}
          >
            ทั้งหมด
          </button>

          {GENRE_LABELS.map((g) => (
            <button
              key={g}
              onClick={() => handleGenreClick(g)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                selectedGenres.includes(g)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* ✅ แนะนำทั่วไป เมื่อไม่ได้เลือกแนว */}
        {selectedGenres.length === 0 && (
          recsLoading ? (
            <section className="py-8">
              <h2 className="text-xl font-bold">💡 สำหรับคุณ</h2>
              <p className="text-sm text-muted-foreground">
                กำลังวิเคราะห์หนังสือสำหรับคุณ...
              </p>
            </section>
          ) : recommendedBooks.length > 0 ? (
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
              <h2 className="text-xl font-bold">
                {user ? "💡 สำหรับคุณ" : "🔥 แนะนำเบื้องต้น"}
              </h2>
              <p className="text-sm text-muted-foreground">
                ยังไม่มีข้อมูลแนะนำในตอนนี้
              </p>
            </section>
          )
        )}

        {/* ✅ แนะนำตามแนวจาก backend จริง */}
        {selectedGenres.length > 0 &&
          (displayBooks.length > 0 ? (
            <BookSection
              title={`💡 แนะนำแนว${selectedGenres.join(" & ")}`}
              subtitle={`หนังสือแนะนำในแนว ${selectedGenres.join(" & ")  } สำหรับคุณ`}
              books={displayBooks}
            />
          ) : (
            <section className="py-8">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-foreground font-display">
                  {`💡 แนะนำแนว${selectedGenres.join(" & ")}`}
                </h2>
                <p className="text-sm text-muted-foreground">
                  ยังไม่มีหนังสือแนะนำในแนวนี้ตอนนี้
                </p>
              </div>
            </section>
          ))}

        {selectedGenres.length === 0 && popularBooks.length > 0 && (
          <BookSection
            title="🔥 ยอดนิยม"
            subtitle="หนังสือที่ได้รับความนิยมสูงสุด"
            books={popularBooks}
          />
        )}

        {selectedGenres.length === 0 && newBooks.length > 0 && (
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

        {selectedGenres.length > 0 &&
          mangaBooks.length === 0 &&
          novelBooks.length === 0 &&
          lightNovelBooks.length === 0 && (
            <div className="py-20 text-center text-muted-foreground">
              ไม่พบหนังสือในแนว "{selectedGenres.join(", ")}"
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