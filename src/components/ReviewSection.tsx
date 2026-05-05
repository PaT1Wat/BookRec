import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Review = {
  reviewID: number;
  user_id: string | null;
  rating: number | null;
  comment: string | null;
  createdAt: string | null;
};

function StarRating({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          aria-label={readonly ? `คะแนน ${star} ดาว` : `ให้ ${star} ดาว`}
          onClick={() => onChange?.(star)}
          className={readonly ? "cursor-default" : "hover:scale-110 transition"}
        >
          <Star
            className={`h-5 w-5 ${
              star <= value ? "fill-star text-star" : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ReviewSection({ bookId }: { bookId: string }) {
  const { user } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("review")
      .select("reviewID, user_id, rating, comment, createdAt")
      .eq("bookID", Number(bookId))
      .order("createdAt", { ascending: false });

    if (error) {
      console.error("fetch reviews error:", error);
      setReviews([]);
    } else {
      setReviews((data || []) as Review[]);
    }

    setLoading(false);
  };

  const trackReviewInteraction = async () => {
    if (!user?.id) return;

    const { error } = await supabase.from("interaction").insert({
      bookID: Number(bookId),
      user_id: user.id,
      actionType: "review",
      createdAt: new Date().toISOString(),
    });

    if (error) console.error("track interaction error:", error);
  };

  useEffect(() => {
    fetchReviews();
  }, [bookId]);

  const userReview = reviews.find((review) => review.user_id === user?.id);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("กรุณาเข้าสู่ระบบก่อนรีวิว");
      return;
    }

    if (rating === 0) {
      toast.error("กรุณาให้คะแนนก่อนส่งรีวิว");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("review").insert({
      bookID: Number(bookId),
      user_id: user.id,
      rating,
      comment: comment.trim() || null,
      createdAt: new Date().toISOString(),
    });

    if (error) {
      console.error("submit review error:", error);
      toast.error("เกิดข้อผิดพลาดในการส่งรีวิว");
      setSubmitting(false);
      return;
    }

    await trackReviewInteraction();

    toast.success("รีวิวสำเร็จ");
    setRating(0);
    setComment("");
    setSubmitting(false);
    fetchReviews();
  };

  return (
    <section className="mt-12 space-y-6">
      <h2 className="text-xl font-bold text-foreground font-display">
        💬 รีวิวจากผู้อ่าน ({reviews.length})
      </h2>

      {user && !userReview && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold">เขียนรีวิวของคุณ</h3>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">คะแนน:</span>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <Textarea
            placeholder="เขียนความคิดเห็น... (ไม่บังคับ)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            className="resize-none"
          />

          <Button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="gradient-primary text-primary-foreground"
          >
            {submitting ? "กำลังส่ง..." : "ส่งรีวิว"}
          </Button>
        </div>
      )}

      {!user && (
        <p className="text-sm text-muted-foreground">เข้าสู่ระบบเพื่อเขียนรีวิว</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลดรีวิว...</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          ยังไม่มีรีวิว เป็นคนแรกที่รีวิวเลย!
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.reviewID}
              className="rounded-xl border border-border bg-card p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">ผู้ใช้</p>
                <StarRating value={review.rating ?? 0} readonly />
              </div>

              {review.createdAt && (
                <p className="text-xs text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString("th-TH")}
                </p>
              )}

              {review.comment && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {review.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}