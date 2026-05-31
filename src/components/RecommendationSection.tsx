import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useBooks } from "@/context/BooksContext";
import BookCard from "@/components/BookCard";
import type { Book } from "@/data/books";
import { useFavorites } from "@/lib/favorites";

const TARGET_COUNT = 12;
const FETCH_POOL = 100;

type RecommendationRow = {
  bookID: number;
  score: number;
};

export default function RecommendationSection() {
  const { user } = useAuth();
  const { books } = useBooks();
  const { favorites } = useFavorites();
  const [recBooks, setRecBooks] = useState<Book[]>(() => {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith("recommendations:")
    );

    const latestKey = keys.sort().at(-1);
    if (!latestKey) return [];

    try {
      return JSON.parse(localStorage.getItem(latestKey) || "[]");
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const favoriteSet = new Set((favorites ?? []).map(String));

  const getTags = (book: any) =>
    (book.tags ?? book.genres ?? []).map((t: string) => t.toLowerCase());

  const hasSameTag = (book: any, targetTags: string[]) => {
    const tags = getTags(book);
    return tags.some((t: string) => targetTags.includes(t));
  };

  const getDailyCacheKey = (userId?: string) => {
    const now = new Date();
    const thHour = (now.getUTCHours() + 7) % 24;

    if (thHour < 5) {
      now.setUTCDate(now.getUTCDate() - 1);
    }

    const dateKey = now.toISOString().slice(0, 10);
    return `recommendations:${userId ?? "guest"}:${dateKey}`;
  };
  
  useEffect(() => {
    async function fetchRecs() {
      const db = supabase as any;
  

      const cacheKey = getDailyCacheKey(user?.id);
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        const cachedBooks = JSON.parse(cached) as Book[];

        if (cachedBooks.length > 0) {
          // setRecBooks(cachedBooks);
          setLoading(false);
          return;
        }
      }

      try {

        const bookMap = new Map<string, Book>();

        for (const b of books) {
          bookMap.set(String(b.id), b);

          if (b.bookID !== undefined && b.bookID !== null) {
            bookMap.set(String(b.bookID), b);
          }
        }

        const { data: profile } = await db
          .from("profiles")
          .select("favoriteGenres")
          .eq("id", user.id)
          .maybeSingle();

        const profileTags = (
          profile?.favoriteGenres ?? []
        ).map((t: string) => t.toLowerCase());

        const { data: interactions } = await db
          .from("interaction")
          .select("bookID, actionType")
          .eq("user_id", user.id);

        const interactionBookIds = [
         ...new Set(
            (interactions ?? []).map(
              (i: any) => String(i.bookID)
            )
          ),
        ];

        const interactionTags = interactionBookIds.flatMap(
          (id: string) => {
            const book = bookMap.get(id);
            return book ? getTags(book) : [];
          }
        );

        const used = new Set<string>();

        const pickBooks = (
          targetTags: string[],
          count: number
        ) => {
          const result = books
            .filter((b: any) => {
              const id = String(b.bookID ?? b.id);

              if (used.has(id)) return false;

              if (favoriteSet.has(id)) return false;

              return hasSameTag(b, targetTags);
            })
            .sort((a: any, b: any) => {
              const ratingDiff =
                Number(b.rating ?? 0) -
                Number(a.rating ?? 0);

              if (ratingDiff !== 0) {
                return ratingDiff;
              }

              return (
                Number(b.reviewCount ?? 0) -
                Number(a.reviewCount ?? 0)
              );
            })
            .slice(0, count);

          result.forEach((b: any) => {
            used.add(String(b.bookID ?? b.id));
          });

          return result;
        };

        const hasInteraction =
          interactionBookIds.length > 0;

        let profileBooks: Book[] = [];
        let interactionBooks: Book[] = [];


        if (hasInteraction) {
          // 6 จากแนวที่เลือกตอนสมัคร
          profileBooks = pickBooks(profileTags, 6);

          // 6 จากพฤติกรรมผู้ใช้จริง
          interactionBooks = pickBooks(interactionTags, 6);
        } else {
          // ยังไม่มี interaction
          profileBooks = pickBooks(profileTags, 12);
        }

        const finalBooks = [
          ...profileBooks,
           ...interactionBooks,
        ]
          .sort((a: any, b: any) => {
            const ratingDiff = Number(b.rating ?? 0) - Number(a.rating ?? 0);
            if (ratingDiff !== 0) return ratingDiff;

            return Number(b.reviewCount ?? 0) - Number(a.reviewCount ?? 0);
          })
          .slice(0, TARGET_COUNT);

        localStorage.setItem(cacheKey, JSON.stringify(finalBooks));

        setRecBooks(finalBooks);

 
      } catch (err) {
        console.error("Recommendation fetch failed:", err);
        setRecBooks([]);
      } finally {
        setLoading(false);
      }
    }

    if (recBooks.length > 0) return;

    if (books.length > 0 && user?.id) {
      fetchRecs();
    }
  }, [user?.id, books.length, recBooks.length]);

  if (loading && recBooks.length === 0) {
    return (
      <section className="py-8">
        <h2 className="text-xl font-bold text-foreground font-display">
          🤖 แนะนำสำหรับคุณ
        </h2>
        <p className="text-sm text-muted-foreground">
          กำลังโหลดหนังสือแนะนำ...
        </p>
      </section>
    );
  }

  if (recBooks.length === 0) {
    return (
      <section className="py-8 min-h-[520px]">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground font-display">
            🤖 แนะนำสำหรับคุณ
          </h2>
          <p className="text-sm text-muted-foreground">
            กำลังเตรียมหนังสือแนะนำ...
          </p>
        </div>
      </section>
    );
  }

  <section className="py-8 min-h-[520px]"></section>

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