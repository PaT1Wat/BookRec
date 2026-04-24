import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ResetPasswordPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const checkRecoveryMode = async () => {
      const hash = window.location.hash;
      if (hash.includes("type=recovery")) {
        setIsRecovery(true);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setIsRecovery(true);
      }
    };

    checkRecoveryMode();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setIsRecovery(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว ✅",
      description: "ตรวจสอบอีเมลของคุณ",
    });
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast({
        title: "รหัสผ่านสั้นเกินไป",
        description: "กรุณาตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "รหัสผ่านไม่ตรงกัน",
        description: "กรุณาตรวจสอบรหัสผ่านอีกครั้ง",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setLoading(false);

    if (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "เปลี่ยนรหัสผ่านสำเร็จ! ✅",
      description: "กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่",
    });

    navigate("/login");
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary">
            <BookOpen className="h-7 w-7 text-primary-foreground" />
          </div>

          <h1 className="text-2xl font-bold">
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
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="รหัสผ่านใหม่"
                className="pl-10"
                required
                minLength={6}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="ยืนยันรหัสผ่านใหม่"
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
                onChange={(e) => setEmail(e.target.value)}
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