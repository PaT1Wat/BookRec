import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import heroBanner from "@/assets/hero-banner.jpg";

const HeroSection = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroBanner} alt="Hero" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/80 via-foreground/60 to-foreground/30" />
      </div>

      <div className="container relative z-10 py-20 md:py-28">
        <div className="max-w-xl space-y-6">
          <h1 className="text-4xl font-extrabold leading-tight text-primary-foreground md:text-5xl font-display">
            ค้นพบโลกแห่ง<br />
            <span className="bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
              มังงะ & นิยาย
            </span>
          </h1>
          <p className="text-lg text-primary-foreground/80">
            ระบบแนะนำหนังสือที่เข้าใจรสนิยมของคุณ ค้นหา รีวิว และบันทึกหนังสือที่ชอบได้ในที่เดียว
          </p>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาชื่อหนังสือ, ผู้แต่ง, แท็ก..."
                className="w-full rounded-xl bg-card/95 backdrop-blur py-3 pl-10 pr-4 text-sm text-foreground outline-none ring-2 ring-primary/20 focus:ring-primary/50 transition-all"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              ค้นหา
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
