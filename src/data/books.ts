// ===== TYPE =====
export type BookType = string;
export type Genre = string;

// ===== MAIN BOOK TYPE =====
export interface Book {
  // 🔥 IMPORTANT: ใช้ map กับ recommendation
  bookID: number;     // ✅ เพิ่มตัวนี้

  // ใช้ใน frontend routing
  id: string;

  title: string;
  titleEn?: string;

  description: string;
  coverUrl: string;

  publishDate?: string;
  slug?: string;

  // relation (display)
  publisher?: string;
  publisherName?: string;
  authorName?: string;
  type?: BookType;

  tags: Genre[];
  genres: Genre[];

  // relation (ID สำหรับ backend)
  publisherID?: number;
  typeId?: number;
  tagIDs?: number[];

  // optional (UI)
  author?: string;
  rating?: number;
  reviewCount?: number;
  price?: number;

  isNew?: boolean;
  isPopular?: boolean;
}

// ===== STATIC GENRES =====
export const genres: Genre[] = [
  "แฟนตาซี",
  "โรแมนติก",
  "แอ็กชัน",
  "คอมเมดี้",
  "ดราม่า",
  "สืบสวน",
  "สยองขวัญ",
  "ชีวิตประจำวัน",
  "ผจญภัย",
  "เหนือธรรมชาติ",
];

export const sampleBooks: Book[] = [];