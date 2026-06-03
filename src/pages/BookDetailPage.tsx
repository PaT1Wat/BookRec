import { useParams, Link, useNavigate  } from "react-router-dom";
import { Star, Heart, ArrowLeft, User, Building2, Send } from "lucide-react";
import { useState, useEffect, useLayoutEffect } from "react";

import { useBooks } from "@/context/BooksContext";
import { useFavorites } from "@/lib/favorites";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import BookCard from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { clearUserRecsCache } from "@/lib/recsCache";


type Review = {
  reviewID: number;
  rating: number;
  comment?: string;
  createdAt?: string;
  user_id: string;
  profiles?: {
    display_name?: string;
    avatar_url?: string;
  };
};

const BookDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { books = [], refetch: refetchBooks, patchBook } = useBooks();
  const { toggle, check } = useFavorites();
  const { user } = useAuth();
  const { toast } = useToast();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [myRating, setMyRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const book = books.find((b) => String(b.id ?? b.bookID) === String(id));

  const logInteraction = async (actionType: string, bookID: number) => {
    if (!user) return;

    await supabase.from("interaction" as any).insert({
      bookID,
      user_id: user.id,
      actionType,
      createdAt: new Date().toISOString(),
    });
  };

  const fetchReviews = async (bookID: number) => {
    setReviewLoading(true);

    const { data } = (await supabase
      .from("review" as any)
      .select("reviewID, rating, comment, createdAt, user_id")
      .eq("bookID", bookID)
      .order("createdAt", { ascending: false })) as any;

    const reviewsWithProfile: Review[] = await Promise.all(
      (data ?? []).map(async (r: Review) => {
        const { data: profile } = (await supabase
          .from("profiles" as any)
          .select("display_name, avatar_url")
          .eq("userID", r.user_id)
          .maybeSingle()) as any;

        return {
          ...r,
          profiles: profile ?? undefined,
        };
      })
    );

    setReviews(reviewsWithProfile);
    setReviewLoading(false);

    return reviewsWithProfile;
  };

  useEffect(() => {
    if (id) fetchReviews(Number(id));
  }, [id]);

  useEffect(() => {
    if (id && user) {
      const key = `viewed:${user.id}:${id}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        logInteraction("view", Number(id)).then(async () => {
          await new Promise((r) => setTimeout(r, 800));
          refetchBooks();
        });
      }
    }
  }, [id, user]);

  const updateBookRating = (reviewList: Review[]) => {
    if (!id) return;
    patchBook(String(id), { reviewCount: reviewList.length });
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "กรุณาเข้าสู่ระบบก่อน", variant: "destructive" });
      return;
    }

    if (myRating === 0) {
      toast({ title: "กรุณาให้คะแนนก่อน", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from("review" as any).upsert({
        bookID: Number(id),
        user_id: user.id,
        rating: myRating,
        comment: comment.trim(),
        createdAt: new Date().toISOString(),
      }, { onConflict: "bookID,user_id" });

      if (error) throw error;

      await supabase.from("interaction" as any).upsert({
        bookID: Number(id),
        user_id: user.id,
        actionType: "review",
        createdAt: new Date().toISOString(),
      }, { onConflict: "bookID,user_id,actionType" });

      const reviewsAfter = await fetchReviews(Number(id));
      updateBookRating(reviewsAfter);

      setMyRating(0);
      setHoverRating(0);
      setComment("");

      await refetchBooks();

      toast({ title: "ส่งความคิดเห็นสำเร็จ ✅" });
      clearUserRecsCache(user.id);
    } catch (err: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFavoriteToggle = async () => {
    if (!book) return;

    try {
      const wasFav = check(book.id);
      await toggle(book.id);

      if (user && id) {
        await logInteraction(wasFav ? "unfavorite" : "favorite", Number(id));
      }
      await refetchBooks();
    } catch {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถอัปเดตรายการโปรดได้",
        variant: "destructive",
      });
    }
  };

  if (!books.length) {
    return (
      <div className="container py-20 text-center">
        <p className="text-lg text-muted-foreground">กำลังโหลดข้อมูลหนังสือ...</p>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="container py-20 text-center">
        <p className="text-lg text-muted-foreground">ไม่พบหนังสือ</p>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">
          กลับหน้าแรก
        </Link>
      </div>
    );
  }

  const isFav = check(book.id);
  const genres = book.genres ?? [];
  const tags = book.tags ?? [];

  const favoriteCount     = Number((book as any).favoriteCount     ?? 0);
  const reviewActionCount = Number((book as any).reviewActionCount ?? 0);
  const viewCount         = Number((book as any).viewCount         ?? 0);

  // ✅ คะแนนเฉลี่ยจาก review เท่านั้น — ถ้ายังไม่มี review ใช้ค่าจาก DB
  const avgRating = Number(book.rating ?? 0);

  // interaction score ตาม recommend.py
  const reviewScore = reviews.length
    ? reviews.reduce((sum, r) => {
        const weight = Number(((r.rating / 5.0) * 6.0 - 1.0).toFixed(2));
        return sum + (weight > 0 ? weight : 0); // ตัด 1 ดาวออก
      }, 0)
    : reviewActionCount * 4.5; // fallback ถ้าไม่มี review data

  const interactionScore = Number(
    (favoriteCount * 5.0 + reviewScore + viewCount * 0.1).toFixed(1)
  );

  // ✅ interactions รวมทั้งหมด
  const totalInteractions = favoriteCount + reviewActionCount + viewCount;

  const relatedBooks = books
    .filter((b) => String(b.id ?? b.bookID) !== String(book.id ?? book.bookID))
    .map((b) => {
      const currentTags = book.tags ?? book.genres ?? [];
      const otherTags = b.tags ?? b.genres ?? [];
      const matchCount = otherTags.filter((tag: string) =>
        currentTags.includes(tag)
      ).length;

      return { book: b, matchCount };
    })
    .filter((item) => item.matchCount >= 2)
    .sort((a, b) => b.matchCount - a.matchCount)
    .map((item) => item.book)
    .slice(0, 10);

  return (
    <div className="container py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        กลับ
      </button>

      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl shadow-card">
            <img
              src={book.coverUrl || "/placeholder.jpg"}
              alt={book.title}
              className="w-full object-cover aspect-[2/3]"
            />
          </div>

          <button
            onClick={handleFavoriteToggle}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all ${
              isFav
                ? "bg-destructive/10 text-destructive border border-destructive/30"
                : "gradient-primary text-primary-foreground"
            }`}
          >
            <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
            {isFav ? "ลบออกจากหนังสือเล่มโปรด" : "เพิ่มในหนังสือเล่มโปรด"}
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {book.type === "manga"
                ? "มังงะ"
                : book.type === "light-novel"
                ? "ไลท์โนเวล"
                : "นิยาย"}
            </span>

            <h1 className="mt-3 text-3xl font-extrabold text-foreground font-display">
              {book.title}
            </h1>

            {book.titleEn && (
              <p className="mt-1 text-lg text-muted-foreground">
                {book.titleEn}
              </p>
            )}
          </div>

          {/* ⭐ ดาว — คำนวณจาก review เท่านั้น */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-5 w-5 ${
                    i < Math.round(avgRating)
                      ? "fill-star text-star"
                      : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            <span className="text-lg font-bold text-foreground">
              {avgRating.toFixed(1)}
            </span>

            {reviews.length > 0 && (
              <span className="text-sm text-muted-foreground">
                ({reviews.length} รีวิว)
              </span>
            )}
          </div>

          {/* 🔥 Interactions รวม */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>❤️ Favorite: {favoriteCount}</span>
            <span>💬 Review: {reviewActionCount}</span>
            <span>👁️ View: {viewCount}</span>
            ({interactionScore})
            <span className="font-medium text-foreground">
              🔥 {totalInteractions} interactions
            </span> 
          </div>

          <div className="text-2xl font-bold text-primary">฿{book.price ?? 0}</div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-secondary p-3">
              <User className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">ผู้แต่ง</p>
                <p className="text-sm font-medium text-foreground">
                  {book.author || "-"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-secondary p-3">
              <Building2 className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">สำนักพิมพ์</p>
                <p className="text-sm font-medium text-foreground">
                  {book.publisher || "-"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">เรื่องย่อ</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {book.description || "ไม่มีคำอธิบาย"}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">แนว & แท็ก</h3>
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <Link
                  key={g}
                  to={`/search?genre=${g}`}
                  className="rounded-full bg-tag-bg px-3 py-1 text-xs font-medium text-tag-fg hover:bg-primary/10 transition-colors"
                >
                  {g}
                </Link>
              ))}

              {tags.map((t) => (
                <span key={t} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="mb-6 text-xl font-bold text-foreground font-display">
          ✍️ แสดงความคิดเห็น
        </h2>

        {!user ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">
              เข้าสู่ระบบ
            </Link>{" "}
            เพื่อแสดงความคิดเห็น
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">คะแนน</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-label={`ให้ ${s} ดาว`}
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setMyRating(s)}
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        s <= (hoverRating || myRating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}

                {myRating > 0 && (
                  <span className="ml-2 self-center text-sm text-muted-foreground">
                    {myRating}/5
                  </span>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">ความคิดเห็น</p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="เขียนความคิดเห็นของคุณ..."
                rows={3}
                className="w-full rounded-xl border border-border bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              <Send className="h-4 w-4" />
              {submitting ? "กำลังบันทึก..." : "ส่งความคิดเห็น"}
            </Button>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-6 text-xl font-bold text-foreground font-display">
          💬 รีวิวทั้งหมด
          {reviews.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({reviews.length} รีวิว)
            </span>
          )}
        </h2>

        {reviewLoading ? (
          <div className="text-center py-8 text-muted-foreground animate-pulse">
            กำลังโหลด...
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            ยังไม่มีรีวิว — เป็นคนแรกที่รีวิวหนังสือเล่มนี้!
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div
                key={r.reviewID}
                className={`rounded-2xl border p-4 space-y-2 ${
                  r.user_id === user?.id
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                    {r.profiles?.avatar_url ? (
                      <img
                        src={r.profiles.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {r.profiles?.display_name || "ผู้ใช้งาน"}
                      {r.user_id === user?.id && (
                        <span className="ml-2 text-xs text-primary font-normal">
                          (คุณ)
                        </span>
                      )}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {r.createdAt
                        ? new Date(r.createdAt).toLocaleDateString("th-TH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : ""}
                    </p>
                  </div>

                  <div className="ml-auto flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-4 w-4 ${
                          s <= (r.rating ?? 0)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {r.comment && (
                  <p className="text-sm text-muted-foreground leading-relaxed pl-12">
                    {r.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {relatedBooks.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-6 text-xl font-bold text-foreground font-display">
            📚 หนังสือที่คล้ายกัน
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {relatedBooks.map((b) => (
              <div key={String(b.id ?? b.bookID)} className="scale-90 origin-top">
                <BookCard book={b} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default BookDetailPage;