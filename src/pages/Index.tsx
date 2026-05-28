import { useState, useEffect, useMemo, useRef } from "react";
import { useBooks } from "@/context/BooksContext";
import HeroSection from "@/components/HeroSection";
import BookSection from "@/components/BookSection";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useFavorites } from "@/lib/favorites";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const RECOMMEND_LIMIT = 12;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
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
  const { books = [], loading, lastError } = useBooks();
  const { user, loading: authLoading } = useAuth();
  const { favorites = [] } = useFavorites() as any;
  const favoriteSet = useMemo(
    () => new Set((favorites || []).map((id: any) => String(id))),
    [favorites]
  );
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
  // Wait for profile tags before fetching recommendations
  const [prefGenresReady, setPrefGenresReady] = useState(false);
  const dbGenres = selectedGenres.map((g) => GENRE_MAP[g]).filter(Boolean);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [recsReady, setRecsReady] = useState(false);
  const fetchedKeyRef = useRef<string | null>(null);
  // Sequence counter: prevents stale async results from overwriting newer ones
  const fetchSeqRef = useRef(0);
  // ─── Load profile genre tags ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setPreferredGenres([]);
      setPrefGenresReady(true);
      return;
    }
    setPrefGenresReady(false);
    const run = async () => {
      const { data } = await supabase
        .from("user_tags")
        .select(`tagID, tag:tagID (tagName, tagType)`)
        .eq("user_id", user.id);
      setPreferredGenres(
        data
          ?.filter((i: any) => i.tag?.tagType === "genre")
          .map((i: any) => i.tag?.tagName)
          .filter(Boolean) ?? []
      );
      setPrefGenresReady(true);
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
  const getPopularIds = (booksRef: typeof books, favSet: Set<string>) =>
    sortByRating(
      booksRef
        .filter((b) => b.isPopular)
        .filter((b) => !favSet.has(String((b as any).bookID ?? b.id)))
    )
      .slice(0, RECOMMEND_LIMIT)
      .map((b) => String((b as any).bookID ?? b.id));
  /**
   * Build local recommendation IDs using:
   *  1. Explicit genre click on homepage (targetGenres is not empty)
   *  2. Personal interaction tag-overlap similarity (interactedIds is not empty)
   *  3. Preferred genres matching (prefGenres is not empty)
   *  4. Global interaction/rating popularity fallback (skipped onboarding)
   */
  const buildLocalIds = (
    booksRef: typeof books,
    favSet: Set<string>,
    prefGenres: string[],
    targetGenres: string[],
    interactedIds: Set<string>,
    behaviorTags: Set<string>
  ): string[] => {
    // A. Explicit genre click on homepage (targetGenres is not empty)
    if (targetGenres.length > 0) {
      const targetDbGenresLower = targetGenres.map(t => t.toLowerCase());
      
      // 1. Filter books that match targetGenres and have prior interaction (any user)
      const matchedWithInteraction = sortByRating(
        booksRef.filter((b) => {
          const id = String((b as any).bookID ?? b.id);
          if (favSet.has(id)) return false;
          if (interactedIds.has(id)) return false;
          
          const bg = (b.genres ?? b.tags ?? []).map((t: string) => t.toLowerCase());
          const matchesGenres = targetDbGenresLower.every((dg) => bg.includes(dg));
          if (!matchesGenres) return false;

          const hasInteraction =
            (b.favoriteCount ?? 0) > 0 ||
            (b.reviewActionCount ?? 0) > 0 ||
            (b.viewCount ?? 0) > 0 ||
            (b.reviewCount ?? 0) > 0;
          return hasInteraction;
        })
      );

      if (matchedWithInteraction.length > 0) {
        return matchedWithInteraction
          .slice(0, RECOMMEND_LIMIT)
          .map((b) => String((b as any).bookID ?? b.id));
      }
      
      // Fallback: If no interacted books under that genre, relax interaction constraint
      const matchedAny = sortByRating(
        booksRef.filter((b) => {
          const id = String((b as any).bookID ?? b.id);
          if (favSet.has(id)) return false;
          if (interactedIds.has(id)) return false;
          
          const bg = (b.genres ?? b.tags ?? []).map((t: string) => t.toLowerCase());
          return targetDbGenresLower.every((dg) => bg.includes(dg));
        })
      );
      return matchedAny.slice(0, RECOMMEND_LIMIT).map((b) => String((b as any).bookID ?? b.id));
    }

    // B. Default recommendations (targetGenres is empty)
    
    // B1. If user has personal interactions: recommend similar books based on tag overlap
    if (interactedIds.size > 0) {
      const interactedTags = new Set<string>();
      interactedIds.forEach((id) => {
        const book = booksRef.find((b) => String((b as any).bookID ?? b.id) === id);
        if (book) {
          (book.tags ?? book.genres ?? []).forEach((t: string) =>
            interactedTags.add(t.toLowerCase())
          );
        }
      });

      const similarBooks = booksRef
        .filter((b) => {
          const id = String((b as any).bookID ?? b.id);
          if (favSet.has(id)) return false;
          if (interactedIds.has(id)) return false;
          
          const bg = (b.genres ?? b.tags ?? []).map((t: string) => t.toLowerCase());
          return bg.some((t: string) => interactedTags.has(t));
        })
        .sort((a, b) => {
          const bgA = (a.genres ?? a.tags ?? []).map((t: string) => t.toLowerCase());
          const bgB = (b.genres ?? b.tags ?? []).map((t: string) => t.toLowerCase());
          
          const overlapA = bgA.filter(t => interactedTags.has(t)).length;
          const overlapB = bgB.filter(t => interactedTags.has(t)).length;
          
          if (overlapB !== overlapA) return overlapB - overlapA;
          
          const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
          if (ratingDiff !== 0) return ratingDiff;
          return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
        });

      const ids = similarBooks.map((b) => String((b as any).bookID ?? b.id));
      if (ids.length >= RECOMMEND_LIMIT) {
        return ids.slice(0, RECOMMEND_LIMIT);
      }

      // If we don't have enough similar books, fill the remaining slots with popular books
      const popularIds = getPopularIds(booksRef, favSet).filter(id => !ids.includes(id));
      return [...ids, ...popularIds].slice(0, RECOMMEND_LIMIT);
    }

    // B2. If user has NO personal interactions but has preferred genres (onboarding tags selected)
    if (prefGenres.length > 0) {
      const prefGenresLower = prefGenres.map(g => g.toLowerCase());
      const matched = sortByRating(
        booksRef.filter((b) => {
          const id = String((b as any).bookID ?? b.id);
          if (favSet.has(id)) return false;
          if (interactedIds.has(id)) return false;
          
          const bg = (b.genres ?? b.tags ?? []).map((t: string) => t.toLowerCase());
          return bg.some((t: string) => prefGenresLower.includes(t));
        })
      );
      if (matched.length > 0) {
        return matched.slice(0, RECOMMEND_LIMIT).map((b) => String((b as any).bookID ?? b.id));
      }
    }

    // B3. If user has NO personal interactions and has NO preferred genres (skipped onboarding)
    // Recommend books that other users have interacted with the most + score
    const sortedByInteractions = [...booksRef]
      .filter((b) => {
        const id = String((b as any).bookID ?? b.id);
        return !favSet.has(id) && !interactedIds.has(id);
      })
      .sort((a, b) => {
        const scoreA = (a.favoriteCount ?? 0) * 5.0 + (a.reviewCount ?? 0) * 4.5 + (a.viewCount ?? 0) * 0.2 + (a.rating ?? 0) * 2.0;
        const scoreB = (b.favoriteCount ?? 0) * 5.0 + (b.reviewCount ?? 0) * 4.5 + (b.viewCount ?? 0) * 0.2 + (b.rating ?? 0) * 2.0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        
        const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
      });

    return sortedByInteractions.slice(0, RECOMMEND_LIMIT).map((b) => String((b as any).bookID ?? b.id));
  };
  // ─── core fetch (backend + smart local fallback) ───────────────────────────
  const doFetch = async (
    booksRef: typeof books,
    favSet: Set<string>,
    prefGenres: string[],
    genresForFetch: string[]
  ): Promise<string[]> => {
    // Fetch user's favorites and reviews in parallel (for behavior tags)
    const [{ data: favData }, { data: revData }] = user
      ? await Promise.all([
          supabase.from("favorite").select("bookID").eq("user_id", user.id),
          supabase.from("review").select("bookID").eq("user_id", user.id),
        ])
      : [{ data: null }, { data: null }];
    // Build set of books the user has already interacted with
    const interactedIds = new Set([
      ...(favData ?? []).map((f: any) => String(f.bookID)),
      ...(revData ?? []).map((r: any) => String(r.bookID)),
    ]);
    // Collect genre tags from liked + reviewed books → behavior signal
    const behaviorTags = new Set<string>();
    interactedIds.forEach((id) => {
      const book = booksRef.find((b) => String((b as any).bookID ?? b.id) === id);
      if (book) {
        (book.tags ?? book.genres ?? []).forEach((t: string) =>
          behaviorTags.add(t.toLowerCase())
        );
      }
    });
    // Try backend recommendation engine if user has interactions
    if (user && interactedIds.size > 0) {
      const param =
        genresForFetch.length > 0
          ? `?genre=${encodeURIComponent(genresForFetch.join(","))}`
          : "";
      try {
        const resp = await fetch(`${BACKEND_URL}/recommend/${user.id}${param}`);
        if (resp.ok) {
          const json = await resp.json();
          const ids = (json.bookIDs || []).map(String);
          if (ids.length > 0) return ids;
        }
      } catch {
        // Backend unavailable → fall through to local recommendation
      }
    }
    // Smart local fallback: profile tags + behavior tags
    return buildLocalIds(booksRef, favSet, prefGenres, genresForFetch, interactedIds, behaviorTags);
  };
  // ─── apply ids — single render, NO FLICKER ─────────────────────────────────
  const applyIds = async (
    cacheKey: string,
    targetDbGenres: string[],
    booksRef: typeof books,
    favSet: Set<string>,
    prefGenres: string[]
  ) => {
    // Cache hit → show instantly, done (no background refresh)
    const cached = loadCachedIds(cacheKey);
    if (cached && cached.length > 0) {
      setRecommendedIds(cached);
      setRecsReady(true);
      return;
    }
    // Cache miss → show skeleton while fetching, then show results once
    const seq = ++fetchSeqRef.current;
    setRecsReady(false);
    try {
      const ids = await doFetch(booksRef, favSet, prefGenres, targetDbGenres);
      if (seq !== fetchSeqRef.current) return; // stale — a newer fetch is in flight
      saveCachedIds(cacheKey, ids);
      setRecommendedIds(ids);
    } catch {
      if (seq !== fetchSeqRef.current) return;
      setRecommendedIds([]);
    } finally {
      if (seq === fetchSeqRef.current) {
        setRecsReady(true);
      }
    }
  };
  // ─── main effect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !prefGenresReady) return;
    if (books.length === 0) return;
    const cacheKey = getCacheKey(user?.id, dbGenres);
    if (fetchedKeyRef.current === cacheKey) return;
    fetchedKeyRef.current = cacheKey;
    applyIds(cacheKey, dbGenres, books, favoriteSet as Set<string>, preferredGenres);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, prefGenresReady, user?.id, books.length, dbGenres.join(","), preferredGenres.join(",")]);
  // ─── genre click ──────────────────────────────────────────────────────────
  const handleGenreClick = (genre: string | null) => {
    if (authLoading || books.length === 0) return;
    const nextGenres =
      genre === null
        ? []
        : selectedGenres.includes(genre)
        ? selectedGenres.filter((g) => g !== genre)
        : selectedGenres.length >= 3
        ? selectedGenres
        : [...selectedGenres, genre];
    const nextDbGenres = nextGenres.map((g) => GENRE_MAP[g]).filter(Boolean);
    const cacheKey = getCacheKey(user?.id, nextDbGenres);
    fetchedKeyRef.current = cacheKey;
    setSelectedGenres(nextGenres);
    applyIds(cacheKey, nextDbGenres, books, favoriteSet as Set<string>, preferredGenres);
  };
  // ─── derived lists ────────────────────────────────────────────────────────
  const recommendedBooks = useMemo(() => {
    const byBackend = recommendedIds
      .map((id) => books.find((b) => String((b as any).bookID ?? b.id) === id))
      .filter(Boolean);
    if (byBackend.length > 0) {
      return sortByRating(
        byBackend.filter((book: any) => !favoriteSet.has(String(book.bookID ?? book.id)))
      ).slice(0, RECOMMEND_LIMIT);
    }
    // Fallback display (should rarely reach here since applyIds handles it)
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
  // ✅ ยอดนิยม: rating desc → reviewCount desc
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
  // ✅ มาใหม่: หนังสือที่เพิ่มภายใน 30 วัน
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
  const newBooks = filterByGenre(
    [...books]
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
        {/* Recommended section */}
        {authLoading || !prefGenresReady || !recsReady ? (
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
        {/* ยอดนิยม */}
        {selectedGenres.length === 0 && popularBooks.length > 0 && (
          <BookSection
            title="🔥 ยอดนิยม"
            subtitle="หนังสือที่ได้รับความนิยมสูงสุด"
            books={popularBooks.map((b) => ({ ...b, isPopular: true, isNew: false }))}
          />
        )}
        {/* มาใหม่ */}
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