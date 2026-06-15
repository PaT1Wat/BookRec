import { useEffect, useState, useMemo } from "react";
import {
  BarChart3, BookOpen, Users, Star, TrendingUp,
  Heart, Eye, MessageSquare, Sparkles, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBooks } from "@/context/BooksContext";

type InteractionStat = {
  bookID: number;
  favoriteCount: number | null;
  reviewCount: number | null;
  reviewActionCount: number | null;
  viewCount: number | null;
  rating: number | null;
};

type RecentReview = {
  reviewID: number;
  rating: number | null;
  comment: string | null;
  createdAt: string | null;
  user_id: string | null;
  bookID: number;
};

const GENRE_COLORS = [
  "#E24B4A","#7F77DD","#1D9E75","#378ADD","#D85A30",
  "#D4537E","#BA7517","#639922","#888780","#185FA5","#0F6E56","#993556",
];

function getColor(i: number) { return GENRE_COLORS[i % GENRE_COLORS.length]; }

function StatCard({
  label, value, sub, icon: Icon, color, bg, loading,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.FC<any>; color: string; bg: string; loading?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card hover:shadow-card-hover transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <div
          className="rounded-lg p-2.5"
          // eslint-disable-next-line react/forbid-component-props
          style={{ backgroundColor: bg, color }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      {loading ? (
        <div className="h-8 w-20 rounded-md bg-muted animate-pulse" />
      ) : (
        <>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </>
      )}
    </div>
  );
}

const DashboardPage = () => {
  const { books = [], allBooks: allBooksRaw = [], loading: booksLoading } = useBooks();

  const [totalUsers, setTotalUsers] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [totalFavorites, setTotalFavorites] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [interactionStats, setInteractionStats] = useState<InteractionStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalImpressions, setTotalImpressions] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [topCTRBooks, setTopCTRBooks] = useState<{bookID: number; title: string; coverUrl: string; impressions: number; clicks: number; ctr: number}[]>([]);

  const visibleBooks = useMemo(() => books.filter((b) => !b.isHidden), [books]);
  // allBooksRaw includes hidden books — used for hidden count stat
  const hiddenCount = allBooksRaw.filter((b) => b.isHidden).length;

  // bookID → book lookup (number key for reliable matching)
  const bookByNumId = useMemo(() => {
    const m = new Map<number, typeof books[0]>();
    books.forEach((b) => {
      const id = Number(b.bookID ?? b.id);
      if (!isNaN(id)) m.set(id, b);
    });
    return m;
  }, [books]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const db = supabase as any;

      const [
        { data: userCountData },
        { data: reviewData },
        { data: statsData },
        { data: impressionData },
      ] = await Promise.all([
        db.rpc("get_user_count"),
        db.from("review")
          .select("reviewID, rating, comment, createdAt, user_id, bookID")
          .order("createdAt", { ascending: false })
          .limit(5),
        db.from("book_interaction_stats").select("*"),
        db.from("rec_impression").select("bookID, clicked"),
      ]);

      setTotalUsers(userCountData ?? 0);
      setRecentReviews(reviewData ?? []);
      setInteractionStats(statsData ?? []);

      const stats = statsData ?? [];
      setTotalFavorites(stats.reduce((s: number, r: any) => s + Number(r.favoriteCount ?? 0), 0));
      setTotalViews(stats.reduce((s: number, r: any) => s + Number(r.viewCount ?? 0), 0));
      setTotalReviews(stats.reduce((s: number, r: any) => s + Number(r.reviewCount ?? 0), 0));

      const impressions = impressionData ?? [];
      setTotalImpressions(impressions.length);
      setTotalClicks(impressions.filter((r: any) => r.clicked).length);

      const bookImpressionMap = new Map<number, { impressions: number; clicks: number }>();
      impressions.forEach((r: any) => {
        const cur = bookImpressionMap.get(r.bookID) ?? { impressions: 0, clicks: 0 };
        bookImpressionMap.set(r.bookID, {
          impressions: cur.impressions + 1,
          clicks: cur.clicks + (r.clicked ? 1 : 0),
        });
      });

      const topCTR = [...bookImpressionMap.entries()]
        .filter(([, v]) => v.impressions >= 5)
        .map(([bookID, v]) => ({
          bookID,
          impressions: v.impressions,
          clicks: v.clicks,
          ctr: Math.round((v.clicks / v.impressions) * 100),
        }))
        .sort((a, b) => b.ctr - a.ctr)
        .slice(0, 5);

      // หมายเหตุ: bookByNumId ยังไม่พร้อมตอน loadStats ทำงาน
      // เลยเก็บแค่ bookID ไว้ก่อน แล้วแปลงใน useMemo แทน
      setTopCTRBooks(topCTR.map((item) => ({
        ...item,
        title: "",
        coverUrl: "",
      })));

    } catch (err) {
      console.error("Dashboard stats error:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  // ── Derived counts ────────────────────────────────────────────────────────
  const mangaCount = useMemo(() => visibleBooks.filter((b) => b.type === "manga").length, [visibleBooks]);
  const novelCount = useMemo(() => visibleBooks.filter((b) => b.type === "novel").length, [visibleBooks]);
  const lightNovelCount = useMemo(() => visibleBooks.filter((b) => b.type === "light-novel").length, [visibleBooks]);

  const avgRating = useMemo(() => {
    const statsMap = new Map(interactionStats.map((s) => [s.bookID, s]));
    const rated = visibleBooks.filter((b) => {
      const s = statsMap.get(Number(b.bookID ?? b.id));
      return Number(s?.reviewCount ?? 0) > 0;
    });
    if (!rated.length) return "—";
    const total = rated.reduce((sum, b) => {
      const s = statsMap.get(Number(b.bookID ?? b.id));
      return sum + Number(s?.rating ?? b.rating ?? 0);
    }, 0);
    return (total / rated.length).toFixed(1);
  }, [visibleBooks, interactionStats]);

  // ── Genre counts (deduplicated per book) ─────────────────────────────────
  const genreCounts = useMemo(() => {
    const map = new Map<string, number>();
    visibleBooks.forEach((b) => {
      const seen = new Set<string>();
      (b.tags ?? []).forEach((t: string) => {
        const key = t.trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        map.set(key, (map.get(key) ?? 0) + 1);
      });
    });
    return [...map.entries()]
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [visibleBooks]);

  const maxGenreCount = genreCounts[0]?.count || 1;

  // ── Top books by interaction score ───────────────────────────────────────
  const topBooks = useMemo(() => {
    const statsMap = new Map(interactionStats.map((s) => [s.bookID, s]));
    return [...visibleBooks]
      .map((b) => {
        const s = statsMap.get(Number(b.bookID ?? b.id));
        const score =
          Number(s?.favoriteCount ?? 0) * 5 +
          Number(s?.reviewActionCount ?? 0) * 4.5 +
          Number(s?.viewCount ?? 0) * 0.1;
        return { book: b, stat: s, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [visibleBooks, interactionStats]);

  // ── Top rated (≥1 real review) ───────────────────────────────────────────
  const topRatedBooks = useMemo(() => {
    const statsMap = new Map(interactionStats.map((s) => [s.bookID, s]));
    return [...visibleBooks]
      .filter((b) => Number(statsMap.get(Number(b.bookID ?? b.id))?.reviewCount ?? 0) >= 1)
      .sort((a, b) => {
        const rA = Number(statsMap.get(Number(a.bookID ?? a.id))?.rating ?? 0);
        const rB = Number(statsMap.get(Number(b.bookID ?? b.id))?.rating ?? 0);
        return rB - rA;
      })
      .slice(0, 5);
  }, [visibleBooks, interactionStats]);

  // ── Top CTR books (resolve title จาก bookByNumId) ─────────────────────────
  const topCTRBooksResolved = useMemo(() => {
    return topCTRBooks.map((item) => {
      const book = bookByNumId.get(item.bookID);
      return {
        ...item,
        title: book?.title ?? "—",
        coverUrl: book?.coverUrl ?? "",
      };
    });
  }, [topCTRBooks, bookByNumId]);

  const isLoading = booksLoading || statsLoading;

  return (
    <div className="container py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">ภาพรวมระบบ BookRec</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          รีเฟรช
        </button>
      </div>

      {/* Row 1: คลังหนังสือ */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">คลังหนังสือ</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="หนังสือทั้งหมด" value={visibleBooks.length}
            sub={hiddenCount > 0 ? `${hiddenCount} เล่มถูกซ่อน` : undefined}
            icon={BookOpen} color="#378ADD" bg="#E6F1FB" loading={isLoading} />
          <StatCard label="มังงะ" value={mangaCount}
            icon={BookOpen} color="#7F77DD" bg="#EEEDFE" loading={isLoading} />
          <StatCard label="นิยาย" value={novelCount}
            icon={BookOpen} color="#1D9E75" bg="#E1F5EE" loading={isLoading} />
          <StatCard label="ไลท์โนเวล" value={lightNovelCount}
            icon={Sparkles} color="#D4537E" bg="#FBEAF0" loading={isLoading} />
        </div>
      </div>

      {/* Row 2: การมีส่วนร่วม */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">การมีส่วนร่วม</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="ผู้ใช้ทั้งหมด" value={totalUsers}
            icon={Users} color="#378ADD" bg="#E6F1FB" loading={statsLoading} />
          <StatCard label="คะแนนเฉลี่ย" value={avgRating}
            sub="เฉพาะเล่มที่มีรีวิว"
            icon={Star} color="#BA7517" bg="#FAEEDA" loading={isLoading} />
          <StatCard label="รีวิวทั้งหมด" value={totalReviews}
            icon={MessageSquare} color="#1D9E75" bg="#E1F5EE" loading={statsLoading} />
          <StatCard label="ยอดวิวรวม" value={totalViews.toLocaleString()}
            icon={Eye} color="#7F77DD" bg="#EEEDFE" loading={statsLoading} />

          <StatCard
            label="CTR รวมทั้งระบบ (ทุกผู้ใช้)"
            value={totalImpressions > 0 ? `${Math.round((totalClicks / totalImpressions) * 100)}%` : "—"}
            sub={`${totalClicks} คลิก จาก ${totalImpressions} ครั้ง (หนังสือที่แนะนำ)`}
            icon={TrendingUp}
            color="#639922"
            bg="#EEF5E1"
            loading={statsLoading}
          />
        </div>
      </div>

      {/* Row 3: Genre chart + Top rated */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Genre chart */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-base font-semibold mb-5 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            สัดส่วนแนวหนังสือ
          </h2>
          <div className="space-y-2.5">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-20 h-3 rounded bg-muted animate-pulse" />
                    <div className="flex-1 h-5 rounded-full bg-muted animate-pulse" />
                    <div className="w-6 h-3 rounded bg-muted animate-pulse" />
                  </div>
                ))
              : genreCounts.map(({ genre, count }, i) => {
                  const pct = Math.round((count / maxGenreCount) * 100);
                  const color = getColor(i);
                  return (
                    <div key={genre} className="flex items-center gap-3">
                      <span className="w-24 text-xs text-muted-foreground truncate text-right" title={genre}>
                        {genre}
                      </span>
                      <div className="flex-1 h-5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          // eslint-disable-next-line react/forbid-component-props
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-6 text-right">{count}</span>
                    </div>
                  );
                })}
            {!isLoading && genreCounts.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีข้อมูล</p>
            )}
          </div>
        </div>

        {/* Top rated */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-base font-semibold mb-5 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            หนังสือคะแนนสูงสุด
            <span className="text-xs font-normal text-muted-foreground ml-1">(จากรีวิวจริง)</span>
          </h2>
          <div className="space-y-3">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg p-2">
                    <div className="h-7 w-7 rounded-full bg-muted animate-pulse" />
                    <div className="h-10 w-7 rounded bg-muted animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-full rounded bg-muted animate-pulse" />
                      <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
                    </div>
                  </div>
                ))
              : topRatedBooks.map((book, i) => {
                  const stat = interactionStats.find(
                    (s) => s.bookID === Number(book.bookID ?? book.id)
                  );
                  const rating = Number(stat?.rating ?? book.rating ?? 0);
                  return (
                    <div key={book.id} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5 hover:bg-muted/70 transition-colors">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          i === 0
                            ? "bg-amber-100 text-amber-700"
                            : i === 1
                            ? "bg-gray-100 text-gray-600"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <img src={book.coverUrl || "/placeholder.svg"} alt={book.title}
                        className="h-10 w-7 rounded object-cover shrink-0 shadow-sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{book.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {book.authorName || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-sm font-bold text-foreground">{rating.toFixed(1)}</span>
                      </div>
                    </div>
                  );
                })}
            {!isLoading && topRatedBooks.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีหนังสือที่ถูกรีวิว</p>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Most interacted + Recent reviews */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Most interacted */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-base font-semibold mb-5 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            หนังสือยอดนิยม
            <span className="text-xs font-normal text-muted-foreground ml-1">(จาก interaction score)</span>
          </h2>
          <div className="space-y-3">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <div className="h-10 w-7 rounded bg-muted animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-full rounded bg-muted animate-pulse" />
                      <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                    </div>
                  </div>
                ))
              : topBooks.map(({ book, stat }) => {
                  const fav = Number(stat?.favoriteCount ?? 0);
                  const rev = Number(stat?.reviewActionCount ?? 0);
                  const view = Number(stat?.viewCount ?? 0);
                  return (
                    <div key={book.id} className="flex items-center gap-3 rounded-lg hover:bg-muted/40 px-2 py-2 transition-colors">
                      <img src={book.coverUrl || "/placeholder.svg"} alt={book.title}
                        className="h-10 w-7 rounded object-cover shrink-0 shadow-sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{book.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {fav > 0 && (
                            <span className="flex items-center gap-0.5 text-[11px] text-red-500">
                              <Heart className="h-2.5 w-2.5 fill-current" />{fav}
                            </span>
                          )}
                          {rev > 0 && (
                            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                              <MessageSquare className="h-2.5 w-2.5" />{rev}
                            </span>
                          )}
                          {view > 0 && (
                            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                              <Eye className="h-2.5 w-2.5" />{view}
                            </span>
                          )}
                        </div>
                      </div>
                      {stat?.rating && Number(stat.rating) > 0 && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-semibold text-foreground">
                            {Number(stat.rating).toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
            {!isLoading && topBooks.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีข้อมูล interaction</p>
            )}
          </div>
        </div>

        {/* Recent reviews */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-base font-semibold mb-5 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            รีวิวล่าสุด
          </h2>
          <div className="space-y-3">
            {statsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-2">
                    <div className="h-10 w-7 rounded bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-3/4 rounded bg-muted animate-pulse" />
                      <div className="h-3 w-full rounded bg-muted animate-pulse" />
                    </div>
                  </div>
                ))
              : recentReviews.length > 0
              ? recentReviews.map((r) => {
                  const book = bookByNumId.get(Number(r.bookID));
                  return (
                    <div key={r.reviewID} className="flex gap-3 rounded-lg hover:bg-muted/40 px-2 py-2 transition-colors">
                      {book?.coverUrl ? (
                        <img src={book.coverUrl} alt={book.title}
                          className="h-10 w-7 rounded object-cover shrink-0 shadow-sm" />
                      ) : (
                        <div className="h-10 w-7 rounded bg-muted shrink-0 flex items-center justify-center">
                          <BookOpen className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {book?.title ?? "—"}
                        </p>
                        <div className="flex gap-0.5 mt-0.5 mb-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s}
                              className={`h-3 w-3 ${s <= (r.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                            />
                          ))}
                        </div>
                        {r.comment && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{r.comment}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                          {r.createdAt
                            ? new Date(r.createdAt).toLocaleDateString("th-TH", {
                                year: "numeric", month: "short", day: "numeric",
                              })
                            : ""}
                        </p>
                      </div>
                    </div>
                  );
                })
              : (
                <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีรีวิว</p>
              )}
          </div>
        </div>

      </div> {/* ← ปิด Row 4 grid */}

      {/* Row 5: CTR Table */}
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <h2 className="text-base font-semibold mb-5 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          หนังสือที่ถูกคลิกจากระบบแนะนำมากที่สุด
          <span className="text-xs font-normal text-muted-foreground ml-1">(CTR)</span>
        </h2>
        {statsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-7 rounded bg-muted animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-2 w-full rounded-full bg-muted animate-pulse" />
                </div>
                <div className="w-10 h-4 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        ) : topCTRBooksResolved.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีข้อมูล CTR</p>
        ) : (
          <div className="space-y-3">
            {topCTRBooksResolved.map((item, i) => (
              <div key={item.bookID} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                <img src={item.coverUrl || "/placeholder.svg"} alt={item.title}
                  className="h-10 w-7 rounded object-cover shrink-0 shadow-sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${item.ctr}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {item.clicks}/{item.impressions}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-bold text-primary shrink-0">{item.ctr}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default DashboardPage;