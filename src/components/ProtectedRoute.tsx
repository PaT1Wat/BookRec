import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  adminOnly?: boolean;
}

const ProtectedRoute = ({ children, adminOnly = false }: Props) => {
  const { user, isAdmin, loading } = useAuth();

  /* =======================
     ⏳ Loading
  ======================= */
  if (loading) {
    return (
      <div className="p-10 text-center">
        กำลังโหลด...
      </div>
    );
  }

  /* =======================
     🔒 ยังไม่ login
  ======================= */
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  /* =======================
     👑 admin only
  ======================= */
  if (adminOnly && !isAdmin) {
    return (
      <div className="p-10 text-center text-red-500">
        ❌ คุณไม่มีสิทธิ์เข้าหน้านี้
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;