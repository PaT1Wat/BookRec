import { Link, useLocation } from "react-router-dom";
import { BookOpen, Search, Heart, Home, Settings, LogIn, LogOut, User, BarChart3 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  const location = useLocation();
  const { user, profile, isAdmin, signOut } = useAuth();

  const links = [
    { to: "/", label: "หน้าแรก", icon: Home },
    { to: "/search", label: "ค้นหา", icon: Search },
    { to: "/favorites", label: "ชั้นหนังสือ", icon: Heart },
    ...(isAdmin ? [{ to: "/dashboard", label: "สถิติ", icon: BarChart3 }, { to: "/admin", label: "จัดการ", icon: Settings }] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold font-display text-foreground">
            BookRec
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                location.pathname === to
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}

          {user ? (
            <div className="flex items-center gap-2 ml-2">
              <Link
                to="/profile"
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors ${
                  location.pathname === "/profile"
                    ? "bg-primary/10 ring-1 ring-primary/30"
                    : "bg-secondary hover:bg-secondary/80"
                }`}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="hidden sm:inline text-xs font-medium text-foreground">
                  {profile?.display_name || user.email?.split("@")[0]}
                </span>
              </Link>
              <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Link to="/auth">
              <Button variant="default" size="sm" className="ml-2 gap-1">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">เข้าสู่ระบบ</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
