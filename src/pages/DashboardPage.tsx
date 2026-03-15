import { useEffect, useState } from "react";
import { BarChart3, BookOpen, Users, Star, TrendingUp, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBooks } from "@/context/BooksContext";

interface Stats {
  totalUsers: number;
  mangaCount: number;
  novelCount: number;
  avgRating: number;
  newCount: number;
  popularCount: number;
  topRated: { title: string; rating: number }[];
  genreCounts: { genre: string; count: number }[];
}

const DashboardPage = () => {
  const { books } = useBooks();
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    supabase.from("profiles").select("id", { count: "exact", head: true }).then(({ count }) => {
      setTotalUsers(count ?? 0);
    });
  }, []);

  const mangaCount = books.filter((b) => b.type === "manga").length;
  const novelCount = books.filter((b) => b.type === "novel").length;
  const avgRating = books.length ? +(books.reduce((s, b) => s + b.rating, 0) / books.length).toFixed(1) : 0;
  const newCount = books.filter((b) => b.isNew).length;
  const popularCount = books.filter((b) => b.isPopular).length;
  const topRated = [...books].sort((a, b) => b.rating - a.rating).slice(0, 5);

  // Genre distribution
  const genreMap = new Map<string, number>();
  books.forEach((b) => b.genres.forEach((g) => genreMap.set(g, (genreMap.get(g) || 0) + 1)));
  const genreCounts = [...genreMap.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
  const maxGenreCount = genreCounts[0]?.count || 1;

  const statCards = [
    { label: "หนังสือทั้งหมด", value: books.length, icon: BookOpen, color: "text-primary" },
    { label: "มังงะ", value: mangaCount, icon: BookOpen, color: "text-accent" },
    { label: "นิยาย", value: novelCount, icon: BookOpen, color: "text-primary" },
    { label: "ผู้ใช้ทั้งหมด", value: totalUsers, icon: Users, color: "text-accent" },
    { label: "คะแนนเฉลี่ย", value: avgRating, icon: Star, color: "text-[hsl(var(--star))]" },
    { label: "มาใหม่", value: newCount, icon: Sparkles, color: "text-primary" },
    { label: "ยอดนิยม", value: popularCount, icon: TrendingUp, color: "text-accent" },
  ];

  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display text-foreground flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" /> Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">ภาพรวมระบบ BookRec</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-hover)]"
          >
            <div className="flex items-center justify-between mb-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Genre Distribution */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-bold font-display text-foreground mb-4">📊 สัดส่วนแนวหนังสือ</h2>
          <div className="space-y-3">
            {genreCounts.map(({ genre, count }) => (
              <div key={genre} className="flex items-center gap-3">
                <span className="w-24 text-sm text-muted-foreground truncate">{genre}</span>
                <div className="flex-1 h-6 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[image:var(--gradient-primary)] transition-all duration-500"
                    style={{ width: `${(count / maxGenreCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-foreground w-8 text-right">{count}</span>
              </div>
            ))}
            {genreCounts.length === 0 && (
              <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลแนวหนังสือ</p>
            )}
          </div>
        </div>

        {/* Top Rated */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-bold font-display text-foreground mb-4">⭐ หนังสือคะแนนสูงสุด</h2>
          <div className="space-y-3">
            {topRated.map((book, i) => (
              <div
                key={book.id}
                className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="h-10 w-7 rounded object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{book.title}</p>
                  <p className="text-xs text-muted-foreground">{book.author}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                  <span className="text-sm font-bold text-foreground">{book.rating}</span>
                </div>
              </div>
            ))}
            {topRated.length === 0 && (
              <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลหนังสือ</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
