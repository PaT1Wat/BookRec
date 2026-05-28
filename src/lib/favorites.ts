import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { clearUserRecsCache } from "@/lib/recsCache";

// ─── Module-level shared state ────────────────────────────────────────────────
// ✅ ทุก component ที่เรียก useFavorites() ใช้ state ชุดเดียวกัน
// ✅ toggle ที่ BookCard → FavoritesPage อัปเดตทันที ไม่ต้อง re-fetch

let _sharedFavorites: string[] = [];
let _loadedForUser: string | null = null;
const _listeners = new Set<(favs: string[]) => void>();

function notifyAll(favs: string[]) {
  _sharedFavorites = favs;
  _listeners.forEach((fn) => fn(favs));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>(_sharedFavorites);

  // ─── subscribe ──────────────────────────────────────────────────────────
  useEffect(() => {
    const listener = (favs: string[]) => setFavorites([...favs]);
    _listeners.add(listener);
    setFavorites([..._sharedFavorites]); // sync ค่าล่าสุดตอน mount
    return () => { _listeners.delete(listener); };
  }, []);

  // ─── fetch จาก Supabase (เฉพาะตอน user เปลี่ยน) ────────────────────────
  useEffect(() => {
    if (!user) {
      _loadedForUser = null;
      notifyAll([]);
      return;
    }

    // ถ้า user เดิมแล้วมีข้อมูลอยู่แล้ว → ไม่ fetch ซ้ำ
    if (_loadedForUser === user.id && _sharedFavorites.length > 0) return;

    const fetchFavorites = async () => {
      const { data, error } = await supabase
        .from("favorite")
        .select("bookID")
        .eq("user_id", user.id);

      if (!error) {
        const ids = (data ?? []).filter((f) => f.bookID !== null).map((f) => String(f.bookID));
        _loadedForUser = user.id;
        notifyAll(ids);
      }
    };

    fetchFavorites();
  }, [user?.id]);

  // ─── toggle ─────────────────────────────────────────────────────────────
  const toggle = useCallback(async (bookId: string) => {
    if (!user) { alert("กรุณาเข้าสู่ระบบก่อน"); return; }

    const numericID = Number(bookId);
    const isFav = _sharedFavorites.includes(bookId);

    // ✅ อัปเดต shared state ทันที → ทุก component เห็นพร้อมกัน
    const next = isFav
      ? _sharedFavorites.filter((id) => id !== bookId)
      : [..._sharedFavorites, bookId];
    notifyAll(next);

    // sync กับ Supabase
    if (isFav) {
      await supabase.from("favorite").delete().eq("user_id", user.id).eq("bookID", numericID);
    } else {
      await supabase.from("favorite").insert({ user_id: user.id, bookID: numericID });
    }

    // trigger re-fetch recommendations
    clearUserRecsCache(user.id);
  }, [user]);

  // ─── check ──────────────────────────────────────────────────────────────
  const check = useCallback((bookId: string) => favorites.includes(bookId), [favorites]);

  // ─── refetch ─────────────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("favorite").select("bookID").eq("user_id", user.id);
    const ids = (data ?? []).filter((f) => f.bookID !== null).map((f) => String(f.bookID));
    _loadedForUser = user.id;
    notifyAll(ids);
  }, [user]);

  return { favorites, toggle, check, loading: false, refetch };
}