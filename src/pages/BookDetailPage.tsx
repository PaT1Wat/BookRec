import { useParams, Link } from "react-router-dom";
import { Star, Heart, ArrowLeft, User, Building2, Send } from "lucide-react";
import { useBooks } from "@/context/BooksContext";
import { useFavorites } from "@/lib/favorites";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import BookCard from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

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
  const [myReview, setMyReview] = useState<Review | null>(null);

  /* =======================
     📝 Log interaction helper
  ======================= */
  const logInteraction = async (actionType: string, bookID: number) => {
    if (!user) return;

    try {
      await supabase.from("interaction" as any).insert({
        bookID,
        user_id: user.id,
        actionType,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.debug("Failed to log interaction:", actionType, err);
    }
  };

  /* =======================
     📥 Fetch Reviews
  ======================= */
  const fetchReviews = async (bookID: number): Promise<Review[]> => {
    setReviewLoading(true);
    let reviewsWithProfile: Review[] = [];

    const { data } = await supabase
      .from("review" as any)
      .select("reviewID, rating, comment, createdAt, user_id")
      .eq("bookID", bookID)
      .order("createdAt", { ascending: false }) as any;

    if (data) {
      reviewsWithProfile = await Promise.all(
        (data as Review[]).map(async (r) => {
          const { data: p } = await supabase
            .from("profiles" as any)
            .select("display_name, avatar_url")
            .eq("userID", r.user_id)
            .maybeSingle() as any;
          return { ...r, profiles: p ?? undefined };
        })
      );

      setReviews(reviewsWithProfile);

      if (user) {
        const mine = reviewsWithProfile.find((r) => r.user_id === user.id);
        if (mine) {
          setMyReview(mine);
          setMyRating(mine.rating);
          setComment(mine.comment || "");
        } else {
          setMyReview(null);
          setMyRating(0);
          setComment("");
        }
      }
    } else {
      setReviews([]);
      if (user) {
        setMyReview(null);
        setMyRating(0);
        setComment("");
      }
    }

    setReviewLoading(false);
    return reviewsWithProfile;
  };

  useEffect(() => {
    if (id) fetchReviews(Number(id));
  }, [id, user]);

  /* =======================
     👁️ Log view interaction
  ======================= */
  useEffect(() => {
    if (!id || !user) return;
    logInteraction("view", Number(id));
  }, [id, user]);

  /* =======================
     💾 Submit Review
  ======================= */
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
    const book = books.find((b) => b.id === id);
    const snapshot = book ? { rating: book.rating ?? 0, reviewCount: book.reviewCount ?? 0 } : null;

    try {
      if (book) {
        if (myReview) {
          const oldRating = myReview.rating ?? 0;
          const count = book.reviewCount ?? 0;
          const newAvg =
            count > 0
              ? ((book.rating ?? 0) * count - oldRating + myRating) / count
              : myRating;
          patchBook(String(id), { rating: Number(newAvg.toFixed(1)), reviewCount: count });
        } else {
          const oldRating = book.rating ?? 0;
          const oldCount = book.reviewCount ?? 0;
          const newCount = oldCount + 1;
          const newAvg =
            newCount > 0
              ? (oldRating * oldCount + myRating) / newCount
              : myRating;
          patchBook(String(id), { rating: Number(newAvg.toFixed(1)), reviewCount: newCount });
        }
      }

      if (myReview) {
        const { error } = await supabase
          .from("review" as any)
          .update({ rating: myRating, comment: comment.trim() })
          .eq("reviewID", myReview.reviewID);

        if (error) throw error;
        await logInteraction("review", Number(id));
        toast({ title: "แก้ไขรีวิวสำเร็จ ✅" });
      } else {
        const { error } = await supabase
          .from("review" as any)
          .insert({
            bookID: Number(id),
            user_id: user.id,
            rating: myRating,
            comment: comment.trim(),
            createdAt: new Date().toISOString(),
          });

        if (error) throw error;
        await logInteraction("review", Number(id));
        toast({ title: "รีวิวสำเร็จ ✅" });
      }

      try {
        const reviewsAfter = await fetchReviews(Number(id));
        const avg = reviewsAfter.length
          ? reviewsAfter.reduce((s, r) => s + (r.rating ?? 0), 0) / reviewsAfter.length
          : 0;

        if (id) {
          patchBook(String(id), {
            rating: Number(avg.toFixed(1)),
            reviewCount: reviewsAfter.length,
          });
        }
      } catch (e) {
        console.debug("Unable to refresh reviews after submit", e);
      }

      try {
        await refetchBooks();
      } catch (e) {
        console.debug("Failed to refetch books after submit", e);
      }
    } catch (err: any) {
      if (snapshot && id) {
        patchBook(String(id), {
          rating: snapshot.rating,
          reviewCount: snapshot.reviewCount,
        });
      }

      toast({
        title: "เกิดข้อผิดพลาด",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  /* =======================
     🗑️ Delete Review
  ======================= */
  const handleDelete = async () => {
    if (!myReview) return;

    const book = books.find((b) => b.id === id);
    const snapshot = book ? { rating: book.rating ?? 0, reviewCount: book.reviewCount ?? 0 } : null;

    try {
      if (book) {
        const oldRating = myReview.rating ?? 0;
        const oldCount = book.reviewCount ?? 0;
        const newCount = Math.max(0, oldCount - 1);
        const newAvg =
          newCount > 0
            ? (((book.rating ?? 0) * oldCount - oldRating) / newCount)
            : 0;

        patchBook(String(id), {
          rating: Number(newAvg.toFixed(1)),
          reviewCount: newCount,
        });
      }

      await supabase.from("review" as any).delete().eq("reviewID", myReview.reviewID);
      await logInteraction("review_delete", Number(id));

      setMyReview(null);
      setMyRating(0);
      setComment("");
      toast({ title: "ลบรีวิวสำเร็จ 🗑️" });

      try {
        await refetchBooks();
      } catch (e) {
        console.debug("Failed to refetch books after delete", e);
      }
    } catch (err: any) {
      if (snapshot && id) {
        patchBook(String(id), {
          rating: snapshot.rating,
          reviewCount: snapshot.reviewCount,
        });
      }

      toast({
        title: "เกิดข้อผิดพลาด",
        description: err.message,
        variant: "destructive",
      });
    }
  };

    /* =======================
     ❤️ Toggle Favorite + Log Interaction
  ======================= */
  const handleFavoriteToggle = async () => {
    try {
      const wasFav = check(book.id);

      await toggle(book.id);

      if (user && id) {
        await logInteraction(wasFav ? "unfavorite" : "favorite", Number(id));
      }
    } catch (err) {
      console.debug("Failed to toggle favorite from detail page:", err);
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

  const book = books.find((b) => b.id === id);

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
  const relatedBooks = books
    .filter((b) => b.id !== book.id && (b.genres ?? []).some((g) => genres.includes(g)))
    .slice(0, 4);

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length
    : (book.rating ?? 0);

  return (
    <div className="container py-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        กลับ
      </Link>

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
            {isFav ? "ลบออกจากชั้นหนังสือ" : "เพิ่มในชั้นหนังสือ"}
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
              <p className="mt-1 text-lg text-muted-foreground">{book.titleEn}</p>
            )}
          </div>

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
            <span className="text-lg font-bold text-foreground">{avgRating.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">({reviews.length} รีวิว)</span>
          </div>

          <div className="text-2xl font-bold text-primary">฿{book.price ?? 0}</div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-secondary p-3">
              <User className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">ผู้แต่ง</p>
                <p className="text-sm font-medium text-foreground">{book.author || "-"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-secondary p-3">
              <Building2 className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">สำนักพิมพ์</p>
                <p className="text-sm font-medium text-foreground">{book.publisher || "-"}</p>
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
                <span
                  key={t}
                  className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="mb-6 text-xl font-bold text-foreground font-display">
          ✍️ {myReview ? "แก้ไขรีวิวของคุณ" : "เขียนรีวิว"}
        </h2>

        {!user ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">
              เข้าสู่ระบบ
            </Link>{" "}
            เพื่อเขียนรีวิว
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

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                <Send className="h-4 w-4" />
                {submitting ? "กำลังบันทึก..." : myReview ? "แก้ไขรีวิว" : "ส่งรีวิว"}
              </Button>
              {myReview && (
                <Button variant="destructive" onClick={handleDelete}>
                  ลบรีวิว
                </Button>
              )}
            </div>
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
          <div className="text-center py-8 text-muted-foreground animate-pulse">กำลังโหลด...</div>
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
                        <span className="ml-2 text-xs text-primary font-normal">(คุณ)</span>
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {relatedBooks.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default BookDetailPage;