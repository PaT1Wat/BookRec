import { useState, useRef, useEffect, useMemo } from "react";
import { Navigate, Link } from "react-router-dom";
import { Camera, Save, User, Star, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import GenreOnboardingModal from "@/components/GenreOnboardingModal";
import { clearUserRecsCache } from "@/lib/recsCache";

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

const REVIEWS_PER_PAGE = 6;

// ✅ Strip cache-busting query string before saving to DB
function cleanAvatarUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.searchParams.delete("t");
    return u.toString();
  } catch {
    return url.split("?")[0];
  }
}

// ✅ Add cache-busting for display only
function displayAvatarUrl(url: string): string {
  if (!url) return "";
  const base = cleanAvatarUrl(url);
  return `${base}?t=${Date.now()}`;
}

const ProfilePage = () => {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(""); // ✅ always stores clean URL (no ?t=)
  const [avatarDisplayUrl, setAvatarDisplayUrl] = useState(""); // ✅ display URL with cache-bust
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [interestTags, setInterestTags] = useState<string[]>([]);
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      // ✅ store clean URL in state, show cache-busted URL for display
      const clean = cleanAvatarUrl(profile.avatar_url || "");
      setAvatarUrl(clean);
      setAvatarDisplayUrl(clean ? displayAvatarUrl(clean) : "");
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

  useEffect(() => {
    if (!user) return;

    const fetchTags = async () => {
      const { data, error } = await supabase
        .from("user_tags")
        .select(`tagID, tag:tagID (tagName, tagType)`)
        .eq("user_id", user.id);

      if (error) {
        console.error("fetchTags error:", error);
        setInterestTags([]);
        return;
      }

      const names =
        data
          ?.filter((item: any) => item.tag?.tagType === "genre")
          .map((item: any) => item.tag?.tagName)
          .filter(Boolean) || [];

      setInterestTags(names);
    };

    fetchTags();
  }, [user]);

  const stats = useMemo(() => {
    const reviewCount = reviews.length;
    const avgRating =
      reviewCount > 0
        ? (
            reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) /
            reviewCount
          ).toFixed(1)
        : "0.0";
    return { reviewCount, avgRating, topGenres: interestTags };
  }, [reviews, interestTags]);

  const totalPages = Math.ceil(reviews.length / REVIEWS_PER_PAGE);
  const paginatedReviews = reviews.slice(
    (currentPage - 1) * REVIEWS_PER_PAGE,
    currentPage * REVIEWS_PER_PAGE
  );

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

      // ✅ store clean URL, show cache-busted for immediate display
      const clean = cleanAvatarUrl(data.publicUrl);
      setAvatarUrl(clean);
      setAvatarDisplayUrl(displayAvatarUrl(clean));

      toast({ title: "อัปโหลดรูปโปรไฟล์สำเร็จ ✅" });
    } catch (err: any) {
      toast({
        title: "อัปโหลดล้มเหลว",
        description: err?.message || "ไม่สามารถอัปโหลดรูปได้",
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
      const cleanName = displayName.trim();
      // ✅ always save clean URL (no ?t=) to DB
      const cleanUrl = cleanAvatarUrl(avatarUrl);

      const { data: existingProfile } = await supabase
       .from("profiles")
       .select("avatar_url")
       .eq("userID", user.id)
       .maybeSingle();

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          userID: user.id,
          display_name: cleanName,
          // ✅ ถ้ามี avatar อยู่แล้วใน DB ให้ใช้อันนั้น ไม่ทับด้วย Google
          avatar_url: cleanUrl,
        },
        { onConflict: "userID" }
      );
      if (profileError) throw profileError;

      const { error: userError } = await supabase
        .from("user")
        .update({
          userName: cleanName,
          display_name: cleanName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (userError) throw userError;

      await refreshProfile();

      toast({
        title: "บันทึกโปรไฟล์สำเร็จ ✅",
        description: "อัปเดตชื่อที่แสดงเรียบร้อยแล้ว",
      });
    } catch (err: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: err?.message || "บันทึกโปรไฟล์ไม่สำเร็จ",
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

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left card */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="group relative">
              <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-primary/20 bg-muted transition group-hover:scale-105">
                {avatarDisplayUrl ? (
                  <img
                    src={avatarDisplayUrl}
                    alt="รูปโปรไฟล์"
                    className="h-full w-full object-cover"
                    onError={() => setAvatarDisplayUrl("")}
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
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="เลือกรูปโปรไฟล์"
                title="เลือกรูปโปรไฟล์"
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

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-5 text-center">
              <div className="text-2xl font-bold text-foreground">{stats.reviewCount}</div>
              <div className="mt-1 text-xs text-muted-foreground">รีวิว</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-5 text-center">
              <div className="text-2xl font-bold text-foreground">{stats.avgRating}</div>
              <div className="mt-1 text-xs text-muted-foreground">คะแนนเฉลี่ย</div>
            </div>

            <div className="col-span-2 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-4 text-left">
              <p className="text-xs font-semibold text-muted-foreground">
                แนวหนังสือที่สนใจ
              </p>
              <button
                type="button"
                onClick={() => setShowGenreModal(true)}
                className="text-xs font-bold text-primary hover:underline"
              >
                แก้ไขแนวที่ชอบ
              </button>
              {stats.topGenres.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {stats.topGenres.slice(0, 4).map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  ยังไม่มีข้อมูลแนวหนังสือที่ชอบ
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right card */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">ข้อมูลโปรไฟล์</h2>
            <p className="text-sm text-muted-foreground">
              จัดการข้อมูลที่ใช้แสดงบนเว็บไซต์
            </p>
          </div>

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
      </div>

      {/* Reviews Section */}
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
          <div className="rounded-3xl border border-border bg-card p-8 text-center text-muted-foreground animate-pulse">
            กำลังโหลดรีวิว...
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">ยังไม่มีรีวิวของคุณ</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4">
              {paginatedReviews.map((r) => (
                <Link
                  key={r.reviewID}
                  to={`/book/${r.book?.bookID}`}
                  className="flex gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                  <img
                    src={r.book?.coverImage || "/placeholder.svg"}
                    alt={r.book?.title || "หนังสือ"}
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

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← ก่อนหน้า
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`h-9 w-9 rounded-xl text-sm font-medium transition ${
                        currentPage === i + 1
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "border border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ถัดไป →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <GenreOnboardingModal
        userId={user.id}
        open={showGenreModal}
        onDone={() => {
          clearUserRecsCache(user.id);
          setShowGenreModal(false);
          window.location.reload();
        }}
      />
    </div>
  );
};

export default ProfilePage;