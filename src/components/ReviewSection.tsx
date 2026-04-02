import { useState, useEffect, useCallback } from "react";
import { Star, Trash2, Edit2, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Review {
  id: string;
  book_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  profile?: { display_name: string | null; avatar_url: string | null };
}

function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          disabled={readonly}
          className={`transition-transform ${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => onChange?.(i)}
        >
          <Star className={`h-5 w-5 ${i <= (hover || value) ? "fill-star text-star" : "text-muted-foreground/30"}`} />
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState("");

  const fetchReviews = useCallback(async () => {
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("book_id", bookId)
      .order("created_at", { ascending: false });

    if (!data) return;

    // Fetch profiles for review authors
    const userIds = [...new Set(data.map(r => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    setReviews(data.map(r => ({ ...r, profile: profileMap.get(r.user_id) || undefined })));
    setLoading(false);
  }, [bookId]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`reviews-${bookId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews", filter: `book_id=eq.${bookId}` }, () => {
        fetchReviews();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bookId, fetchReviews]);

  const userReview = reviews.find(r => r.user_id === user?.id);

  const handleSubmit = async () => {
    if (!user) { toast.error("กรุณาเข้าสู่ระบบก่อนรีวิว"); return; }
    if (rating === 0) { toast.error("กรุณาให้คะแนน"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("reviews").insert({ book_id: bookId, user_id: user.id, rating, comment: comment.trim() });
    setSubmitting(false);
    if (error) { toast.error("เกิดข้อผิดพลาด"); return; }
    toast.success("รีวิวสำเร็จ!");
    setRating(0);
    setComment("");
  };

  const handleUpdate = async (id: string) => {
    if (editRating === 0) { toast.error("กรุณาให้คะแนน"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("reviews").update({ rating: editRating, comment: editComment.trim() }).eq("id", id);
    setSubmitting(false);
    if (error) { toast.error("เกิดข้อผิดพลาด"); return; }
    toast.success("แก้ไขรีวิวสำเร็จ!");
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) { toast.error("เกิดข้อผิดพลาด"); return; }
    toast.success("ลบรีวิวสำเร็จ");
  };

  const startEdit = (r: Review) => {
    setEditingId(r.id);
    setEditRating(r.rating);
    setEditComment(r.comment);
  };

  return (
    <section className="mt-12 space-y-6">
      <h2 className="text-xl font-bold text-foreground font-display">💬 รีวิวจากผู้อ่าน ({reviews.length})</h2>

      {/* Review Form - only if user is logged in and hasn't reviewed yet */}
      {user && !userReview && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">เขียนรีวิวของคุณ</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">คะแนน:</span>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <Textarea
            placeholder="เขียนความคิดเห็น... (ไม่บังคับ)"
            value={comment}
            onChange={e => setComment(e.target.value)}
            maxLength={1000}
            className="resize-none"
          />
          <Button onClick={handleSubmit} disabled={submitting || rating === 0} className="gradient-primary text-primary-foreground">
            {submitting ? "กำลังส่ง..." : "ส่งรีวิว"}
          </Button>
        </div>
      )}

      {!user && (
        <p className="text-sm text-muted-foreground">เข้าสู่ระบบเพื่อเขียนรีวิว</p>
      )}

      {/* Review List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลดรีวิว...</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีรีวิว เป็นคนแรกที่รีวิวเลย!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {r.profile?.avatar_url ? (
                    <img src={r.profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {(r.profile?.display_name || "?")[0]}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.profile?.display_name || "ผู้ใช้"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("th-TH")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingId !== r.id && <StarRating value={r.rating} readonly />}
                  {user?.id === r.user_id && editingId !== r.id && (
                    <div className="flex gap-1 ml-2">
                      <button onClick={() => startEdit(r)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {editingId === r.id ? (
                <div className="space-y-3 pt-2">
                  <StarRating value={editRating} onChange={setEditRating} />
                  <Textarea value={editComment} onChange={e => setEditComment(e.target.value)} maxLength={1000} className="resize-none" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(r.id)} disabled={submitting}>
                      <Check className="h-4 w-4 mr-1" /> บันทึก
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4 mr-1" /> ยกเลิก
                    </Button>
                  </div>
                </div>
              ) : (
                r.comment && <p className="text-sm text-muted-foreground leading-relaxed">{r.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
