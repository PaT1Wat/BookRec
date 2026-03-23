// ===== TYPE =====
export type BookType = string;
export type Genre = string;

// ===== MAIN BOOK TYPE =====
export interface Book {
  id: string;
  title: string;
  titleEn?: string;

  description: string;
  coverUrl: string;

  publishDate?: string;
  slug?: string;

  // relation (display)
  publisher?: string;
  publisherName?: string; // เพิ่ม
  authorName?: string;    // เพิ่ม
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