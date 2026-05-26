import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";

import { useBooks } from "@/context/BooksContext";
import BookCard from "@/components/BookCard";

import type { Book } from "@/data/books";

type Message = {
  role: "user" | "bot";
  content: string;
  recommendedBooks?: {
    book: Book;
    reason?: string;
  }[];
};

type ChatRecommendation = {
  title: string;
  reason?: string;
};

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AIChatButton() {
  const { books } = useBooks();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      content: "สวัสดีครับ! ผม BookBot 📚 ถามเรื่องหนังสือได้เลยครับ",
    },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const matchBooks = (
    recs: ChatRecommendation[] = []
  ) => {
    return recs
      .map((rec) => {
        const target =
          rec.title?.trim().toLowerCase() || "";

        const book = books.find((b) => {
          const title =
            b.title?.toLowerCase() || "";

          const titleEn =
            b.titleEn?.toLowerCase() || "";

          return (
            title.includes(target) ||
            target.includes(title) ||
            titleEn.includes(target)
          );
        });

        return book
          ? {
              book,
              reason: rec.reason,
            }
          : null;
      })
      .filter(Boolean) as {
      book: Book;
      reason?: string;
    }[];
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
      const chatHistory = [
      ...messages,
      {
        role: "user" as const,
        content: userMsg,
      },
    ];

    setInput("");

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMsg,
      },
    ]);

    setLoading(true);

    try {

      // เอาข้อความ user ล่าสุด ๆ มารวมกัน
      // เช่น รอบก่อนถาม "แนวต่างโลก" รอบนี้ถาม "ขอแบบมังงะ"
      // ระบบจะเข้าใจรวมเป็น "แนวต่างโลก ขอแบบมังงะ"
      const contextText = chatHistory
        .filter((m) => m.role === "user")
        .slice(-3) // เอาแค่ 3 ข้อความล่าสุดของ user
        .map((m) => m.content)
        .join(" ")
        .toLowerCase();

      const normalized = contextText;
      
      const typeMap : Record<string, string> = {
        "มังงะ": "manga",
        "นิยาย": "novel",
        "ไลท์โนเวล": "light-novel",
      };

      const tagList = Array.from(
        new Set(
          books.flatMap((b: any) =>
            (b.tags ?? []).map((tag: string) => 
              tag.toLowerCase().trim()
            )
          )
        )
      );

      const wantedType = Object.entries(typeMap).find(([thai]) =>
        normalized.includes(thai.toLowerCase())
      )?.[1];

      const wantedTags = tagList.filter((tag) =>
        normalized.includes(tag)
      );

      const filteredBooks = books.filter((b: any) => {
        const bookType = String(b.type || "").toLowerCase();

        const bookTags = (b.tags ?? []).map((t: string) =>
          t.toLowerCase().trim()
        );

        const matchType = !wantedType || bookType === wantedType;

        const matchTags =
          wantedTags.length === 0 ||
          wantedTags.some((tag) => bookTags.includes(tag));

        return matchType && matchTags;
      });

      // ถ้าผู้ใช้ไม่ได้ระบุประเภท เช่น ถามแค่ "สืบสวน"
      // จะคละ มังงะ / นิยาย / ไลท์โนเวล ให้ Gemini เห็นครบกว่าเดิม
      const selectedBooks = filteredBooks
        .sort((a: any, b: any) => {
          const aTags = (a.tags ?? []).length;
          const bTags = (b.tags ?? []).length;

          // หนังสือที่ tag เยอะกว่า จะถูกส่งไปให้ AI ก่อน
          return bTags - aTags;
      })
      .slice(0, 12);

      let booksContext = selectedBooks.map((b: any) => ({
        title: b.title,
        titleEn: b.titleEn,
        type: b.type,
        tags: b.tags ?? [],
        authorName: b.authorName,
        description: b.description ?? "",
      }));
          
      // ถ้าไม่เจอเลย ให้ fallback เป็นประเภทที่ผู้ใช้ขอ
      // เช่น ขอแบบมังงะ แต่ไม่มี tag ตรง ก็ยังส่งมังงะไปให้ AI
      if (booksContext.length === 0 && wantedType) {
        booksContext = books
          .filter((b: any) => String(b.type || "").toLowerCase() === wantedType)
          .slice(0, 10)
          .map((b: any) => ({
            title: b.title,
            titleEn: b.titleEn,
            type: b.type,
            tags: b.tags ?? [],
            authorName: b.authorName,
            description: b.description ?? "",
          }));
      }
      
      // ถ้ายังไม่เจออีก ค่อยส่ง top books ไปให้ AI โดยไม่สนใจประเภทเลย
      if (booksContext.length === 0) {
        booksContext = books.slice(0, 10).map((b: any) => ({
          title: b.title,
          titleEn: b.titleEn,
          type: b.type,
          tags: b.tags ?? [],
          authorName: b.authorName,
          description: b.description ?? "",
        }));
      }

      const res = await fetch(
        `${API_URL}/chat`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            message: userMsg,
            history: chatHistory.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            books: booksContext,
          }),
        }
      );

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",

          content:
            data?.reply ||
            "ขออภัยครับ ระบบยังไม่สามารถตอบได้",

          recommendedBooks: matchBooks(
            data?.recommendations ?? []
          ),
        },
      ]);
    } catch (err) {
      console.error(err);

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content:
            "ขออภัยครับ เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะครับ",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() =>
          setOpen((prev) => !prev)
        }
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700"
      >
        {open ? (
          <X size={24} />
        ) : (
          <MessageCircle size={24} />
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[520px] w-80 flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:w-96">
          {/* HEADER */}
          <div className="flex items-center gap-2 rounded-t-2xl bg-blue-600 px-4 py-3">
            <MessageCircle
              size={20}
              className="text-white"
            />

            <span className="font-semibold text-white">
              BookBot
            </span>

            <span className="ml-auto text-xs text-blue-200">
              ผู้ช่วยค้นหาและแนะนำหนังสือ
            </span>
          </div>

          {/* MESSAGES */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[94%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "rounded-br-sm bg-blue-600 text-white"
                      : "rounded-bl-sm bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    {msg.content}
                  </div>

                  {!!msg.recommendedBooks?.length && (
                    <div className="mt-3">
                      <p className="mt-2 text-xs font-medium text-muted-foreground">
                        หนังสือแนะนำ
                      </p>

                      <div className="flex gap-3 overflow-x-auto py-2">
                        {msg.recommendedBooks.map(({ book, reason }) => (
                          <div
                            key={String(book.id ?? book.bookID)}
                            className="w-36 flex-shrink-0"
                          >
                            <div className="overflow-hidden rounded-xl bg-background">
                              <BookCard book={book} />
                            </div>

                            {reason && (
                              <p className="mt-1 line-clamp-2 px-1 text-[11px] text-muted-foreground">
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
                <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2 dark:bg-gray-800">
                  <Loader2
                    size={16}
                    className="animate-spin text-gray-500"
                  />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* INPUT */}
          <div className="flex gap-2 border-t border-gray-200 p-3 dark:border-gray-700">
            <input
              value={input}
              onChange={(e) =>
                setInput(e.target.value)
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey
                ) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="พิมพ์คำถามเกี่ยวกับหนังสือ..."
              className="flex-1 rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
            />

            <button
              onClick={sendMessage}
              disabled={
                !input.trim() || loading
              }
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
