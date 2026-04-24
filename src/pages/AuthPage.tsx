import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, Eye, EyeOff, BookOpen } from "lucide-react";
import GenreOnboardingModal from "@/components/GenreOnboardingModal";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    user,
    loading: authLoading,
    needsGenreOnboarding,
    refreshProfile,
  } = useAuth();

  useEffect(() => {
    if (authLoading || !user) return;
    if (needsGenreOnboarding) return;

    navigate("/");
  }, [user, authLoading, needsGenreOnboarding, navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({ title: "เข้าสู่ระบบสำเร็จ 🎉" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
            },
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        toast({
          title: "สมัครสมาชิกสำเร็จ ✅",
          description: "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ",
        });

        setIsLogin(true);
      }
    } catch (err: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleOnboardingDone = async () => {
    await refreshProfile();
    navigate("/");
  };

  return (
    <>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <BookOpen className="h-7 w-7 text-white" />
            </div>

            <h1 className="text-2xl font-bold">
              {isLogin ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              {isLogin
                ? "ยินดีต้อนรับกลับมา!"
                : "สร้างบัญชีเพื่อเริ่มต้นใช้งาน"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border py-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <span>🔵</span>
            เข้าสู่ระบบด้วย Google
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">หรือ</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="ชื่อที่แสดง"
                  className="pl-10"
                  required
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="อีเมล"
                className="pl-10"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                className="pl-10 pr-10"
                required
                minLength={6}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "กำลังดำเนินการ..."
                : isLogin
                ? "เข้าสู่ระบบ"
                : "สมัครสมาชิก"}
            </Button>
          </form>

          <p className="text-center text-sm">
            {isLogin ? "ยังไม่มีบัญชี? " : "มีบัญชีแล้ว? "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="font-medium text-primary"
            >
              {isLogin ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
            </button>
          </p>
        </div>
      </div>

      {user && (
        <GenreOnboardingModal
          userId={user.id}
          open={needsGenreOnboarding}
          onDone={handleOnboardingDone}
        />
      )}
    </>
  );
};

export default AuthPage;