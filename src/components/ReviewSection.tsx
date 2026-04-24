import { useState, useEffect, useCallback } from "react";
import { Star, Trash2, Edit2, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

type ReviewRow = Tables<"review">;
type ProfileRow = Tables<"profiles">;

interface ReviewWithProfile extends ReviewRow {
  profile?: Pick<ProfileRow, "display_name" | "avatar_url">;
}

function StarRating({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={readonly}
          aria-label={readonly ? `คะแนน ${i} ดาว` : `ให้ ${i} ดาว`}
          title={readonly ? `คะแนน ${i} ดาว` : `ให้ ${i} ดาว`}
          className={`transition-transform ${
            readonly ? "cursor-default" : "cursor-pointer hover:scale-110"
          }`}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => onChange?.(i)}
        >
          <Star
            className={`h-5 w-5 ${
              i <= (hover || value)
                ? "fill-star text-star"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function hasMeaningfulComment(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return { valid: true, reason: "" };
  }

  if (trimmed.length < 4) {
    return {
      valid: false,
      reason: "กรุณาเขียนความคิดเห็นให้ยาวขึ้นอีกเล็กน้อย",
    };
  }

  if (!/[A-Za-zก-๙]/.test(trimmed)) {
    return {
      valid: false,
      reason: "กรุณาเขียนความคิดเห็นเป็นข้อความปกติ",
    };
  }

  if (/^(.)\1+$/.test(trimmed)) {
    return {
      valid: false,
      reason: "กรุณาเขียนความคิดเห็นให้มีความหมาย",
    };
  }

  const compact = trimmed.replace(/\s+/g, "");

  const englishOnly = /^[A-Za-z\s]+$/.test(trimmed);
  if (englishOnly) {
    const vowelCount = (compact.match(/[aeiouAEIOU]/g) || []).length;
    if (compact.length >= 4 && vowelCount === 0) {
      return {
        valid: false,
        reason: "กรุณาเขียนเป็นคำภาษาอังกฤษที่มีความหมาย",
      };
    }
  }

  const thaiOnly = /^[ก-๙\s]+$/.test(trimmed);
  if (thaiOnly) {
    const hasThaiVowel = /[ะาิีึืุูเแโใไำๅ]/.test(compact);
    if (compact.length >= 4 && !hasThaiVowel) {
      return {
        valid: false,
        reason: "กรุณาเขียนเป็นคำภาษาไทยที่มีความหมาย",
      };
    }
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1 && compact.length < 6) {
    return {
      valid: false,
      reason: "กรุณาเขียนความคิดเห็นให้ละเอียดขึ้น",
    };
  }

  return { valid: true, reason: "" };
}

export default function ReviewSection({ bookId }: { bookId: string }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState("");

  const commentValidation = hasMeaningfulComment(comment);
  const editCommentValidation = hasMeaningfulComment(editComment);

  const fetchReviews = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("review")
      .select("reviewID, bookID, user_id, rating, comment, createdAt")
      .eq("bookID", Number(bookId))
      .order("createdAt", { ascending: false });

    if (error) {
      console.error("fetchReviews error:", error);
      setReviews([]);
      setLoading(false);
      return;
    }

    const reviewRows: ReviewRow[] = Array.isArray(data) ? data : [];

    if (reviewRows.length === 0) {
      setReviews([]);
      setLoading(false);
      return;
    }

    const userIds = [
      ...new Set(
        reviewRows
          .map((r) => r.user_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      ),
    ];

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("userID, display_name, avatar_url")
      .in("userID", userIds);

    if (profilesError) {
      console.error("fetch profiles error:", profilesError);
    }

    const profileMap = new Map((profilesData ?? []).map((p) => [p.userID, p]));

    const merged: ReviewWithProfile[] = reviewRows.map((r) => ({
      ...r,
      profile: r.user_id
        ? (() => {
            const profile = profileMap.get(r.user_id);
            return profile
              ? {
                  display_name: profile.display_name ?? null,
                  avatar_url: profile.avatar_url ?? null,
                }
              : undefined;
          })()
        : undefined,
    }));

    setReviews(merged);
    setLoading(false);
  }, [bookId]);

  const recomputeRecommendations = useCallback(async () => {
    if (!user?.id) return;

    try {
      const resp = await fetch(`${BACKEND_URL}/recommend/${user.id}`);
      if (!resp.ok) {
        console.error("recompute recommendation failed:", resp.status);
      } else {
        const json = await resp.json();
        console.log("[review] recompute recommendations:", json);
      }
    } catch (err) {
      console.error("recompute recommendation error:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    const channel = supabase
      .channel(`review-${bookId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "review",
          filter: `bookID=eq.${Number(bookId)}`,
        },
        () => {
          fetchReviews();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookId, fetchReviews]);

  const userReview = reviews.find((r) => r.user_id === user?.id);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("กรุณาเข้าสู่ระบบก่อนรีวิว");
      return;
    }

    if (rating === 0) {
      toast.error("กรุณาให้คะแนน");
      return;
    }

    if (!commentValidation.valid) {
      toast.error(commentValidation.reason);
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

    setSubmitting(false);

    if (error) {
      console.error("submit review error:", error);
      toast.error("เกิดข้อผิดพลาด");
      return;
    }

    await recomputeRecommendations();

    toast.success("รีวิวสำเร็จ!");
    setRating(0);
    setComment("");
    fetchReviews();
  };

  const handleUpdate = async (id: number) => {
    if (editRating === 0) {
      toast.error("กรุณาให้คะแนน");
      return;
    }

    if (!editCommentValidation.valid) {
      toast.error(editCommentValidation.reason);
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from("review")
      .update({
        rating: editRating,
        comment: editComment.trim() || null,
      })
      .eq("reviewID", id);

    setSubmitting(false);

    if (error) {
      console.error("update review error:", error);
      toast.error("เกิดข้อผิดพลาด");
      return;
    }

    await recomputeRecommendations();

    toast.success("แก้ไขรีวิวสำเร็จ!");
    setEditingId(null);
    fetchReviews();
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("review").delete().eq("reviewID", id);

    if (error) {
      console.error("delete review error:", error);
      toast.error("เกิดข้อผิดพลาด");
      return;
    }

    await recomputeRecommendations();

    toast.success("ลบรีวิวสำเร็จ");
    fetchReviews();
  };

  const startEdit = (r: ReviewWithProfile) => {
    setEditingId(r.reviewID);
    setEditRating(r.rating ?? 0);
    setEditComment(r.comment ?? "");
  };

  return (
    <section className="mt-12 space-y-6">
      <h2 className="text-xl font-bold text-foreground font-display">
        💬 รีวิวจากผู้อ่าน ({reviews.length})
      </h2>

      {user && !userReview && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">
            เขียนรีวิวของคุณ
          </h3>

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

          {!commentValidation.valid && comment.trim().length > 0 && (
            <p className="text-sm text-destructive">{commentValidation.reason}</p>
          )}

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
          {reviews.map((r) => (
            <div
              key={r.reviewID}
              className="rounded-xl border border-border bg-card p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {r.profile?.avatar_url ? (
                    <img
                      src={r.profile.avatar_url}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {(r.profile?.display_name || "ผู้ใช้")[0]}
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {r.profile?.display_name || "ผู้ใช้"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.createdAt
                        ? new Date(r.createdAt).toLocaleDateString("th-TH")
                        : "-"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {editingId !== r.reviewID && (
                    <StarRating value={r.rating ?? 0} readonly />
                  )}

                  {user?.id === r.user_id && editingId !== r.reviewID && (
                    <div className="flex gap-1 ml-2">
                      <button
                        type="button"
                        aria-label="แก้ไขรีวิว"
                        title="แก้ไขรีวิว"
                        onClick={() => startEdit(r)}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        aria-label="ลบรีวิว"
                        title="ลบรีวิว"
                        onClick={() => handleDelete(r.reviewID)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {editingId === r.reviewID ? (
                <div className="space-y-3 pt-2">
                  <StarRating value={editRating} onChange={setEditRating} />

                  <Textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    maxLength={1000}
                    className="resize-none"
                  />

                  {!editCommentValidation.valid && editComment.trim().length > 0 && (
                    <p className="text-sm text-destructive">
                      {editCommentValidation.reason}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(r.reviewID)}
                      disabled={submitting}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      บันทึก
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              ) : (
                r.comment && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {r.comment}
                  </p>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}