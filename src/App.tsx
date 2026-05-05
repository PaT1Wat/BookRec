import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import { BooksProvider } from "@/context/BooksContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";

import Navbar from "@/components/Navbar";

import GenreOnboardingGate from "./components/GenreOnboardingGate"; // 🔥 เพิ่ม

import Index from "./pages/Index";
import SearchPage from "./pages/SearchPage";
import BookDetailPage from "./pages/BookDetailPage";
import FavoritesPage from "./pages/FavoritesPage";
import AdminPage from "./pages/AdminPage";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ProfilePage from "./pages/ProfilePage";
import DashboardPage from "./pages/DashboardPage";
import NotFound from "./pages/NotFound";
import AIChatButton from "./components/AIChatButton";

/* =======================
   🔥 React Query
======================= */
const queryClient = new QueryClient();

/* =======================
   🔐 Admin Route Guard
======================= */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center text-center">
        <p className="text-xl font-bold text-destructive">
          ⛔ ไม่มีสิทธิ์เข้าถึง
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          หน้านี้สำหรับผู้ดูแลระบบเท่านั้น
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/* =======================
   🎯 Layout Control
======================= */
function AppContent() {
  const location = useLocation();

  const hideNavbarRoutes = ["/auth", "/reset-password"];

  return (
    <>
      {/* 🔥 POPUP GLOBAL */}
      <GenreOnboardingGate />

      {/* Navbar */}
      {!hideNavbarRoutes.includes(location.pathname) && <Navbar />}

      {/* Routes */}
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/book/:id" element={<BookDetailPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        {/* 🔥 Admin */}
        <Route
          path="/dashboard"
          element={
            <AdminRoute>
              <DashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      <AIChatButton />
    </>
  );
}

/* =======================
   🚀 Main App
======================= */
const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <BooksProvider>
            <Toaster />
            <Sonner />

            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </BooksProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;