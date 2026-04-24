import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { useBooks } from "@/context/BooksContext";
import BookCard from "@/components/BookCard";
import type { Book } from "@/data/books";

interface ChatRecommendation {
  title: string;
  reason?: string;
}

interface Message {
  role: "user" | "bot";
  content: string;
  recommendedBooks?: Array<{
    book: Book;
    reason?: string;
  }>;
}

export default function AIChatButton() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      content: "สวัสดีครับ! ผม BookBot 📚 ถามเรื่องหนังสือได้เลยครับ",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { books } = useBooks();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const matchBooksFromRecommendations = (
    recs: ChatRecommendation[],
    allBooks: Book[]
  ) => {
    if (!recs?.length || !allBooks.length) return [];

    const results: Array<{ book: Book; reason?: string }> = [];
    const seen = new Set<string>();

    for (const rec of recs) {
      const targetTitle = rec.title?.trim().toLowerCase();
      if (!targetTitle) continue;

      const matched = allBooks.find((b) => {
        const th = b.title?.trim().toLowerCase();
        const en = b.titleEn?.trim().toLowerCase();
        return th === targetTitle || en === targetTitle;
      });

      if (matched && !seen.has(String(matched.id))) {
        seen.add(String(matched.id));
        results.push({
          book: matched,
          reason: rec.reason,
        });
      }
    }

    return results;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const booksContext = books.slice(0, 50).map((b) => ({
        title: b.title,
        titleEn: b.titleEn,
        type: b.type,
        tags: b.tags?.slice(0, 5),
        author: b.authorName || b.author,
      }));

      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          books: booksContext,
        }),
      });

      const data = await res.json();

      const recommendedBooks = matchBooksFromRecommendations(
        data?.recommendations ?? [],
        books
      );

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: data?.reply || "ขออภัยครับ ระบบยังไม่สามารถตอบได้",
          recommendedBooks,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: "ขออภัยครับ เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะครับ",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-all"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 h-[520px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 bg-blue-600 rounded-t-2xl flex items-center gap-2">
            <MessageCircle size={20} className="text-white" />
            <span className="text-white font-semibold">BookBot</span>
            <span className="text-blue-200 text-xs ml-auto">
              AI ผู้ช่วยแนะนำหนังสือ
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`${
                    msg.role === "user"
                      ? "max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed bg-blue-600 text-white rounded-br-sm"
                      : "max-w-[94%] px-3 py-2 rounded-2xl text-sm leading-relaxed bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {msg.role === "bot" &&
                    msg.recommendedBooks &&
                    msg.recommendedBooks.length > 0 && (
                      <div className="mt-3 space-y-3">
                        <div className="text-xs font-medium text-muted-foreground">
                          หนังสือแนะนำ
                        </div>

                        <div className="space-y-4">
                          {msg.recommendedBooks.map(({ book, reason }) => (
                            <div key={book.id} className="space-y-2">
                              <div className="rounded-xl overflow-hidden bg-background">
                                <BookCard book={book} />
                              </div>
                              {reason && (
                                <p className="text-xs text-muted-foreground px-1">
                                  {reason}
                                </p>
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
                <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-2xl rounded-bl-sm">
                  <Loader2 size={16} className="animate-spin text-gray-500" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="พิมพ์คำถามเกี่ยวกับหนังสือ..."
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              aria-label="ส่งข้อความ"
              className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition-all"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}