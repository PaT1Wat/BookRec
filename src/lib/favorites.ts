import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

/* =======================
   Hook
======================= */
export function useFavorites() {
  const { user } = useAuth();

  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  /* =======================
     📥 Fetch
  ======================= */
  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("favorite")
      .select("bookID")
      .eq("user_id", user.id);

    if (error) {
      console.error("Favorites error:", error);
    } else {
      setFavorites(
        (data ?? [])
          .filter((f) => f.bookID !== null)
          .map((f) => String(f.bookID))
      );
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  /* =======================
     ❤️ Toggle
  ======================= */
  const toggle = useCallback(
    async (bookId: string) => {
      if (!user) {
        alert("กรุณาเข้าสู่ระบบก่อน");
        return;
      }

      const numericID = Number(bookId);
      const isFav = favorites.includes(bookId);

      if (isFav) {
        await supabase
          .from("favorite")
          .delete()
          .eq("user_id", user.id)
          .eq("bookID", numericID);

        setFavorites((prev) => prev.filter((id) => id !== bookId));
      } else {
        await supabase.from("favorite").insert({
          user_id: user.id,
          bookID: numericID,
        });

        setFavorites((prev) => [...prev, bookId]);
      }
    },
    [favorites, user]
  );

  /* =======================
     ✅ Check
  ======================= */
  const check = useCallback(
    (bookId: string) => favorites.includes(bookId),
    [favorites]
  );

  return {
    favorites,
    toggle,
    check,
    loading,
    refetch: fetchFavorites,
  };
}