import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Filter, X } from "lucide-react";
import { books, genres, searchBooks, BookType, Genre } from "@/data/books";
import BookCard from "@/components/BookCard";

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialGenre = searchParams.get("genre") || "";

  const [query, setQuery] = useState(initialQuery);
  const [selectedType, setSelectedType] = useState<BookType | "">("");
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>(
    initialGenre ? [initialGenre as Genre] : []
  );
  const [showFilters, setShowFilters] = useState(false);

  const results = useMemo(() => {
    return searchBooks(query, {
      type: selectedType || undefined,
      genres: selectedGenres.length > 0 ? selectedGenres : undefined,
    });
  }, [query, selectedType, selectedGenres]);

  const toggleGenre = (g: Genre) => {
    setSelectedGenres(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
  };

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedType("");
    setQuery("");
  };

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold font-display text-foreground">ค้นหาหนังสือ</h1>

      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อเรื่อง, ผู้แต่ง, แท็ก..."
            className="w-full rounded-xl border border-input bg-card py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
            showFilters ? "border-primary bg-primary/10 text-primary" : "border-input bg-card text-foreground hover:bg-secondary"
          }`}
        >
          <Filter className="h-4 w-4" />
          ตัวกรอง
        </button>
      </div>

      {showFilters && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4 space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">ตัวกรอง</h3>
            <button onClick={clearFilters} className="text-xs text-primary hover:underline">ล้างทั้งหมด</button>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">ประเภท</p>
            <div className="flex gap-2">
              {[
                { value: "", label: "ทั้งหมด" },
                { value: "manga", label: "มังงะ" },
                { value: "novel", label: "นิยาย" },
              ].map(t => (
                <button
                  key={t.value}
                  onClick={() => setSelectedType(t.value as BookType | "")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedType === t.value
                      ? "gradient-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-primary/10"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">แนว</p>
            <div className="flex flex-wrap gap-2">
              {genres.map(g => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedGenres.includes(g)
                      ? "gradient-primary text-primary-foreground"
                      : "bg-tag-bg text-tag-fg hover:bg-primary/10"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {(selectedGenres.length > 0 || selectedType) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">กำลังกรอง:</span>
          {selectedType && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {selectedType === "manga" ? "มังงะ" : "นิยาย"}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedType("")} />
            </span>
          )}
          {selectedGenres.map(g => (
            <span key={g} className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {g}
              <X className="h-3 w-3 cursor-pointer" onClick={() => toggleGenre(g)} />
            </span>
          ))}
        </div>
      )}

      <p className="mb-4 text-sm text-muted-foreground">
        พบ {results.length} รายการ
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {results.map((book, i) => (
          <div key={book.id} style={{ animationDelay: `${i * 60}ms` }}>
            <BookCard book={book} />
          </div>
        ))}
      </div>

      {results.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-lg text-muted-foreground">ไม่พบหนังสือที่ตรงกับการค้นหา 😔</p>
          <p className="mt-2 text-sm text-muted-foreground">ลองเปลี่ยนคำค้นหาหรือตัวกรองดูนะครับ</p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
