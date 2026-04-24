import { useState, useRef, useEffect, useMemo } from "react";
import { Navigate, Link } from "react-router-dom";
import {
  Camera,
  Save,
  User,
  Star,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

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
  } | null;
};

const ProfilePage = () => {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setAvatarUrl(profile.avatar_url ? `${profile.avatar_url}?t=${Date.now()}` : "");
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;

    const fetchReviews = async () => {
      setReviewLoading(true);

      const { data, error } = (await supabase
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
        .order("createdAt", { ascending: false })) as any;

      if (error) {
        console.error("fetchReviews error:", error);
        setReviews([]);
      } else {
        setReviews((data as ReviewItem[]) || []);
      }

      setReviewLoading(false);
    };

    fetchReviews();
  }, [user]);

  const stats = useMemo(() => {
    const reviewCount = reviews.length;

    const avgRating =
      reviewCount > 0
        ? (
            reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviewCount
          ).toFixed(1)
        : "0.0";

    return {
      reviewCount,
      avgRating,
      favoriteGenre: "ยังไม่มีข้อมูล",
      topGenres: [] as string[],
    };
  }, [reviews]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-muted-foreground">
        กำลังโหลด...
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

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
      toast({
        title: "อัปโหลดล้มเหลว",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast({ title: "กรุณากรอกชื่อที่แสดง", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("profiles").upsert(
        {
          userID: user.id,
          display_name: displayName.trim(),
          avatar_url: avatarUrl || null,
        },
        { onConflict: "userID" }
      );

      if (error) throw error;

      await refreshProfile();
      toast({ title: "บันทึกโปรไฟล์สำเร็จ ✅" });
    } catch (err: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container max-w-5xl py-10 space-y-8">
      <div className="flex items-center gap-3">
        <User className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold font-display text-foreground">
          โปรไฟล์ของฉัน
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="group relative">
              <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-primary/20 bg-muted transition group-hover:scale-105">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="รูปโปรไฟล์"
                    className="h-full w-full object-cover"
                  />
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
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarUpload(f);
                }}
              />
            </div>

            {uploading && (
              <p className="animate-pulse text-xs text-muted-foreground">
                กำลังอัปโหลด...
              </p>
            )}

            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">
                {displayName || "ผู้ใช้"}
              </h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-center">
              <div className="text-xl font-bold text-foreground">
                {stats.reviewCount}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">รีวิว</div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-center">
              <div className="text-xl font-bold text-foreground">
                {stats.avgRating}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">คะแนนเฉลี่ย</div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-center">
              <div className="flex min-h-[32px] items-center justify-center">
                {stats.favoriteGenre !== "ยังไม่มีข้อมูล" ? (
                  <span className="inline-flex max-w-full items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    <span className="line-clamp-1">{stats.favoriteGenre}</span>
                  </span>
                ) : (
                  <span className="text-base font-semibold text-muted-foreground">-</span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {stats.favoriteGenre !== "ยังไม่มีข้อมูล" ? "แนวโปรด" : "ยังไม่มีข้อมูล"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              ข้อมูลโปรไฟล์
            </h2>
            <p className="text-sm text-muted-foreground">
              จัดการข้อมูลที่ใช้แสดงบนเว็บไซต์
            </p>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="displayName"
              className="text-sm font-medium text-muted-foreground"
            >
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

          <div className="space-y-1">
            <label
              htmlFor="email"
              className="text-sm font-medium text-muted-foreground"
            >
              อีเมล
            </label>
            <Input
              id="email"
              value={user.email || ""}
              disabled
              className="opacity-60"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            <Save className="h-4 w-4" />
            {saving ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">รสนิยมการอ่านของคุณ</h2>
        </div>

        {stats.topGenres.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {stats.topGenres.map((genre) => (
              <span
                key={genre}
                className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
              >
                {genre}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            ยังไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์แนวที่คุณชอบ
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
          <h2 className="text-xl font-bold text-foreground">
            รีวิวของฉัน
            {reviews.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({reviews.length} รายการ)
              </span>
            )}
          </h2>
        </div>

        {reviewLoading ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground animate-pulse">
            กำลังโหลดรีวิว...
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">ยังไม่มีรีวิวของคุณ</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {reviews.map((r) => (
              <Link
                key={r.reviewID}
                to={`/book/${r.book?.bookID}`}
                className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
              >
                <img
                  src={r.book?.coverImage || "/placeholder.svg"}
                  alt={r.book?.title}
                  className="h-24 w-16 rounded-lg object-cover flex-shrink-0"
                />

                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="font-semibold text-foreground line-clamp-1">
                    {r.book?.title || "ไม่ทราบชื่อ"}
                  </p>

                  <div className="flex items-center gap-0.5">
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
                    <span className="ml-1 text-xs text-muted-foreground">
                      {r.rating}/5
                    </span>
                  </div>

                  {r.comment && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {r.comment}
                    </p>
                  )}

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