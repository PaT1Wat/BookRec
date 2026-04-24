import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useBooks } from "@/context/BooksContext";
import BookCard from "@/components/BookCard";
import type { Book } from "@/data/books";

const API_BASE_URL = "http://127.0.0.1:8000";
const TARGET_COUNT = 12;
const FETCH_POOL = 36;

type RecommendationRow = {
  bookID: number;
  score: number;
};

export default function RecommendationSection() {
  const { user } = useAuth();
  const { books } = useBooks();
  const [recBooks, setRecBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecs() {
      const db = supabase as any;
      setLoading(true);

      try {
        let apiBookIds: string[] = [];
        let userRecs: RecommendationRow[] = [];
        let generalRecs: RecommendationRow[] = [];

        // 1) เรียก backend เพื่อ generate/update hybrid recommendation ของ user
        if (user?.id) {
          try {
            const res = await fetch(`${API_BASE_URL}/recommend/${user.id}`);
            const json = await res.json();
            console.log("Backend recommend response:", json);
            apiBookIds = Array.isArray(json?.bookIDs)
              ? json.bookIDs.map(String)
              : [];
          } catch (err) {
            console.error("Failed to call backend /recommend:", err);
          }
        }

        // 2) อ่าน personalized hybrid recs จากตาราง recommendations
        if (user?.id) {
          const { data, error } = await db
            .from("recommendations")
            .select("bookID, score")
            .eq("user_id", user.id)
            .eq("rec_type", "hybrid")
            .order("score", { ascending: false })
            .limit(FETCH_POOL);

          if (error) {
            console.error("Recommendation query error (user hybrid):", error);
          } else {
            userRecs = data ?? [];
          }
        }

        // 3) ถ้ายังไม่ครบ 12 ค่อยไปเอา general hybrid recommendations มาเติม
        if (
          apiBookIds.length < TARGET_COUNT ||
          userRecs.length < TARGET_COUNT
        ) {
          const { data, error } = await db
            .from("recommendations")
            .select("bookID, score")
            .is("user_id", null)
            .eq("rec_type", "hybrid")
            .order("score", { ascending: false })
            .limit(FETCH_POOL);

          if (error) {
            console.error("Recommendation query error (general hybrid):", error);
          } else {
            generalRecs = data ?? [];
          }
        }

        console.log("API bookIDs:", apiBookIds);
        console.log("User hybrid recs:", userRecs);
        console.log("General hybrid recs:", generalRecs);
        console.log("Books loaded:", books.length);

        if (books.length === 0) {
          setRecBooks([]);
          return;
        }

        // ใช้ทั้ง id และ bookID กันพลาด
        const bookMap = new Map<string, Book>();
        for (const b of books) {
          bookMap.set(String(b.id), b);
          if (b.bookID !== undefined && b.bookID !== null) {
            bookMap.set(String(b.bookID), b);
          }
        }

        const mergedIds: string[] = [];
        const seen = new Set<string>();

        const addId = (rawId: string | number | null | undefined) => {
          if (rawId === null || rawId === undefined) return;
          const key = String(rawId);
          if (!seen.has(key)) {
            seen.add(key);
            mergedIds.push(key);
          }
        };

        // priority 1: ผลจาก API
        for (const id of apiBookIds) {
          addId(id);
          if (mergedIds.length >= TARGET_COUNT) break;
        }

        // priority 2: personalized hybrid recs
        if (mergedIds.length < TARGET_COUNT) {
          for (const item of userRecs) {
            addId(item.bookID);
            if (mergedIds.length >= TARGET_COUNT) break;
          }
        }

        // priority 3: general hybrid recs
        if (mergedIds.length < TARGET_COUNT) {
          for (const item of generalRecs) {
            addId(item.bookID);
            if (mergedIds.length >= TARGET_COUNT) break;
          }
        }

        const ordered = mergedIds
          .map((id) => bookMap.get(String(id)))
          .filter((b): b is Book => !!b)
          .slice(0, TARGET_COUNT);

        console.log("Merged IDs:", mergedIds);
        console.log("Recommendation ordered books:", ordered);

        setRecBooks(ordered);
      } catch (err) {
        console.error("Recommendation fetch failed:", err);
        setRecBooks([]);
      } finally {
        setLoading(false);
      }
    }

    if (books.length > 0) {
      fetchRecs();
    }
  }, [user, books]);

  if (loading || recBooks.length === 0) return null;

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