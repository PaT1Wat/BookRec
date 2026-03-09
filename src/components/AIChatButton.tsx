import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Sparkles } from "lucide-react";
import { books, Book } from "@/data/books";
import BookCard from "./BookCard";

interface Message {
  role: "user" | "assistant";
  content: string;
  books?: Book[];
}

const quickSuggestions = [
  "แนะนำมังงะแนวแอ็คชัน",
  "นิยายโรแมนติกต่างโลก",
  "มังงะสำหรับมือใหม่",
  "หนังสืออบอุ่นหัวใจ",
];

function getAIResponse(input: string): { text: string; books: Book[] } {
  const q = input.toLowerCase();
  let filtered = books;

  if (q.includes("มังงะ") || q.includes("manga")) {
    filtered = filtered.filter(b => b.type === "manga");
  }
  if (q.includes("นิยาย") || q.includes("novel")) {
    filtered = filtered.filter(b => b.type === "novel");
  }

  const genreMap: Record<string, string> = {
    "แอ็คชัน": "แอ็คชัน", "action": "แอ็คชัน",
    "โรแมนติก": "โรแมนติก", "romance": "โรแมนติก", "รัก": "โรแมนติก",
    "แฟนตาซี": "แฟนตาซี", "fantasy": "แฟนตาซี",
    "สืบสวน": "สืบสวน", "mystery": "สืบสวน",
    "คอมเมดี้": "คอมเมดี้", "ตลก": "คอมเมดี้", "comedy": "คอมเมดี้",
    "สยองขวัญ": "สยองขวัญ", "horror": "สยองขวัญ",
    "ต่างโลก": "ต่างโลก", "อิเซไค": "อิเซไค", "isekai": "อิเซไค",
    "วาย": "วาย", "bl": "วาย",
    "ดราม่า": "ดราม่า",
    "อบอุ่น": "โรแมนติก", "หวาน": "โรแมนติก",
    "มือใหม่": "", "ยอดนิยม": "",
  };

  for (const [key, genre] of Object.entries(genreMap)) {
    if (q.includes(key)) {
      if (key === "มือใหม่" || key === "ยอดนิยม") {
        filtered = filtered.filter(b => b.isPopular || b.rating >= 4.7);
      } else if (genre) {
        const g = genre;
        filtered = filtered.filter(b => b.genres.includes(g as any) || b.tags.some(t => t.includes(key)));
      }
    }
  }

  if (filtered.length === books.length) {
    // no filter matched, show top rated
    filtered = [...books].sort((a, b) => b.rating - a.rating).slice(0, 4);
  }

  const selected = filtered.slice(0, 4);
  const names = selected.map(b => `"${b.title}"`).join(", ");

  let response = "";
  if (selected.length === 0) {
    response = "ขอโทษครับ ไม่พบหนังสือที่ตรงกับที่คุณค้นหา ลองใช้คำอื่นดูนะครับ 😊";
  } else {
    response = `จากที่คุณสนใจ ผมขอแนะนำ ${selected.length} เรื่องนี้ครับ:\n\n${selected.map((b, i) => `${i + 1}. **${b.title}** — ${b.description.slice(0, 60)}...`).join("\n")}\n\nลองดูรายละเอียดเพิ่มเติมได้เลยครับ! 📚`;
  }

  return { text: response, books: selected };
}

const AIChatButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "สวัสดีครับ! 📚 ผมเป็น AI ช่วยแนะนำหนังสือมังงะและนิยาย\n\nบอกแนวที่ชอบได้เลยครับ เช่น แอ็คชัน โรแมนติก ต่างโลก หรือจะบอกอารมณ์ที่อยากอ่านก็ได้นะครับ!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const { text: response, books: rBooks } = getAIResponse(text);
      setMessages(prev => [...prev, { role: "assistant", content: response, books: rBooks.length > 0 ? rBooks : undefined }]);
      setIsTyping(false);
    }, 800);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 ${
          isOpen ? "bg-foreground text-background rotate-0" : "gradient-primary text-primary-foreground animate-float"
        }`}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-slide-in-right">
          {/* Header */}
          <div className="flex items-center gap-3 gradient-primary px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/20">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-primary-foreground">AI แนะนำหนังสือ</h3>
              <p className="text-xs text-primary-foreground/70">ถามได้เลย บอกแนวที่ชอบ!</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                }`}>
                  {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div className={`max-w-[75%] space-y-2`}>
                  <div className={`rounded-2xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-chat-ai text-foreground rounded-bl-md"
                  }`}>
                    <p className="whitespace-pre-line">{msg.content}</p>
                  </div>
                  {msg.books && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {msg.books.map(b => (
                        <a
                          key={b.id}
                          href={`/book/${b.id}`}
                          className="flex-shrink-0 w-16 group"
                        >
                          <img
                            src={b.coverUrl}
                            alt={b.title}
                            className="h-24 w-16 rounded-md object-cover shadow-sm transition-transform group-hover:scale-105"
                          />
                          <p className="mt-1 text-[10px] line-clamp-2 text-foreground">{b.title}</p>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl rounded-bl-md bg-chat-ai px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions */}
          {messages.length <= 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-thin">
              {quickSuggestions.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="flex-shrink-0 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border p-3">
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="พิมพ์แนวหนังสือที่ชอบ..."
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-primary-foreground disabled:opacity-40 transition-opacity"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatButton;
