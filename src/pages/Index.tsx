import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useBooks } from "@/context/BooksContext";
import HeroSection from "@/components/HeroSection";
import BookSection from "@/components/BookSection";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useFavorites } from "@/lib/favorites";
import { logImpression, logClick } from "@/lib/recTracking";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const RECOMMEND_LIMIT = 12;

const GENRE_MAP: Record<string, string> = {
  "แฟนตาซี": "แฟนตาซี", "โรแมนติก": "โรแมนติก", "แอ็กชัน": "แอ็กชัน",
  "คอมเมดี้": "คอมเมดี้", "ดราม่า": "ดราม่า", "สืบสวน": "สืบสวน",
  "สยองขวัญ": "สยองขวัญ", "ชีวิตประจำวัน": "ชีวิตประจำวัน", "ผจญภัย": "ผจญภัย",
  "ไซไฟ": "ไซไฟ", "BL ( Boy Love )": "BL ( Boy Love )", "GL ( Girl Love )": "GL ( Girl Love )",
};
const GENRE_LABELS = Object.keys(GENRE_MAP);

// ─── cache helpers ─────────────────────────────────────────────────────────────
// ✅ cache key ไม่ผูกกับวันที่ — อยู่ได้ตลอด session จนกว่าจะถูก invalidate
// (ผ่าน event "recs:invalidate" เมื่อ favorite/review/genre เปลี่ยน)
// หรือหมดอายุอัตโนมัติหลัง 30 วัน (กันท้ายกรณี event พลาดไป)
const RECS_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 วัน

function getCacheKey(
  userId: string | undefined,
  genres: string[],
  prefGenres: string[],
  interactedTags: Set<string>
) {
  const sortedPref = [...prefGenres].sort().join(",");
  const sortedInteracted = [...interactedTags].sort().join(",");
  return `recs:${userId ?? "guest"}:${genres.join(",")}:${sortedPref}:${sortedInteracted}`; // ✅
}

function loadCachedIds(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ids, ts } = JSON.parse(raw);
    if (typeof ts === "number" && Date.now() - ts > RECS_CACHE_MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return (ids as string[]) ?? null;
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

// ─── static score helpers (ไม่ depend on state) ───────────────────────────────
const totalInteractions = (b: any) =>
  (b.favoriteCount ?? 0) +
  (b.reviewActionCount ?? 0) +
  (b.viewCount ?? 0) +
  (b.reviewCount ?? 0);

const computedRating = (b: any): number => {
  const totalReviews = Number(b.reviewCount ?? 0);
  const negativeReviews = Number((b as any).negativeReviewCount ?? 0);

  if ((b.rating ?? 0) > 0) {
    const rating = b.rating as number;
    if (totalReviews > 0 && negativeReviews > 0) {
      // ✅ ตรงกับ Python: 1 ดาว = -1.0 weight
      // หัก 1.0 ต่อ 1 รีวิวเชิงลบ หารด้วย total reviews
      const negativePenalty = (negativeReviews * 1.0) / totalReviews;
      return Math.max(0, rating - negativePenalty);
    }
    return rating;
  }    
  const fav = Number(b.favoriteCount ?? 0);
  const rev = Number(b.reviewActionCount ?? 0);
  if (fav + rev === 0) return 0;
  const positiveRev = Math.max(0, rev - negativeReviews);
  return Math.min(5, (fav * 5.0 + positiveRev * 4.5) / (fav + rev));
};

// ✅ คะแนน interaction รวม — ใช้ field ที่คำนวณไว้แล้วจาก book_interaction_stats
// (fav*5 + reviewActionCount*4.5 + view*0.1) ตรงกับสูตรฝั่ง backend/recommend.py
const interactionScoreOf = (b: any): number => Number(b.interactionScore ?? 0);

// ✅ comparator หลักของทั้งระบบ — ใช้ภายในทุกกลุ่ม (preferred / interacted / อื่นๆ)
// เรียงตาม interactionScore (จำนวนคนสนใจ/มีปฏิสัมพันธ์) มากไปน้อยก่อนเสมอ
// ถ้า interactionScore เท่ากันเป๊ะ ถึงจะใช้ rating (เฉลี่ยดาว) เป็น tie-breaker
const sortByInteractionThenRating = (a: any, b: any) => {
  const scoreA = interactionScoreOf(a);
  const scoreB = interactionScoreOf(b);
  if (Math.abs(scoreB - scoreA) > 0.001) return scoreB - scoreA;
  return computedRating(b) - computedRating(a);
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

  // ✅ แท็กจากหนังสือที่เคย favorite หรือ review ≥ 3 ดาว — ใช้จัดกลุ่ม "สนใจรอง"
  // (review < 3 ดาว = ไม่ชอบ ไม่เอาแท็กมาแนะนำซ้ำ)
  const [interactedGenres, setInteractedGenres] = useState<Set<string>>(new Set());
  const [interactedGenresReady, setInteractedGenresReady] = useState(false);

  const [genreWeights, setGenreWeights] = useState<Record<string, number>>({});

  const dbGenres = selectedGenres.map((g) => GENRE_MAP[g]).filter(Boolean);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [recsReady, setRecsReady] = useState(false);
  const fetchedKeyRef = useRef<string | null>(null);
  const fetchSeqRef = useRef(0);

  // ─── sortByScore: ใช้กับ section "🔥 ยอดนิยม" (popularBooks) เท่านั้น ──────
  // ลำดับการเรียง 3 ชั้น: (1) rating ก่อนเสมอ (2) ถ้า rating เท่ากัน ใช้
  // interactionScore (3) ถ้ายังเท่ากันอีก ค่อยใช้ genreBoost+clickScore จาก
  // Click Tracking (หัวข้อ 2.2.7) เป็น tie-breaker ชั้นสุดท้าย
  // หมายเหตุ: section "💡 สำหรับคุณ" ไม่ใช้ comparator นี้ — ใช้
  // sortByInteractionThenRating (interactionScore ก่อน, rating รอง) แทน
  const sortByScore = useCallback((a: any, b: any) => {
    const ratingA = computedRating(a);
    const ratingB = computedRating(b);
    if (Math.abs(ratingB - ratingA) > 0.001) return ratingB - ratingA;

    const scoreA = interactionScoreOf(a);
    const scoreB = interactionScoreOf(b);
    if (Math.abs(scoreB - scoreA) > 0.001) return scoreB - scoreA;

    const clickAdjustment = (book: any) => {
      const tags: string[] = book.tags ?? book.genres ?? [];
      const genreBoost = tags.reduce((sum, tag) => sum + (genreWeights[tag] ?? 0), 0) * 0.1;
      return genreBoost + (book.clickScore ?? 0) * 0.5;
    };
    return clickAdjustment(b) - clickAdjustment(a);
  }, [genreWeights]);

  // ─── fetch interactions (ใช้กัน "หนังสือที่เคย interact" ไม่ให้แนะนำซ้ำ) ──────
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

  // ✅ ดึง "แท็กที่สนใจจากพฤติกรรม" — favorite ทั้งหมด + review ที่ให้ ≥ 3 ดาว
  // ใช้แยกต่างหากจาก interactedIds (ซึ่งมีไว้กันหนังสือซ้ำ ไม่ใช่ดึง signal แท็ก)
  const fetchInteractedGenres = useCallback(async (booksRef: typeof books) => {
    if (!user || booksRef.length === 0) {
      setInteractedGenres(new Set());
      setInteractedGenresReady(true);
      return;
    }
    setInteractedGenresReady(false);
    const [{ data: favData }, { data: revData }] = await Promise.all([
      (supabase as any).from("favorite").select("bookID").eq("user_id", user.id),
      (supabase as any).from("review").select("bookID, rating").eq("user_id", user.id),
    ]);

    const likedBookIds = new Set<string>([
      ...(favData ?? []).map((f: any) => String(f.bookID)),
      ...(revData ?? [])
        .filter((r: any) => Number(r.rating ?? 0) >= 3)
        .map((r: any) => String(r.bookID)),
    ]);

    const bookMap = new Map<string, any>();
    booksRef.forEach((b: any) => {
      bookMap.set(String(b.bookID ?? b.id), b);
    });

    const genres = new Set<string>();
    likedBookIds.forEach((id) => {
      const book = bookMap.get(id);
      (book?.tags ?? book?.genres ?? []).forEach((tag: string) => {
        genres.add(tag.toLowerCase());
      });
    });

    setInteractedGenres(genres);
    setInteractedGenresReady(true);
  }, [user?.id]);

  // ─── fetch interacted genres เมื่อ books โหลดเสร็จ ──────────────────────────
  useEffect(() => {
    if (books.length === 0) return;
    fetchInteractedGenres(books);
  }, [books.length, fetchInteractedGenres]);

  // ─── fetch genre weights จาก rec_impression ───────────────────────────────
  useEffect(() => {
    if (!user?.id || books.length === 0) { setGenreWeights({}); return; }
    (supabase as any)
      .from("rec_impression")
      .select("bookID")
      .eq("user_id", user.id)
      .eq("clicked", true)
      .then(({ data }: any) => {
        const weights: Record<string, number> = {};
        (data ?? []).forEach((row: any) => {
          const book = books.find((b: any) => String(b.bookID ?? b.id) === String(row.bookID));
          if (book) {
            (book.tags ?? book.genres ?? []).forEach((tag: string) => {
              weights[tag] = (weights[tag] ?? 0) + 1;
            });
          }
        });
        setGenreWeights(weights);
      });
  }, [user?.id, books.length]);

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

      // ✅ เพิ่มตรงนี้ — ล้าง cache ก่อนเสมอ
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith(`recs:${user?.id ?? "guest"}`))
          .forEach((k) => localStorage.removeItem(k));
      } catch {}

      fetchedKeyRef.current = null;
      fetchInteractions();
      if (books.length > 0) fetchInteractedGenres(books);
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
  }, [user?.id, fetchInteractions, fetchInteractedGenres, books]);

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
  // กฎการเรียง (ยืนยันกับผู้ใช้แล้ว — ใช้ logic เดียวกันทุกเคส รวม genre filter
  // ที่ผู้ใช้เลือกเองบนหน้าเว็บด้วย ไม่มีเคสพิเศษแยกแล้ว):
  // 1. กรองด้วย targetGenres ก่อน (ถ้าผู้ใช้กด filter อยู่บนหน้าเว็บ) — ถ้าไม่กด
  //    filter ก็ใช้หนังสือทั้งหมดเป็นฐาน
  // 2. จากหนังสือที่ผ่านการกรอง (หรือทั้งหมดถ้าไม่กรอง) แบ่งเป็น 3 กลุ่ม:
  //    - กลุ่ม 1: มีแท็กตรง preferredGenres (ตั้งไว้ตอน onboarding/profile)
  //      ไม่ว่าจะตรง interactedGenres ด้วยหรือไม่ก็ตาม (ใช้ OR ไม่ใช่ exclusive —
  //      ถ้าเล่มมีทั้งแท็ก preferred และ interacted ผสมกัน ให้อยู่กลุ่ม 1)
  //    - กลุ่ม 2: ไม่ตรงกลุ่ม 1 แต่มีแท็กตรง interactedGenres (แท็กจากหนังสือ
  //      ที่เคย favorite หรือ review ≥ 3 ดาว)
  //    - กลุ่ม 3: ที่เหลือทั้งหมด (ไม่ตรงทั้งกลุ่ม 1 และ 2)
  // 3. แต่ละกลุ่มเรียงด้วย interactionScore มากไปน้อยก่อน แล้วค่อย rating
  //    เป็น tie-breaker (sortByInteractionThenRating)
  // 4. ต่อกลุ่ม 1 → 2 → 3 แล้วตัดที่ RECOMMEND_LIMIT
  const buildLocalIds = useCallback((
    booksRef: typeof books,
    favSet: Set<string>,
    prefGenres: string[],
    targetGenres: string[],
    interacted: Set<string>,
    interactedTags: Set<string>
  ): string[] => {
    const getId = (b: any) => String((b as any).bookID ?? b.id);
    const isExcluded = (id: string) => favSet.has(id) || interacted.has(id);
    const tagsOf = (b: any) => ((b.genres ?? b.tags ?? []) as string[]).map((t) => t.toLowerCase());

    // ── กรองฐานหนังสือด้วย genre filter ที่เลือกเอง (ถ้ามี) ──────────────────
    const targetLower = targetGenres.map((t) => t.toLowerCase());
    const base = targetLower.length > 0
      ? booksRef.filter((b) => targetLower.every((dg) => tagsOf(b).includes(dg)))
      : booksRef;

    const available = base.filter((b) => !isExcluded(getId(b)));

    const prefLower = prefGenres.map((g) => g.toLowerCase());

    // กลุ่ม 1: ตรง preferredGenres
    const group1 = available
      .filter((b) => prefLower.length > 0 && tagsOf(b).some((t) => prefLower.includes(t)))
      .sort(sortByInteractionThenRating);
    const usedIds = new Set(group1.map(getId));

    // กลุ่ม 2: ไม่ตรงกลุ่ม 1 แต่ตรง interactedGenres
    const group2 = available
      .filter((b) => {
        const id = getId(b);
        if (usedIds.has(id)) return false;
        return interactedTags.size > 0 && tagsOf(b).some((t) => interactedTags.has(t));
      })
      .sort(sortByInteractionThenRating);
    group2.forEach((b) => usedIds.add(getId(b)));

    // กลุ่ม 3: ที่เหลือ
    const group3 = available
      .filter((b) => !usedIds.has(getId(b)))
      .sort(sortByInteractionThenRating);

    // ✅ คำนวณ effective weight ของแต่ละแท็ก
    // — prefGenres มีน้ำหนักเริ่มต้น 1.0
    // — interactedTags เพิ่ม 0.5 ต่อแท็ก (ถ้า interact เยอะจะแซง pref ได้)
    const tagWeights = new Map<string, number>();
    prefLower.forEach((tag) => {
      tagWeights.set(tag, 1.0);
    });
    interactedTags.forEach((tag) => {
      tagWeights.set(tag, (tagWeights.get(tag) ?? 0) + 0.5);
    });

    // เรียงแท็กตาม weight มากไปน้อย
    const rankedTags = [...tagWeights.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
    

    // ✅ การันตี quota ต่อแท็ก — แต่ละ prefGenre ได้อย่างน้อย 2 เล่มก่อนเสมอ
    const QUOTA_PER_TAG = 2;
    const guaranteed: any[] = [];
    const guaranteedIds = new Set<string>();

    prefLower.forEach((tag) => {
      available
        .filter((b) => !guaranteedIds.has(getId(b)) && tagsOf(b).includes(tag))
        .sort(sortByInteractionThenRating)
        .slice(0, QUOTA_PER_TAG)
        .forEach((b) => {
          guaranteedIds.add(getId(b));
          guaranteed.push(b);
        });
    });

    // เอา guaranteed มาก่อน แล้วเติมด้วย group1/2/3 ที่ยังไม่มีใน guaranteed
    const rest = [...group1, ...group2, ...group3]
      .filter((b) => !guaranteedIds.has(getId(b)));

    return [...guaranteed, ...rest]
      .slice(0, RECOMMEND_LIMIT)
      .map(getId);
  }, [sortByInteractionThenRating]);


  // ─── doFetch / applyIds ────────────────────────────────────────────────────
  const doFetch = async (
    booksRef: typeof books,
    favSet: Set<string>,
    prefGenres: string[],
    genresForFetch: string[],
    interacted: Set<string>,
    interactedTags: Set<string>
  ): Promise<string[]> => {
    return buildLocalIds(booksRef, favSet, prefGenres, genresForFetch, interacted, interactedTags);
  };

  const applyIds = async (
    cacheKey: string,
    targetDbGenres: string[],
    booksRef: typeof books,
    favSet: Set<string>,
    prefGenres: string[],
    interacted: Set<string>,
    interactedTags: Set<string>
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
      const ids = await doFetch(booksRef, favSet, prefGenres, targetDbGenres, interacted, interactedTags);
      if (seq !== fetchSeqRef.current) return;
      saveCachedIds(cacheKey, ids);
      setRecommendedIds(ids);
      if (user?.id && ids.length > 0) {
        logImpression(user.id, ids, "for_you");
      }
    } catch {
      if (seq !== fetchSeqRef.current) return;
      setRecommendedIds([]);
    } finally {
      if (seq === fetchSeqRef.current) setRecsReady(true);
    }
  };

  // ─── main effect ──────────────────────────────────────────────────────────
  // ✅ ตัด hasInteractions / interactedIds.size ออกจาก cache key และ deps
  // เพื่อไม่ให้การคลิกดูหนังสือ (เกิด view interaction ใหม่) ไปกระตุ้นให้คำนวณลำดับใหม่
  // cache key ไม่ผูกกับวันที่แล้ว — รอ invalidate event หรือหมดอายุ 30 วันแทน
  useEffect(() => {
    if (authLoading || !prefGenresReady || !interactionsReady || !interactedGenresReady) return;
    if (books.length === 0) return;
    const cacheKey = getCacheKey(user?.id, dbGenres, preferredGenres, interactedGenres); // ✅

    if (fetchedKeyRef.current === cacheKey) return;
    fetchedKeyRef.current = cacheKey;
    applyIds(cacheKey, dbGenres, books, favoriteSet as Set<string>, preferredGenres, interactedIds, interactedGenres);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authLoading, prefGenresReady, interactionsReady, interactedGenresReady,
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
    const cacheKey = getCacheKey(user?.id, nextDbGenres, preferredGenres, interactedGenres); // ✅
    fetchedKeyRef.current = cacheKey;
    setSelectedGenres(nextGenres);
    applyIds(cacheKey, nextDbGenres, books, favoriteSet as Set<string>, preferredGenres, interactedIds, interactedGenres);
  };

  // ─── derived lists ─────────────────────────────────────────────────────────
  const recommendedBooks = useMemo(() => {
    const byBackend = recommendedIds
      .map((id) => books.find((b) => String((b as any).bookID ?? b.id) === id))
      .filter(Boolean);
    if (byBackend.length > 0) {
      // ✅ ไม่ sort ซ้ำ — buildLocalIds จัดลำดับตามกฎ 3 กลุ่ม (preferred → interacted
      // → อื่นๆ) แล้ว interactionScore→rating ภายในแต่ละกลุ่มไว้แล้ว
      // แค่กรองหนังสือที่กด favorite ไปแล้วออก
      return (byBackend as any[])
        .filter((book) => !favoriteSet.has(String(book.bookID ?? book.id)))
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
      .sort(sortByInteractionThenRating)
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
        {authLoading || !prefGenresReady || !interactionsReady || !interactedGenresReady || !recsReady ? (
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
                onBookClick={(bookId) => {
                  if (user?.id) logClick(user.id, bookId, "for_you");
                }}
              />
            )}
            {selectedGenres.length > 0 && recommendedBooks.length > 0 && (
              <BookSection
                title={`💡 แนะนำแนว${selectedGenres.join(" & ")}`}
                subtitle={`หนังสือแนะนำในแนว ${selectedGenres.join(" & ")} สำหรับคุณ`}
                books={recommendedBooks}
                onBookClick={(bookId) => {
                  if (user?.id) logClick(user.id, bookId, "for_you");
                }}
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