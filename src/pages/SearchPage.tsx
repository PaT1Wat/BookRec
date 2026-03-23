import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Filter } from "lucide-react";
import { genres, type BookType, type Genre } from "@/data/books";
import { supabase } from "@/integrations/supabase/client";
import BookCard from "@/components/BookCard";

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [selectedType, setSelectedType] = useState<BookType | "">("");
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  /* =======================
     🔥 LOAD BOOKS
  ======================= */
  const loadBooks = async () => {
    setLoading(true);

    let queryBuilder = supabase.from("books").select("*");

    // 🔍 SEARCH
    if (query) {
      queryBuilder = queryBuilder.ilike("title", `%${query}%`);
    }

    // 📚 TYPE FILTER
    if (selectedType === "manga") {
      queryBuilder = queryBuilder.eq("type_id", 1);
    } else if (selectedType === "novel") {
      queryBuilder = queryBuilder.eq("type_id", 2);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error("Supabase error:", error);
    } else {
      // ✅ MAP DATA → BookCard ใช้ได้เลย
      const mapped = (data || []).map((b) => ({
        id: String(b.bookID),
        title: b.title,
        description: b.description || "",
        coverUrl: b.coverImage || "",
        publishDate: b.publishDate || "",
        slug: b.slug || "",

        publisherID: b.publisherID,
        typeId: b.type_id,

        // 👇 TEMP (รอ join จริง)
        publisher: "-",
        type: b.type_id === 1 ? "manga" : "novel",
        tags: [],
        genres: [],
      }));

      setBooks(mapped);
    }

    setLoading(false);
  };

  /* =======================
     🔁 DEBOUNCE LOAD
  ======================= */
  useEffect(() => {
    const delay = setTimeout(() => {
      loadBooks();
    }, 300);

    return () => clearTimeout(delay);
  }, [query, selectedType]);

  /* =======================
     🎯 GENRE FILTER (UI only)
  ======================= */
  const toggleGenre = (g: Genre) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedType("");
    setQuery("");
  };

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold font-display">
        ค้นหาหนังสือ
      </h1>

      {/* 🔍 SEARCH */}
      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อหนังสือ..."
            className="w-full rounded-xl border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
            showFilters
              ? "border-primary bg-primary/10 text-primary"
              : "bg-card"
          }`}
        >
          <Filter className="h-4 w-4" />
          ตัวกรอง
        </button>
      </div>

      {/* 🎛 FILTER */}
      {showFilters && (
        <div className="mb-6 rounded-xl border bg-card p-4 space-y-4">
          <div className="flex justify-between">
            <h3 className="text-sm font-semibold">ตัวกรอง</h3>
            <button
              onClick={clearFilters}
              className="text-xs text-primary hover:underline"
            >
              ล้างทั้งหมด
            </button>
          </div>

          {/* TYPE */}
          <div>
            <p className="mb-2 text-xs text-muted-foreground">ประเภท</p>
            <div className="flex gap-2">
              {[
                { value: "", label: "ทั้งหมด" },
                { value: "manga", label: "มังงะ" },
                { value: "novel", label: "นิยาย" },
                { value: "lightnovel", label: "ไลท์โนเวล" },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setSelectedType(t.value as BookType | "")}
                  className={`rounded-lg px-3 py-1.5 text-xs ${
                    selectedType === t.value
                      ? "bg-primary text-white"
                      : "bg-secondary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* GENRE */}
          <div>
            <p className="mb-2 text-xs text-muted-foreground">แนว</p>
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    selectedGenres.includes(g)
                      ? "bg-primary text-white"
                      : "bg-gray-200"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ⏳ LOADING */}
      {loading && (
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      )}

      {/* 📚 RESULTS */}
      {!loading && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            พบ {books.length} รายการ
          </p>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>

          {books.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-lg text-muted-foreground">
                ไม่พบหนังสือ 😔
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchPage;