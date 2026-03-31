import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Filter } from "lucide-react";
import { type BookType } from "@/data/books";
import { supabase } from "@/integrations/supabase/client";
import BookCard from "@/components/BookCard";

// ✅ ตรงกับ tagName ใน DB แล้ว
const GENRE_LIST = [
  "แอ็กชัน", "ผจญภัย", "แฟนตาซี", "โรแมนติก", "ดราม่า",
  "คอมเมดี้", "สยองขวัญ", "สืบสวน", "ไซไฟ", "ชีวิตประจำวัน", "GL/BL",
];

const TYPE_ID_MAP: Record<string, number> = {
  manga: 1,
  novel: 2,
  "light-novel": 3,
};

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialGenre = searchParams.get("genre") || "";

  const [query, setQuery] = useState(initialQuery);
  const [selectedType, setSelectedType] = useState<BookType | "">("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    initialGenre ? [initialGenre] : []
  );
  const [showFilters, setShowFilters] = useState(!!initialGenre);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delay = setTimeout(async () => {
      setLoading(true);

      let queryBuilder = supabase
        .from("books")
        .select(`
          bookID, title, titleEn, description, coverImage,
          publishDate, slug, is_new, is_popular, rating, review_count, price,
          publisher:publisherID ( publisherName ),
          type:type_id ( slug ),
          bookTag ( tag:tagID ( tagID, tagName ) )
        ` as any);

      if (query) {
        queryBuilder = (queryBuilder as any).ilike("title", `%${query}%`);
      }

      if (selectedType && TYPE_ID_MAP[selectedType]) {
        queryBuilder = (queryBuilder as any).eq("type_id", TYPE_ID_MAP[selectedType]);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error("Supabase error:", error);
        setLoading(false);
        return;
      }

      let mapped = (data || []).map((b: any) => ({
        id: String(b.bookID),
        title: b.title ?? "",
        titleEn: b.titleEn ?? "",
        description: b.description ?? "",
        coverUrl: b.coverImage ?? "",
        publishDate: b.publishDate ?? "",
        slug: b.slug ?? "",
        publisher: b.publisher?.publisherName ?? "-",
        type: b.type?.slug ?? "manga",
        tags: b.bookTag?.map((bt: any) => bt.tag?.tagName).filter(Boolean) ?? [],
        genres: b.bookTag?.map((bt: any) => bt.tag?.tagName).filter(Boolean) ?? [],
        isNew: b.is_new ?? false,
        isPopular: b.is_popular ?? false,
        rating: b.rating ?? 0,
        reviewCount: b.review_count ?? 0,
        price: b.price ?? 0,
      }));

      if (selectedGenres.length > 0) {
        mapped = mapped.filter((b) =>
          selectedGenres.some((g) => b.genres.includes(g))
        );
      }

      setBooks(mapped);
      setLoading(false);
    }, 300);

    return () => clearTimeout(delay);
  }, [query, selectedType, selectedGenres]);

  const toggleGenre = (g: string) => {
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
      <h1 className="mb-6 text-3xl font-bold font-display">ค้นหาหนังสือ</h1>

      {/* 🔍 Search */}
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
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
            showFilters || selectedGenres.length > 0 || selectedType
              ? "border-primary bg-primary/10 text-primary"
              : "bg-card"
          }`}
        >
          <Filter className="h-4 w-4" />
          ตัวกรอง {selectedGenres.length > 0 && `(${selectedGenres.length})`}
        </button>
      </div>

      {/* 🎛 Filter Panel */}
      {showFilters && (
        <div className="mb-6 rounded-xl border bg-card p-4 space-y-4">
          <div className="flex justify-between">
            <h3 className="text-sm font-semibold">ตัวกรอง</h3>
            <button onClick={clearFilters} className="text-xs text-primary hover:underline">
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
                { value: "light-novel", label: "ไลท์โนเวล" },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setSelectedType(t.value as BookType | "")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedType === t.value
                      ? "bg-primary text-white"
                      : "bg-secondary hover:bg-secondary/80"
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
              {GENRE_LIST.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedGenres.includes(g)
                      ? "bg-primary text-white"
                      : "bg-secondary hover:bg-secondary/80"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ⏳ Loading */}
      {loading && (
        <p className="text-sm text-muted-foreground animate-pulse">กำลังโหลด...</p>
      )}

      {/* 📚 Results */}
      {!loading && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            พบ {books.length} รายการ
            {selectedGenres.length > 0 && (
              <span className="ml-2 text-primary">
                แนว: {selectedGenres.join(", ")}
              </span>
            )}
          </p>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>

          {books.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-lg text-muted-foreground">ไม่พบหนังสือ 😔</p>
              <button
                onClick={clearFilters}
                className="mt-4 text-sm text-primary hover:underline"
              >
                ล้างตัวกรอง
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchPage;