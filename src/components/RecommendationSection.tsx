import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useBooks } from "@/context/BooksContext";
import BookCard from "@/components/BookCard";
import type { Book } from "@/data/books";
import { useFavorites } from "@/lib/favorites";

const TARGET_COUNT = 12;

// ✅ helper: คำนวณ interactions รวมของหนังสือ 1 เล่ม
const getInteractionScore = (b: any): number => {
  return (
    Number((b as any).favoriteCount     ?? 0) +
    Number((b as any).reviewActionCount ?? 0) +
    Number((b as any).viewCount         ?? 0)
  );
};

export default function RecommendationSection() {
  const { user } = useAuth();
  const { books } = useBooks();
  const { favorites } = useFavorites();
  const [recBooks, setRecBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const favoriteSet = new Set((favorites ?? []).map(String));

  const getTags = (book: any): string[] =>
    ((book.tags ?? book.genres ?? []) as string[]).map((t) => t.toLowerCase());

  // ✅ Cache key รวม interaction state ด้วย (0 = ไม่มี, 1 = มี)
  const getCacheKey = useCallback(
    (userId?: string, hasInteraction = false) =>
      `recs:${userId ?? "guest"}:${hasInteraction ? "1" : "0"}`,
    []
  );

  const fetchRecs = useCallback(async () => {
    if (!user?.id || books.length === 0) return;
    setLoading(true);

    try {
      const db = supabase as any;
      const bookMap = new Map<string, Book>();
      for (const b of books) {
        bookMap.set(String(b.id), b);
        if (b.bookID != null) bookMap.set(String(b.bookID), b);
      }

      // โหลด profile tags + interactions พร้อมกัน
      const [userTagsRes, interactionsRes] = await Promise.all([
        supabase
          .from("user_tags")
          .select("tagID, tag:tagID (tagName, tagType)")
          .eq("user_id", user.id),
        db.from("interaction").select("bookID, actionType").eq("user_id", user.id),
      ]);

      const profileTags = (userTagsRes.data ?? [])
        .filter((i: any) => i.tag?.tagType === "genre")
        .map((i: any) => i.tag?.tagName?.toLowerCase())
        .filter(Boolean);

      const interactionBookIds: string[] = [
        ...new Set(
          ((interactionsRes.data ?? []) as any[]).map((i: any) => String(i.bookID))
        ),
      ];

      const hasInteraction = interactionBookIds.length > 0;

      // ✅ เช็ค cache ด้วย key ที่รวม interaction state
      const cacheKey = getCacheKey(user.id, hasInteraction);
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { ids, ts } = JSON.parse(cached);
          if (Date.now() - ts < 60 * 60 * 1000 && ids?.length > 0) {
            const cachedBooks = ids
              .map((id: string) => bookMap.get(id))
              .filter(Boolean) as Book[];
            if (cachedBooks.length > 0) {
              setRecBooks(cachedBooks);
              setLoading(false);
              return;
            }
          }
        }
      } catch {}

      const interactionTags = interactionBookIds.flatMap((id) => {
        const book = bookMap.get(id);
        return book ? getTags(book) : [];
      });

      const used = new Set<string>();

      // ✅ เรียงตาม interactions รวม แทน rating
      const pickBooks = (targetTags: string[], count: number): Book[] => {
        if (targetTags.length === 0) return [];
        const result = books
          .filter((b: any) => {
            const id = String(b.bookID ?? b.id);
            if (used.has(id) || favoriteSet.has(id)) return false;
            return getTags(b).some((t: string) => targetTags.includes(t));
          })
          .sort((a: any, b: any) => {
            // ✅ เรียงตาม interactions รวม ก่อน แล้วค่อย reviewCount เป็น tiebreaker
            const diff = getInteractionScore(b) - getInteractionScore(a);
            return diff !== 0 ? diff : Number(b.reviewCount ?? 0) - Number(a.reviewCount ?? 0);
          })
          .slice(0, count);
        result.forEach((b: any) => used.add(String(b.bookID ?? b.id)));
        return result;
      };

      let finalBooks: Book[];

      if (hasInteraction) {
        // ✅ มี interaction → 6 จาก profile tags + 6 จาก interaction tags
        const poolA = pickBooks(profileTags, 6);
        const poolB = pickBooks(interactionTags, 6);

        // เติมถ้า pool ว่าง
        if (poolA.length === 0 || poolB.length === 0) {
          const fallback = books
            .filter((b: any) => !used.has(String(b.bookID ?? b.id)) && !favoriteSet.has(String(b.bookID ?? b.id)))
            // ✅ fallback ก็เรียงตาม interactions รวม
            .sort((a: any, b: any) => getInteractionScore(b) - getInteractionScore(a))
            .slice(0, TARGET_COUNT - poolA.length - poolB.length);
          finalBooks = [...poolA, ...poolB, ...fallback].slice(0, TARGET_COUNT);
        } else {
          finalBooks = [...poolA, ...poolB];
        }
      } else {
        // ✅ ไม่มี interaction → 12 จาก profile tags
        finalBooks = pickBooks(profileTags, TARGET_COUNT);

        // ถ้าไม่มีแท็กเลย → global popular by interactions
        if (finalBooks.length === 0) {
          finalBooks = [...books]
            .filter((b: any) => !favoriteSet.has(String(b.bookID ?? b.id)))
            // ✅ เรียงตาม interactions รวม
            .sort((a: any, b: any) => getInteractionScore(b) - getInteractionScore(a))
            .slice(0, TARGET_COUNT);
        }
      }

      // บันทึก cache
      try {
        const ids = finalBooks.map((b: any) => String(b.bookID ?? b.id));
        localStorage.setItem(cacheKey, JSON.stringify({ ids, ts: Date.now() }));
      } catch {}

      setRecBooks(finalBooks);
    } catch (err) {
      console.error("RecommendationSection fetch failed:", err);
      setRecBooks([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, books.length, getCacheKey]);

  // ─── fetch ตอน mount และเมื่อ user/books เปลี่ยน ──────────────────────────
  useEffect(() => {
    fetchRecs();
  }, [fetchRecs]);

  // ─── ✅ ฟัง recs:invalidate → ล้าง cache + re-fetch ─────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (user?.id && detail?.userId !== user.id) return;

      // ล้าง cache ทั้งหมดของ user นี้
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith(`recs:${user?.id ?? "guest"}:`))
          .forEach((k) => localStorage.removeItem(k));
      } catch {}

      fetchRecs();
    };

    window.addEventListener("recs:invalidate", handler);
    return () => window.removeEventListener("recs:invalidate", handler);
  }, [user?.id, fetchRecs]);

  if (loading && recBooks.length === 0) {
    return (
      <section className="py-8">
        <h2 className="text-xl font-bold text-foreground font-display">
          🤖 แนะนำสำหรับคุณ
        </h2>
        <p className="text-sm text-muted-foreground animate-pulse">
          กำลังโหลดหนังสือแนะนำ...
        </p>
      </section>
    );
  }

  if (recBooks.length === 0) return null;

  return (
    <section className="py-8">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground font-display">
          🤖 แนะนำสำหรับคุณ
        </h2>
        <p className="text-sm text-muted-foreground">
          {user
            ? "หนังสือที่ระบบแนะนำจากความชอบของคุณ"
            : "หนังสือยอดนิยมที่คุณอาจชอบ"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {recBooks.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  );
}