import { useState, useRef, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Camera, Save, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const ProfilePage = () => {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

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
      // Add cache-busting param
      const url = `${data.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);
      toast({ title: "อัปโหลดรูปโปรไฟล์สำเร็จ ✅" });
    } catch (err: any) {
      toast({ title: "อัปโหลดล้มเหลว", description: err.message, variant: "destructive" });
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
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          avatar_url: avatarUrl || null,
        })
        .eq("user_id", user.id);
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
    <div className="container max-w-lg py-12">
      <h1 className="text-3xl font-bold font-display text-foreground mb-8">👤 โปรไฟล์ของฉัน</h1>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-6 shadow-sm">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative group">
            <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-primary/20 bg-muted">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAvatarUpload(file);
              }}
            />
          </div>
          {uploading && (
            <p className="text-xs text-muted-foreground animate-pulse">กำลังอัปโหลด...</p>
          )}
        </div>

        {/* Display Name */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">ชื่อที่แสดง</label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            placeholder="กรอกชื่อที่ต้องการแสดง"
          />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">อีเมล</label>
          <Input value={user.email || ""} disabled className="opacity-60" />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          <Save className="h-4 w-4" />
          {saving ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
        </Button>
      </div>
    </div>
  );
};

export default ProfilePage;
