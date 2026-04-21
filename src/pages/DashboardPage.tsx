import { useEffect, useState, useMemo } from "react";
import {
  BarChart3,
  BookOpen,
  Users,
  Star,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBooks } from "@/context/BooksContext";

const DashboardPage = () => {
  const { books = [] } = useBooks();
  const [totalUsers, setTotalUsers] = useState(0);

  // ================= USERS =================
  useEffect(() => {
    const loadUsers = async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("userID", { count: "exact", head: true });

      if (error) {
        console.error("Error loading users:", error);
        return;
      }

      setTotalUsers(count ?? 0);
    };

    loadUsers();
  }, []);

  // ================= STATS =================
  const mangaCount = useMemo(
    () => books.filter((b) => b.type === "manga").length,
    [books]
  );

  const novelCount = useMemo(
    () => books.filter((b) => b.type === "novel").length,
    [books]
  );

  const lightNovelCount = useMemo(
    () => books.filter((b) => b.type === "light-novel").length,
    [books]
  );

  const avgRating = useMemo(() => {
    const rated = books.filter((b) => (b.rating ?? 0) > 0);
    if (!rated.length) return 0;
    const total = rated.reduce((s, b) => s + (b.rating ?? 0), 0);
    return +(total / rated.length).toFixed(1);
  }, [books]);

  const newCount = useMemo(
    () => books.filter((b) => b.isNew === true).length,
    [books]
  );

  const popularCount = useMemo(
    () => books.filter((b) => b.isPopular === true).length,
    [books]
  );

  // ================= TOP RATED =================
  const topRated = useMemo(() => {
    return [...books]
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 5);
  }, [books]);

  // ================= GENRE (จาก tags) =================
  const genreCounts = useMemo(() => {
    const genreMap = new Map<string, number>();

    books.forEach((b) => {
      // ใช้ทั้ง genres และ tags
      const allTags = [...(b.genres ?? []), ...(b.tags ?? [])];
      const unique = [...new Set(allTags)];
      unique.forEach((g) => {
        genreMap.set(g, (genreMap.get(g) || 0) + 1);
      });
    });

    return [...genreMap.entries()]
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // แสดงสูงสุด 10 แนว
  }, [books]);

  const maxGenreCount = genreCounts[0]?.count || 1;
  const totalBooks = books.length || 0;

  // deterministic color for a genre based on its string
  const genreColors = [
    "#7c3aed",
    "#60a5fa",
    "#34d399",
    "#fb7185",
    "#f59e0b",
    "#f97316",
    "#ef4444",
    "#06b6d4",
    "#a78bfa",
    "#10b981",
  ];

  const getGenreColor = (genre: string) => {
    let h = 0;
    for (let i = 0; i < genre.length; i++) {
      h = (h << 5) - h + genre.charCodeAt(i);
      h |= 0;
    }
    return genreColors[Math.abs(h) % genreColors.length];
  };

  // ================= STAT CARDS =================
  const statCards = [
    {
      label: "หนังสือทั้งหมด",
      value: books.length,
      icon: BookOpen,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "มังงะ",
      value: mangaCount,
      icon: BookOpen,
      color: "text-violet-500",
      bg: "bg-violet-50",
    },
    {
      label: "นิยาย",
      value: novelCount,
      icon: BookOpen,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
    {
      label: "ไลท์โนเวล",
      value: lightNovelCount,
      icon: BookOpen,
      color: "text-pink-500",
      bg: "bg-pink-50",
    },
    {
      label: "ผู้ใช้ทั้งหมด",
      value: totalUsers,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: "คะแนนเฉลี่ย",
      value: avgRating,
      icon: Star,
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      label: "มาใหม่",
      value: newCount,
      icon: Sparkles,
      color: "text-cyan-500",
      bg: "bg-cyan-50",
    },
    {
      label: "ยอดนิยม",
      value: popularCount,
      icon: TrendingUp,
      color: "text-orange-500",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="container py-8 space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold font-display flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ภาพรวมระบบ BookRec
        </p>
      </div>

      {/* ================= STAT CARDS ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border bg-card p-5 shadow-card hover:shadow-card-hover transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`rounded-lg p-2 ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <span className="text-xs text-muted-foreground">
                {s.label}
              </span>
            </div>
            <p className="text-3xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ================= MAIN ================= */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* ================= GENRE ================= */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-bold mb-4">📊 สัดส่วนแนวหนังสือ</h2>

          <div className="space-y-3">
            {genreCounts.map(({ genre, count }) => {
              const percent = totalBooks > 0 ? Math.round((count / totalBooks) * 100) : 0;
              const color = getGenreColor(genre);

              return (
                <div key={genre} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-muted-foreground truncate">
                    {genre}
                  </span>

                  <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full progress-bar transition-all duration-300"
                      style={{
                        width: `${percent}%`,
                        background: `linear-gradient(90deg, ${color}, ${color}66)`,
                      }}
                    role="progressbar"
                    aria-label={`แนว ${genre}`}
                    aria-valuenow={Number(percent) || 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                  </div>

                  <span className="text-sm font-medium w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}

            {genreCounts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                ยังไม่มีข้อมูลแนวหนังสือ
              </p>
            )}
          </div>
        </div>

        {/* ================= TOP RATED ================= */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-bold mb-4">⭐ หนังสือคะแนนสูงสุด</h2>

          <div className="space-y-3">
            {topRated.map((book, i) => (
              <div
                key={book.id}
                className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </span>

                <img
                  src={book.coverUrl || "/placeholder.svg"}
                  alt={book.title}
                  className="h-10 w-7 rounded object-cover shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{book.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {book.authorName || book.author || "ไม่ระบุผู้แต่ง"}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-bold">{book.rating ?? 0}</span>
                </div>
              </div>
            ))}

            {topRated.length === 0 && (
              <p className="text-sm text-muted-foreground">
                ยังไม่มีข้อมูลหนังสือ
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;