import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useBooks } from "@/context/BooksContext";
import BookCard from "@/components/BookCard";
import type { Book } from "@/data/books";

export default function RecommendationSection() {
  const { user } = useAuth();
  const { books } = useBooks();
  const [recBooks, setRecBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecs() {
      // Try user-specific first, fallback to general
      let query = supabase
        .from("recommendations")
        .select("book_id, score")
        .eq("rec_type", "lightfm")
        .order("score", { ascending: false })
        .limit(8);

      if (user) {
        query = query.eq("user_id", user.id);
      } else {
        query = query.is("user_id", null);
      }

      const { data } = await query;

      // If user-specific returns empty, fallback to general
      let recs = data;
      if (user && (!recs || recs.length === 0)) {
        const { data: general } = await supabase
          .from("recommendations")
          .select("book_id, score")
          .eq("rec_type", "lightfm")
          .is("user_id", null)
          .order("score", { ascending: false })
          .limit(8);
        recs = general;
      }

      if (recs && recs.length > 0 && books.length > 0) {
        const bookMap = new Map(books.map(b => [b.id, b]));
        const ordered = recs
          .map(r => bookMap.get(r.book_id))
          .filter((b): b is Book => !!b);
        setRecBooks(ordered);
      }
      setLoading(false);
    }

    if (books.length > 0) fetchRecs();
  }, [user, books]);

  if (loading || recBooks.length === 0) return null;

  return (
    <section className="py-8">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground font-display">
          🤖 แนะนำสำหรับคุณ
        </h2>
        <p className="text-sm text-muted-foreground">
          {user ? "จากการวิเคราะห์รสนิยมของคุณด้วย AI" : "หนังสือยอดนิยมที่คุณอาจชอบ"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {recBooks.map(book => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  );
}
