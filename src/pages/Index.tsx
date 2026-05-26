import { useState, useEffect, useMemo, useRef } from "react";
import { useBooks } from "@/context/BooksContext";
import HeroSection from "@/components/HeroSection";
import BookSection from "@/components/BookSection";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useFavorites } from "@/lib/favorites";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const RECOMMEND_LIMIT = 12;
const CACHE_TTL = 60 * 60 * 1000;

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

// ─── cache helpers ────────────────────────────────────────────────────────────
function getCacheKey(userId: string | undefined, genres: string[]) {
  return `recs:${userId ?? "guest"}:${genres.join(",")}`;
}

function loadCachedIds(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ids, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return ids as string[];
  } catch { return null; }
}

function saveCachedIds(key: string, ids: string[]) {
  try { localStorage.setItem(key, JSON.stringify({ ids, ts: Date.now() })); } catch {}
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const RecommendSkeleton = () => (
  <section className="py-8">
    <div className="mb-6">
      <div className="h-7 w-36 rounded-lg bg-muted animate-pulse" />
      <div className="mt-2 h-4 w-56 rounded bg-muted animate-pulse" />
    </div>
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
          <div className="h-4 w-full rounded bg-muted animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  </section>
);

// ─── sort helper ──────────────────────────────────────────────────────────────
const sortByRating = (list: any[]) =>
  [...list].sort((a, b) => {
    const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
    if (ratingDiff !== 0) return ratingDiff;
    return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
  });

// ─── Index ────────────────────────────────────────────────────────────────────
const Index = () => {
  const { books = [], loading, rawPayload, lastError } = useBooks();
  const { user, loading: authLoading } = useAuth();
  const { favorites = [] } = useFavorites() as any;

  const favoriteSet = useMemo(
    () => new Set((favorites || []).map((id: any) => String(id))),
    [favorites]
  );

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
  const dbGenres = selectedGenres.map((g) => GENRE_MAP[g]).filter(Boolean);

  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [recsReady, setRecsReady] = useState(false);

  const fetchedKeyRef = useRef<string | null>(null);

  // ─── preferred genres ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setPreferredGenres([]); return; }
    const run = async () => {
      const { data, error } = await supabase
        .from("user_tags")
        .select(`tagID, tag:tagID (tagName, tagType)`)
        .eq("user_id", user.id);
      if (error) { setPreferredGenres([]); return; }
      setPreferredGenres(
        data?.filter((i: any) => i.tag?.tagType === "genre")
             .map((i: any) => i.tag?.tagName)
             .filter(Boolean) ?? []
      );
    };
    run();
  }, [user?.id]);

  // ─── helpers ───────────────────────────────────────────────────────────────
  const filterByGenre = (list: typeof books) =>
    dbGenres.length > 0
      ? list.filter((b) => {
          const g = b.genres ?? b.tags ?? [];
          return dbGenres.every((dg) => g.includes(dg));
        })
      : list;

  const getPopularIds = () =>
    sortByRating(
      books
        .filter((b) => b.isPopular)
        .filter((b) => !favoriteSet.has(String((b as any).bookID ?? b.id)))
    )
      .slice(0, RECOMMEND_LIMIT)
      .map((b) => String((b as any).bookID ?? b.id));

  const getPreferredFallbackIds = (overrideDbGenres?: string[]) => {
    const src = (overrideDbGenres ?? dbGenres).length > 0
      ? (overrideDbGenres ?? dbGenres)
      : preferredGenres;
    if (src.length === 0) return getPopularIds();
    const matched = sortByRating(
      books
        .filter((b) => {
          const bg = b.genres ?? b.tags ?? [];
          return src.every((g) => bg.includes(g));
        })
        .filter((b) => !favoriteSet.has(String((b as any).bookID ?? b.id)))
    )
      .slice(0, RECOMMEND_LIMIT)
      .map((b) => String((b as any).bookID ?? b.id));
    return matched.length > 0 ? matched : getPopularIds();
  };

  // ─── core fetch ────────────────────────────────────────────────────────────
  const doFetch = async (genresForFetch: string[]): Promise<string[]> => {
    if (!user) return getPreferredFallbackIds(genresForFetch);

    const [{ data: favs }, { data: revs }, { data: interactions }] =
      await Promise.all([
        supabase.from("favorite").select("bookID").eq("user_id", user.id),
        supabase.from("review").select("reviewID").eq("user_id", user.id),
        supabase.from("interaction").select("interactionID").eq("user_id", user.id),
      ]);

    const hasInteraction =
      (favs?.length ?? 0) > 0 ||
      (revs?.length ?? 0) > 0 ||
      (interactions?.length ?? 0) > 0;

    if (!hasInteraction) return getPreferredFallbackIds(genresForFetch);

    const param = genresForFetch.length > 0
      ? `?genre=${encodeURIComponent(genresForFetch.join(","))}`
      : "";
    try {
      const resp = await fetch(`${BACKEND_URL}/recommend/${user.id}${param}`);
      if (resp.ok) {
        const json = await resp.json();
        const ids = (json.bookIDs || []).map(String);
        return ids.length > 0 ? ids : getPreferredFallbackIds(genresForFetch);
      }
    } catch {}
    return getPreferredFallbackIds(genresForFetch);
  };

  // ─── apply ids ─────────────────────────────────────────────────────────────
  const applyIds = (cacheKey: string, targetDbGenres: string[]) => {
    const cached = loadCachedIds(cacheKey);

    if (cached && cached.length > 0) {
      setRecommendedIds(cached);
      setRecsReady(true);
      // background refresh เงียบๆ
      doFetch(targetDbGenres).then((ids) => {
        saveCachedIds(cacheKey, ids);
        setRecommendedIds((prev) => {
          const same = prev.length === ids.length && prev.every((id, i) => id === ids[i]);
          return same ? prev : ids;
        });
      }).catch(() => {});

    } else {
      // ไม่มี cache → แสดง local filtered books ทันที ไม่ต้องรอ backend
      const localIds = getPreferredFallbackIds(targetDbGenres);
      if (localIds.length > 0) {
        setRecommendedIds(localIds);
        setRecsReady(true);
      } else {
        setRecsReady(false);
      }
      // fetch backend เงียบๆ อัปเดต cache + ปรับ recommendations
      doFetch(targetDbGenres).then((ids) => {
        saveCachedIds(cacheKey, ids);
        setRecommendedIds((prev) => {
          const same = prev.length === ids.length && prev.every((id, i) => id === ids[i]);
          return same ? prev : ids;
        });
      }).catch(() => {}).finally(() => {
        setRecsReady(true);
      });
    }
  };

  // ─── main effect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (books.length === 0) return;

    const cacheKey = getCacheKey(user?.id, dbGenres);
    if (fetchedKeyRef.current === cacheKey) return;
    fetchedKeyRef.current = cacheKey;

    applyIds(cacheKey, dbGenres);
  }, [authLoading, user?.id, books.length, dbGenres.join(","), preferredGenres.join(",")]);

  // ─── genre click ──────────────────────────────────────────────────────────
  const handleGenreClick = (genre: string | null) => {
    if (authLoading || books.length === 0) return;

    const nextGenres = genre === null
      ? []
      : selectedGenres.includes(genre)
        ? selectedGenres.filter((g) => g !== genre)
        : selectedGenres.length >= 3 ? selectedGenres : [...selectedGenres, genre];

    const nextDbGenres = nextGenres.map((g) => GENRE_MAP[g]).filter(Boolean);
    const cacheKey = getCacheKey(user?.id, nextDbGenres);

    fetchedKeyRef.current = cacheKey;
    applyIds(cacheKey, nextDbGenres);
    setSelectedGenres(nextGenres);
  };

  // ─── derived lists ────────────────────────────────────────────────────────
  const recommendedBooks = useMemo(() => {
    const byBackend = recommendedIds
      .map((id) => books.find((b) => String((b as any).bookID ?? b.id) === id))
      .filter(Boolean);

    // ✅ เรียงตาม rating → reviewCount ทั้ง backend result และ fallback
    if (byBackend.length > 0) {
      return sortByRating(
        byBackend.filter((book: any) => !favoriteSet.has(String(book.bookID ?? book.id)))
      ).slice(0, RECOMMEND_LIMIT);
    }

    return sortByRating(
      books
        .filter((b) => b.isPopular)
        .filter((b) => !favoriteSet.has(String((b as any).bookID ?? b.id)))
        .filter((b) =>
          dbGenres.length > 0
            ? dbGenres.every((g) => ((b.genres ?? b.tags ?? []) as string[]).includes(g))
            : true
        )
    ).slice(0, RECOMMEND_LIMIT);
  }, [recommendedIds, books, dbGenres, favoriteSet]);

  // ✅ ยอดนิยม = คำนวณจาก rating + reviewCount จริง ไม่ใช้ isPopular flag
  // มีรีวิวอย่างน้อย 1 ครั้ง → เรียงตาม rating desc → reviewCount desc → top 12
  const popularBooks = filterByGenre(
    [...books]
      .filter((b) => (b.reviewCount ?? 0) >= 1)
      .sort((a, b) => {
        const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
      })
      .slice(0, 12)
  );
  // ✅ มาใหม่ = หนังสือที่เพิ่มเข้าระบบภายใน 7 วันที่ผ่านมา
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const newBooks = filterByGenre(
    [...books]
      .filter((b) => {
        if (b.publishDate) {
          return Date.now() - new Date(b.publishDate).getTime() <= ONE_WEEK_MS;
        }
        return b.isNew === true;
      })
      .sort((a, b) => {
        const dateA = a.publishDate ? new Date(a.publishDate).getTime() : 0;
        const dateB = b.publishDate ? new Date(b.publishDate).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 12)
  );
  const mangaBooks = filterByGenre(books.filter((b) => b.type === "manga")).slice(0, 12);
  const novelBooks = filterByGenre(books.filter((b) => b.type === "novel")).slice(0, 12);
  const lightNovelBooks = filterByGenre(books.filter((b) => b.type === "light-novel")).slice(0, 12);

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <HeroSection />

      <div className="container">
        {!loading && books.length === 0 && (
          <div className="py-12 text-center text-destructive">
            ไม่พบหนังสือในระบบ — ตรวจสอบค่าตัวแปรสภาพแวดล้อมของ Supabase
          </div>
        )}

        {/* Genre filter */}
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

        {/* Recommended */}
        {authLoading || !recsReady ? (
          <RecommendSkeleton />
        ) : (
          <>
            {selectedGenres.length === 0 && recommendedBooks.length > 0 && (
              <BookSection
                title={user ? "💡 สำหรับคุณ" : "🔥 แนะนำเบื้องต้น"}
                subtitle={
                  user
                    ? "หนังสือที่ระบบแนะนำตามความชอบของคุณ"
                    : "หนังสือยอดนิยมที่คุณอาจสนใจ"
                }
                books={recommendedBooks}
              />
            )}
            {selectedGenres.length > 0 && recommendedBooks.length > 0 && (
              <BookSection
                title={`💡 แนะนำแนว${selectedGenres.join(" & ")}`}
                subtitle={`หนังสือแนะนำในแนว ${selectedGenres.join(" & ")} สำหรับคุณ`}
                books={recommendedBooks}
              />
            )}
            {selectedGenres.length > 0 && recommendedBooks.length === 0 && (
              <div className="py-20 text-center text-muted-foreground">
                ไม่พบหนังสือในแนว "{selectedGenres.join(", ")}"
              </div>
            )}
          </>
        )}

        {/* ยอดนิยม — force isPopular: true ทุกเล่มใน section นี้ */}
        {selectedGenres.length === 0 && popularBooks.length > 0 && (
          <BookSection
            title="🔥 ยอดนิยม"
            subtitle="หนังสือที่ได้รับความนิยมสูงสุด"
            books={popularBooks.map((b) => ({ ...b, isPopular: true, isNew: false }))}
          />
        )}

        {/* มาใหม่ — force isNew: true ทุกเล่มใน section นี้ */}
        {selectedGenres.length === 0 && newBooks.length > 0 && (
          <BookSection
            title="✨ มาใหม่"
            subtitle="หนังสือที่เพิ่งเข้ามาใหม่ในระบบ"
            books={newBooks.map((b) => ({ ...b, isNew: true, isPopular: false }))}
          />
        )}
        {mangaBooks.length > 0 && (
          <BookSection title="📖 มังงะ" subtitle="การ์ตูนญี่ปุ่นสุดฮิต" books={mangaBooks} />
        )}
        {novelBooks.length > 0 && (
          <BookSection title="📚 นิยาย" subtitle="นิยายหลากหลายแนว" books={novelBooks} />
        )}
        {lightNovelBooks.length > 0 && (
          <BookSection title="📝 ไลท์โนเวล" subtitle="นิยายภาพสไตล์ญี่ปุ่น" books={lightNovelBooks} />
        )}

        {!loading && books.length === 0 && (
          <div className="mt-8 rounded border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <div className="font-semibold">Debug: ข้อมูลหนังสือไม่ถูกดึงมา</div>
            {lastError && (
              <pre className="mt-1 max-h-40 overflow-auto break-words text-xs">
                {JSON.stringify(lastError, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
