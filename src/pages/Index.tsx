import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useBooks } from "@/context/BooksContext";
import HeroSection from "@/components/HeroSection";
import BookSection from "@/components/BookSection";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useFavorites } from "@/lib/favorites";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const RECOMMEND_LIMIT = 12;
const POOL_SIZE = 6;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const GENRE_MAP: Record<string, string> = {
  "แฟนตาซี": "แฟนตาซี", "โรแมนติก": "โรแมนติก", "แอ็กชัน": "แอ็กชัน",
  "คอมเมดี้": "คอมเมดี้", "ดราม่า": "ดราม่า", "สืบสวน": "สืบสวน",
  "สยองขวัญ": "สยองขวัญ", "ชีวิตประจำวัน": "ชีวิตประจำวัน", "ผจญภัย": "ผจญภัย",
  "เหนือธรรมชาติ": "ไซไฟ", "BL ( Boy Love )": "BL ( Boy Love )", "GL ( Girl Love )": "GL ( Girl Love )",
};
const GENRE_LABELS = Object.keys(GENRE_MAP);

// ─── cache helpers ─────────────────────────────────────────────────────────────
function getCacheKey(
  userId: string | undefined,
  genres: string[],
  prefGenres: string[],
  hasInteractions: boolean
) {
  const sortedPref = [...prefGenres].sort().join(",");
  return `recs:${userId ?? "guest"}:${genres.join(",")}:${sortedPref}:${hasInteractions ? "1" : "0"}`;
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

// ─── Skeleton ──────────────────────────────────────────────────────────────────
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

// ─── sort / score helpers ──────────────────────────────────────────────────────
// ✅ ไม่รวม rating เพื่อให้ tie-break สะท้อน interaction จริงๆ
const interactionScore = (b: any) =>
  (b.favoriteCount ?? 0) * 5.0 +
  (b.reviewActionCount ?? 0) * 4.5 +
  (b.viewCount ?? 0) * 0.2 +
  (b.reviewCount ?? 0) * 3.0;

// ✅ ผลรวม interaction ดิบๆ สำหรับ tie-break
const totalInteractions = (b: any) =>
  (b.favoriteCount ?? 0) +
  (b.reviewActionCount ?? 0) +
  (b.viewCount ?? 0) +
  (b.reviewCount ?? 0);

// ✅ คะแนนที่ใช้เรียง: ถ้ามี rating จริงให้ใช้ ถ้าไม่มีคำนวณจาก favorite + review
const computedRating = (b: any): number => {
  if ((b.rating ?? 0) > 0) return b.rating as number;
  const fav = Number(b.favoriteCount ?? 0);
  const rev = Number(b.reviewActionCount ?? 0);
  if (fav + rev === 0) return 0;
  return Math.min(5, (fav * 5.0 + rev * 4.5) / (fav + rev));
};

// ✅ sort หลัก: คะแนนมากสุดก่อน ถ้าเท่ากันดู total interaction ดิบๆ
const sortByScore = (a: any, b: any) => {
  const ratingDiff = computedRating(b) - computedRating(a);
  if (Math.abs(ratingDiff) > 0.001) return ratingDiff;
  return totalInteractions(b) - totalInteractions(a);
};

// ─── Index ─────────────────────────────────────────────────────────────────────
const Index = () => {
  const { books = [], loading, lastError } = useBooks();
  const { user, loading: authLoading } = useAuth();
  const { favorites = [] } = useFavorites() as any;
  const favoriteSet = useMemo(
    () => new Set((favorites || []).map((id: any) => String(id))),
    [favorites]
  );

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
  const [prefGenresReady, setPrefGenresReady] = useState(false);

  const [interactedIds, setInteractedIds] = useState<Set<string>>(new Set());
  const [interactionsReady, setInteractionsReady] = useState(false);

  const dbGenres = selectedGenres.map((g) => GENRE_MAP[g]).filter(Boolean);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [recsReady, setRecsReady] = useState(false);
  const fetchedKeyRef = useRef<string | null>(null);
  const fetchSeqRef = useRef(0);

  // ─── fetch interactions ────────────────────────────────────────────────────
  const fetchInteractions = useCallback(async () => {
    if (!user) {
      setInteractedIds(new Set());
      setInteractionsReady(true);
      return;
    }
    setInteractionsReady(false);
    const [{ data: favData }, { data: revData }] = await Promise.all([
      (supabase as any).from("favorite").select("bookID").eq("user_id", user.id),
      (supabase as any).from("review").select("bookID").eq("user_id", user.id),
    ]);
    setInteractedIds(new Set([
      ...(favData ?? []).map((f: any) => String(f.bookID)),
      ...(revData ?? []).map((r: any) => String(r.bookID)),
    ]));
    setInteractionsReady(true);
  }, [user?.id]);

  useEffect(() => { fetchInteractions(); }, [fetchInteractions]);

  // ─── Load profile genre tags ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setPreferredGenres([]); setPrefGenresReady(true); return; }
    setPrefGenresReady(false);
    supabase
      .from("user_tags")
      .select(`tagID, tag:tagID (tagName, tagType)`)
      .eq("user_id", user.id)
      .then(({ data }) => {
        setPreferredGenres(
          data?.filter((i: any) => i.tag?.tagType === "genre")
            .map((i: any) => i.tag?.tagName).filter(Boolean) ?? []
        );
        setPrefGenresReady(true);
      });
  }, [user?.id]);

  // ─── ฟัง recs:invalidate ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (user?.id && detail?.userId !== user.id) return;
      fetchedKeyRef.current = null;
      fetchInteractions();
      setPrefGenresReady(false);
      if (user?.id) {
        supabase
          .from("user_tags")
          .select(`tagID, tag:tagID (tagName, tagType)`)
          .eq("user_id", user.id)
          .then(({ data }) => {
            setPreferredGenres(
              data?.filter((i: any) => i.tag?.tagType === "genre")
                .map((i: any) => i.tag?.tagName).filter(Boolean) ?? []
            );
            setPrefGenresReady(true);
          });
      } else {
        setPrefGenresReady(true);
      }
    };
    window.addEventListener("recs:invalidate", handler);
    return () => window.removeEventListener("recs:invalidate", handler);
  }, [user?.id, fetchInteractions]);

  // ─── helpers ──────────────────────────────────────────────────────────────
  const visibleBooks = books.filter((b) => !(b as any).isHidden);

  const filterByGenre = (list: typeof books) =>
    dbGenres.length > 0
      ? list.filter((b) => {
          const g = b.genres ?? b.tags ?? [];
          return dbGenres.every((dg) => g.includes(dg));
        })
      : list;

  // ─── buildLocalIds ─────────────────────────────────────────────────────────
  const buildLocalIds = (
    booksRef: typeof books,
    favSet: Set<string>,
    prefGenres: string[],
    targetGenres: string[],
    interacted: Set<string>
  ): string[] => {
    const getId = (b: any) => String((b as any).bookID ?? b.id);
    const isExcluded = (id: string) => favSet.has(id) || interacted.has(id);

    if (targetGenres.length > 0) {
      const targetLower = targetGenres.map(t => t.toLowerCase());
      return [...booksRef]
        .filter(b => {
          const id = getId(b);
          if (isExcluded(id)) return false;
          const bg = (b.genres ?? b.tags ?? []).map((t: string) => t.toLowerCase());
          return targetLower.every(dg => bg.includes(dg));
        })
        .sort(sortByScore)
        .slice(0, RECOMMEND_LIMIT)
        .map(getId);
    }

    if (interacted.size === 0) {
      if (prefGenres.length > 0) {
        const prefLower = prefGenres.map(g => g.toLowerCase());
        const result = [...booksRef]
          .filter(b => {
            const id = getId(b);
            if (isExcluded(id)) return false;
            const bg = (b.genres ?? b.tags ?? []).map((t: string) => t.toLowerCase());
            return bg.some(t => prefLower.includes(t));
          })
          .sort(sortByScore)
          .slice(0, RECOMMEND_LIMIT)
          .map(getId);
        if (result.length > 0) return result;
      }
      return [...booksRef]
        .filter(b => !isExcluded(getId(b)))
        .sort(sortByScore)
        .slice(0, RECOMMEND_LIMIT)
        .map(getId);
    }

    const used = new Set<string>();

    let poolA: string[] = [];
    if (prefGenres.length > 0) {
      const prefLower = prefGenres.map(g => g.toLowerCase());
      poolA = [...booksRef]
        .filter(b => {
          const id = getId(b);
          if (isExcluded(id)) return false;
          const bg = (b.genres ?? b.tags ?? []).map((t: string) => t.toLowerCase());
          return bg.some(t => prefLower.includes(t));
        })
        .sort(sortByScore)
        .slice(0, POOL_SIZE)
        .map(getId);
      poolA.forEach(id => used.add(id));
    }

    const interactedTagSet = new Set<string>();
    interacted.forEach(id => {
      const book = booksRef.find(b => getId(b) === id);
      if (book) {
        (book.tags ?? book.genres ?? []).forEach((t: string) =>
          interactedTagSet.add(t.toLowerCase())
        );
      }
    });

    let poolB: string[] = [];
    if (interactedTagSet.size > 0) {
      poolB = [...booksRef]
        .filter(b => {
          const id = getId(b);
          if (isExcluded(id) || used.has(id)) return false;
          const bg = (b.genres ?? b.tags ?? []).map((t: string) => t.toLowerCase());
          return bg.some(t => interactedTagSet.has(t));
        })
        .sort((a, b) => {
          const bgA = (a.genres ?? a.tags ?? []).map((t: string) => t.toLowerCase());
          const bgB = (b.genres ?? b.tags ?? []).map((t: string) => t.toLowerCase());
          const overlapA = bgA.filter(t => interactedTagSet.has(t)).length;
          const overlapB = bgB.filter(t => interactedTagSet.has(t)).length;
          if (overlapB !== overlapA) return overlapB - overlapA;
          return sortByScore(a, b);
        })
        .slice(0, POOL_SIZE)
        .map(getId);
      poolB.forEach(id => used.add(id));
    }

    const fillGlobal = (exclude: Set<string>, size: number): string[] =>
      [...booksRef]
        .filter(b => { const id = getId(b); return !isExcluded(id) && !exclude.has(id); })
        .sort(sortByScore)
        .slice(0, size)
        .map(getId);

    if (poolA.length === 0) poolA = fillGlobal(used, POOL_SIZE);
    if (poolB.length === 0) {
      const excludeB = new Set([...used, ...poolA]);
      poolB = fillGlobal(excludeB, POOL_SIZE);
    }

    return [...poolA, ...poolB].slice(0, RECOMMEND_LIMIT);
  };

  // ─── doFetch / applyIds ────────────────────────────────────────────────────
  const doFetch = async (
    booksRef: typeof books,
    favSet: Set<string>,
    prefGenres: string[],
    genresForFetch: string[],
    interacted: Set<string>
  ): Promise<string[]> => {
    return buildLocalIds(booksRef, favSet, prefGenres, genresForFetch, interacted);
  };

  const applyIds = async (
    cacheKey: string,
    targetDbGenres: string[],
    booksRef: typeof books,
    favSet: Set<string>,
    prefGenres: string[],
    interacted: Set<string>
  ) => {
    const cached = loadCachedIds(cacheKey);
    if (cached && cached.length > 0) {
      setRecommendedIds(cached);
      setRecsReady(true);
      return;
    }
    const seq = ++fetchSeqRef.current;
    setRecsReady(false);
    try {
      const ids = await doFetch(booksRef, favSet, prefGenres, targetDbGenres, interacted);
      if (seq !== fetchSeqRef.current) return;
      saveCachedIds(cacheKey, ids);
      setRecommendedIds(ids);
    } catch {
      if (seq !== fetchSeqRef.current) return;
      setRecommendedIds([]);
    } finally {
      if (seq === fetchSeqRef.current) setRecsReady(true);
    }
  };

  // ─── main effect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !prefGenresReady || !interactionsReady) return;
    if (books.length === 0) return;
    const hasInteractions = interactedIds.size > 0;
    const cacheKey = getCacheKey(user?.id, dbGenres, preferredGenres, hasInteractions);
    if (fetchedKeyRef.current === cacheKey) return;
    fetchedKeyRef.current = cacheKey;
    applyIds(cacheKey, dbGenres, books, favoriteSet as Set<string>, preferredGenres, interactedIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authLoading, prefGenresReady, interactionsReady,
    interactedIds.size,
    user?.id, books.length,
    dbGenres.join(","), preferredGenres.join(","),
  ]);

  // ─── genre click ──────────────────────────────────────────────────────────
  const handleGenreClick = (genre: string | null) => {
    if (authLoading || books.length === 0) return;
    const nextGenres =
      genre === null ? []
      : selectedGenres.includes(genre) ? selectedGenres.filter((g) => g !== genre)
      : selectedGenres.length >= 3 ? selectedGenres
      : [...selectedGenres, genre];
    const nextDbGenres = nextGenres.map((g) => GENRE_MAP[g]).filter(Boolean);
    const hasInteractions = interactedIds.size > 0;
    const cacheKey = getCacheKey(user?.id, nextDbGenres, preferredGenres, hasInteractions);
    fetchedKeyRef.current = cacheKey;
    setSelectedGenres(nextGenres);
    applyIds(cacheKey, nextDbGenres, books, favoriteSet as Set<string>, preferredGenres, interactedIds);
  };

  // ─── derived lists ─────────────────────────────────────────────────────────
  const recommendedBooks = useMemo(() => {
    const byBackend = recommendedIds
      .map((id) => books.find((b) => String((b as any).bookID ?? b.id) === id))
      .filter(Boolean);
    if (byBackend.length > 0) {
      return [...byBackend]
        .filter((book: any) => !favoriteSet.has(String(book.bookID ?? book.id)))
        .sort(sortByScore)
        .slice(0, RECOMMEND_LIMIT);
    }
    return [...books]
      .filter((b) => b.isPopular)
      .filter((b) => !favoriteSet.has(String((b as any).bookID ?? b.id)))
      .filter((b) =>
        dbGenres.length > 0
          ? dbGenres.every((g) => ((b.genres ?? b.tags ?? []) as string[]).includes(g))
          : true
      )
      .sort(sortByScore)
      .slice(0, RECOMMEND_LIMIT);
  }, [recommendedIds, books, dbGenres, favoriteSet]);

  const popularBooks = filterByGenre(
    [...visibleBooks]
      .filter((b) => (b.reviewCount ?? 0) >= 1)
      .sort(sortByScore)
      .slice(0, 12)
  );

  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
  const newBooks = filterByGenre(
    [...visibleBooks]
      .filter((b) => {
        if (b.publishDate) return Date.now() - new Date(b.publishDate).getTime() <= ONE_MONTH_MS;
        return b.isNew === true;
      })
      .sort((a, b) => {
        const dateA = a.publishDate ? new Date(a.publishDate).getTime() : 0;
        const dateB = b.publishDate ? new Date(b.publishDate).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 12)
  );

  const mangaBooks = filterByGenre(visibleBooks.filter((b) => b.type === "manga")).slice(0, 12);
  const novelBooks = filterByGenre(visibleBooks.filter((b) => b.type === "novel")).slice(0, 12);
  const lightNovelBooks = filterByGenre(visibleBooks.filter((b) => b.type === "light-novel")).slice(0, 12);

  // ─── render ────────────────────────────────────────────────────────────────
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
            <button key={g} onClick={() => handleGenreClick(g)}
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

        {/* Recommended section */}
        {authLoading || !prefGenresReady || !interactionsReady || !recsReady ? (
          <RecommendSkeleton />
        ) : (
          <>
            {selectedGenres.length === 0 && recommendedBooks.length > 0 && (
              <BookSection
                title={user ? "💡 สำหรับคุณ" : "🔥 แนะนำเบื้องต้น"}
                subtitle={
                  user
                    ? "หนังสือที่ระบบแนะนำตามความชอบและพฤติกรรมของคุณ"
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
                ไม่พบหนังสือในแนว &quot;{selectedGenres.join(", ")}&quot;
              </div>
            )}
          </>
        )}

        {selectedGenres.length === 0 && recsReady && popularBooks.length > 0 && (
          <BookSection title="🔥 ยอดนิยม" subtitle="หนังสือที่ได้รับความนิยมสูงสุด"
            books={popularBooks.map((b) => ({ ...b, isPopular: true, isNew: b.isNew }))} />
        )}
        {selectedGenres.length === 0 && recsReady && newBooks.length > 0 && (
          <BookSection title="✨ มาใหม่" subtitle="หนังสือที่เพิ่งเข้ามาใหม่ในระบบ"
            books={newBooks.map((b) => ({ ...b, isNew: true }))} />
        )}
        {recsReady && mangaBooks.length > 0 && (
          <BookSection title="📖 มังงะ" subtitle="การ์ตูนญี่ปุ่นสุดฮิต" books={mangaBooks} />
        )}
        {recsReady && novelBooks.length > 0 && (
          <BookSection title="📚 นิยาย" subtitle="นิยายหลากหลายแนว" books={novelBooks} />
        )}
        {recsReady && lightNovelBooks.length > 0 && (
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