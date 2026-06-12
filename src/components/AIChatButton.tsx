import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";

import { useBooks } from "@/context/BooksContext";
import BookCard from "@/components/BookCard";

import type { Book } from "@/data/books";

type Message = {
  role: "user" | "bot";
  content: string;
  recommendedBooks?: { book: Book; reason?: string }[];
};

type ChatRecommendation = {
  title: string;
  reason?: string;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\u0E00-\u0E7Fa-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── helpers ───────────────────────────────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function matchScore(query: string, candidate: string): number {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;

  // ตรงทั้งหมด
  if (c === q) return 1;

  // ตรงบางส่วน
  if (c.includes(q) || q.includes(c)) return 0.9;

  // bigram similarity (เดิม)
  const bigrams = (s: string) => {
    const b = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) b.add(s.slice(i, i + 2));
    return b;
  };
  const bq = bigrams(q);
  const bc = bigrams(c);
  let overlap = 0;
  bq.forEach((bg) => { if (bc.has(bg)) overlap++; });
  const bigramScore = (2 * overlap) / (bq.size + bc.size || 1);

  // ✅ เพิ่ม: edit distance score
  // คำนวณเฉพาะกรณีความยาวใกล้เคียงกัน (ไม่เกิน 2 เท่า) เพื่อประหยัด CPU
  let editScore = 0;
  if (
    q.length > 0 && 
    c.length > 0 && 
    Math.max(q.length, c.length) <= Math.min(q.length, c.length) * 2
  ) {
    const dist = levenshtein(q, c);
    const maxLen = Math.max(q.length, c.length);
    editScore = Math.max(0, 1 - dist / maxLen);
  }

  // เอาค่าสูงสุดระหว่าง bigram กับ edit distance
  return Math.max(bigramScore, editScore);
}

// ─── deep parse: รองรับทุกรูปแบบที่ backend อาจส่งมา ──────────────────────
function deepParse(raw: any): { reply: string; recommendations: ChatRecommendation[] } {
  // 1. ถ้าเป็น string → พยายาม parse ก่อน
  if (typeof raw === "string") {
    // ลบ markdown code fence ถ้ามี
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    try {
      return deepParse(JSON.parse(cleaned));
    } catch {
      // parse ไม่ได้ → return ตรงๆ เป็น reply
      return { reply: cleaned, recommendations: [] };
    }
  }

  // 2. ถ้าเป็น object
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    let reply = raw.reply ?? "";
    let recommendations: ChatRecommendation[] = [];

    // reply อาจเป็น string ปกติ หรือ JSON string ซ้อนอีกชั้น
    if (typeof reply === "string") {
      // ถ้า reply เหมือน JSON object ให้ parse แล้วเอา reply ข้างใน
      const trimmed = reply.trim();
      if (trimmed.startsWith("{")) {
        try {
          const inner = JSON.parse(trimmed);
          reply = inner.reply ?? reply;
          recommendations = Array.isArray(inner.recommendations) ? inner.recommendations : [];
          return { reply, recommendations };
        } catch { /* ไม่ใช่ JSON ก็ใช้ค่าเดิม */ }
      }
    }

    // recommendations
    if (Array.isArray(raw.recommendations)) {
      recommendations = raw.recommendations;
    } else if (typeof raw.recommendations === "string") {
      try {
        const parsed = JSON.parse(raw.recommendations);
        recommendations = Array.isArray(parsed) ? parsed : [];
      } catch { recommendations = []; }
    }

    return {
      reply: String(reply || "ผมลองคัดหนังสือที่ใกล้เคียงให้แล้วครับ"),
      recommendations,
    };
  }

  return { reply: "ระบบยังไม่สามารถตอบได้", recommendations: [] };
}

export default function AIChatButton() {
  const { books } = useBooks();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", content: "สวัสดีครับ! ผม BookBot 📚 ถามเรื่องหนังสือได้เลยครับ" },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const matchBooks = (recs: ChatRecommendation[] = []) => {
    return recs
      .map((rec) => {
        const query = rec.title?.trim() ?? "";
        if (!query) return null;
        let best: Book | null = null;
        let bestScore = 0;
        for (const b of books) {
          const s = Math.max(
            matchScore(query, b.title ?? ""),
            matchScore(query, b.titleEn ?? "")
          );
          if (s > bestScore) { bestScore = s; best = b; }
        }
        // ใน matchBooks ฟังก์ชัน
        return bestScore >= 0.3 ? { book: best!, reason: rec.reason } : null; // ✅ เปลี่ยนจาก 0.4
      })
      .filter(Boolean) as { book: Book; reason?: string }[];
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    const chatHistory = [...messages, { role: "user" as const, content: userMsg }];

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);

    setMessages((prev) => [...prev, { 
      role: "bot", 
      content: "⏳ กำลังเชื่อมต่อ อาจใช้เวลาสักครู่..." 
    }]);

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          message: userMsg,
          history: chatHistory.map((m) => ({ role: m.role, content: m.content })),
          // ไม่ส่ง books จาก frontend — backend ดึงจาก cache เอง
        }),
      });

      // อ่านเป็น text ก่อนเสมอ เพื่อ handle ทุกกรณี
      const rawText = await res.text();
      let rawData: any = rawText;
      try { rawData = JSON.parse(rawText); } catch { /* ใช้ rawText แทน */ }

      const { reply, recommendations } = deepParse(rawData);

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: reply,
          recommendedBooks: matchBooks(recommendations),
        },
      ]);
    } catch (err) {
      console.error("[BookBot error]", err);
      setMessages((prev) => [
        ...prev,
        { role: "bot", content: "ขออภัยครับ เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะครับ" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[520px] w-80 flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:w-96">
          <div className="flex items-center gap-2 rounded-t-2xl bg-blue-600 px-4 py-3">
            <MessageCircle size={20} className="text-white" />
            <span className="font-semibold text-white">BookBot</span>
            <span className="ml-auto text-xs text-blue-200">ผู้ช่วยค้นหาและแนะนำหนังสือ</span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[94%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "rounded-br-sm bg-blue-600 text-white"
                      : "rounded-bl-sm bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {!!msg.recommendedBooks?.length && (
                    <div className="mt-3">
                      <p className="mt-2 text-xs font-medium text-muted-foreground">หนังสือแนะนำ</p>
                      <div className="flex gap-3 overflow-x-auto py-2">
                        {msg.recommendedBooks.map(({ book, reason }) => (
                          <div key={String(book.id ?? book.bookID)} className="w-36 flex-shrink-0">
                            <div className="overflow-hidden rounded-xl bg-background">
                              <BookCard book={book} />
                            </div>
                            {reason && (
                              <p className="mt-1 line-clamp-2 px-1 text-[11px] text-muted-foreground">{reason}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2 dark:bg-gray-800">
                  <Loader2 size={16} className="animate-spin text-gray-500" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2 border-t border-gray-200 p-3 dark:border-gray-700">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="พิมพ์คำถามเกี่ยวกับหนังสือ..."
              className="flex-1 rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              aria-label="ส่งข้อความ"
              title="ส่งข้อความ"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition-all hover:bg-blue-700 disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}