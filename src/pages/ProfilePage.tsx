import { useState, useRef, useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { Camera, Save, User, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

/* =======================
   ✅ Review Type
======================= */
type ReviewItem = {
  reviewID: number;
  rating: number;
  comment: string;
  createdAt: string;
  book: {
    bookID: number;
    title: string;
    coverImage: string;
    slug: string;
  };
};

const ProfilePage = () => {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);

  /* =======================
     🔄 Sync Profile
  ======================= */
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setAvatarUrl(
        profile.avatar_url
          ? `${profile.avatar_url}?t=${Date.now()}`
          : ""
      );
    }
  }, [profile]);

  /* =======================
     📝 Fetch Reviews
  ======================= */
  useEffect(() => {
    if (!user) return;

    const fetchReviews = async () => {
      setReviewLoading(true);
      const { data, error } = await supabase
        .from("review" as any)
        .select(`
          reviewID,
          rating,
          comment,
          createdAt,
          book:bookID (
            bookID,
            title,
            coverImage,
            slug
          )
        `)
        .eq("user_id", user.id)
        .order("createdAt", { ascending: false }) as any;

      if (!error && data) {
        setReviews(data as ReviewItem[]);
      }
      setReviewLoading(false);
    };

    fetchReviews();
  }, [user]);

  /* =======================
     ⏳ Loading
  ======================= */
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-muted-foreground">
        กำลังโหลด...
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  /* =======================
     📸 Upload Avatar
  ======================= */
  const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "กรุณาเลือกไฟล์รูปภาพ", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "ไฟล์ต้องไม่เกิน 5MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
      toast({ title: "อัปโหลดรูปโปรไฟล์สำเร็จ ✅" });
    } catch (err: any) {
      toast({ title: "อัปโหลดล้มเหลว", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  /* =======================
     💾 Save Profile
  ======================= */
  const handleSave = async () => {
    if (!displayName.trim()) {
      toast({ title: "กรุณากรอกชื่อที่แสดง", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ userID: user.id, display_name: displayName.trim(), avatar_url: avatarUrl || null },
          { onConflict: "userID" });
      if (error) throw error;
      await refreshProfile();
      toast({ title: "บันทึกโปรไฟล์สำเร็จ ✅" });
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container max-w-2xl py-12 space-y-8">
      <h1 className="text-3xl font-bold font-display text-foreground">
        👤 โปรไฟล์ของฉัน
      </h1>

      {/* =====================
          ฟอร์มโปรไฟล์
      ===================== */}
      <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="group relative">
            <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-primary/20 bg-muted transition group-hover:scale-105">
              {avatarUrl ? (
                <img src={avatarUrl} alt="รูปโปรไฟล์" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label="อัปโหลดรูปโปรไฟล์"
              title="อัปโหลดรูปโปรไฟล์"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="เลือกไฟล์รูปโปรไฟล์"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }}
            />
          </div>
          {uploading && <p className="animate-pulse text-xs text-muted-foreground">กำลังอัปโหลด...</p>}
        </div>

        {/* Display Name */}
        <div className="space-y-1">
          <label htmlFor="displayName" className="text-sm font-medium text-muted-foreground">
            ชื่อที่แสดง
          </label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            placeholder="กรอกชื่อที่ต้องการแสดง"
          />
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-muted-foreground">
            อีเมล
          </label>
          <Input id="email" value={user.email || ""} disabled className="opacity-60" />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          <Save className="h-4 w-4" />
          {saving ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
        </Button>
      </div>

      {/* =====================
          รีวิวของฉัน
      ===================== */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">
          ⭐ รีวิวของฉัน
          {reviews.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({reviews.length} รายการ)
            </span>
          )}
        </h2>

        {reviewLoading ? (
          <div className="text-center py-8 text-muted-foreground animate-pulse">กำลังโหลด...</div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            ยังไม่มีรีวิว
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <Link
                key={r.reviewID}
                to={`/book/${r.book?.bookID}`}
                className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* ปกหนังสือ */}
                <img
                  src={r.book?.coverImage || "/placeholder.svg"}
                  alt={r.book?.title}
                  className="h-20 w-14 rounded-lg object-cover flex-shrink-0"
                />

                {/* เนื้อหา */}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-semibold text-sm text-foreground line-clamp-1">
                    {r.book?.title || "ไม่ทราบชื่อ"}
                  </p>

                  {/* ดาว */}
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${
                          s <= (r.rating ?? 0)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {r.rating}/5
                    </span>
                  </div>

                  {/* ความคิดเห็น */}
                  {r.comment && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {r.comment}
                    </p>
                  )}

                  {/* วันที่ */}
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;