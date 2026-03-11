import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, BookOpen } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const ResetPasswordPage = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if this is the recovery callback (has access_token in hash)
  const isRecovery = window.location.hash.includes("type=recovery");

  useEffect(() => {
    if (isRecovery) {
      // Supabase auto-sets session from the hash
    }
  }, [isRecovery]);

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว ✅", description: "ตรวจสอบอีเมลของคุณ" });
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "เปลี่ยนรหัสผ่านสำเร็จ! ✅" });
      navigate("/");
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary mb-4">
            <BookOpen className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground">
            {isRecovery ? "ตั้งรหัสผ่านใหม่" : "ลืมรหัสผ่าน"}
          </h1>
        </div>

        {isRecovery ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="รหัสผ่านใหม่"
                className="pl-10"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "กำลังดำเนินการ..." : "บันทึกรหัสผ่านใหม่"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSendReset} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="อีเมลของคุณ"
                className="pl-10"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
