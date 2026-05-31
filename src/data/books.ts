// ===== TYPE =====
export type BookType = string;
export type Genre = string;

// ===== MAIN BOOK TYPE =====
export interface Book {
  bookID: number;
  id: string;

  title: string;
  titleEn?: string;

  description: string;
  coverUrl: string;

  publishDate?: string;
  slug?: string;

  publisher?: string;
  publisherName?: string;
  authorName?: string;
  type?: BookType;

  tags: Genre[];
  genres: Genre[];

  publisherID?: number;
  typeId?: number;
  tagIDs?: number[];

  author?: string;
  rating?: number;
  reviewCount?: number;
  price?: number;

  isNew?: boolean;
  isPopular?: boolean;
  isHidden?: boolean;   // ✅ เพิ่มตรงนี้

  favoriteCount?: number;
  reviewActionCount?: number;
  viewCount?: number;
}

// ===== STATIC GENRES =====
export const genres: Genre[] = [
  "แฟนตาซี", "โรแมนติก", "แอ็กชัน", "คอมเมดี้", "ดราม่า",
  "สืบสวน", "สยองขวัญ", "ชีวิตประจำวัน", "ผจญภัย", "เหนือธรรมชาติ",
];

export const sampleBooks: Book[] = [];