export type BookType = "manga" | "novel";

export type Genre = 
  | "โรแมนติก" | "แฟนตาซี" | "แอ็คชัน" | "สืบสวน" 
  | "คอมเมดี้" | "ดราม่า" | "สยองขวัญ" | "ต่างโลก"
  | "อิเซไค" | "โชเน็น" | "โชโจ" | "วาย" | "ชีวิตประจำวัน"
  | "ผจญภัย" | "จิตวิทยา";

export interface Book {
  id: string;
  title: string;
  titleEn?: string;
  author: string;
  publisher: string;
  type: BookType;
  genres: Genre[];
  tags: string[];
  description: string;
  coverUrl: string;
  price: number;
  rating: number;
  reviewCount: number;
  isNew?: boolean;
  isPopular?: boolean;
}

export const genres: Genre[] = [
  "โรแมนติก", "แฟนตาซี", "แอ็คชัน", "สืบสวน",
  "คอมเมดี้", "ดราม่า", "สยองขวัญ", "ต่างโลก",
  "อิเซไค", "โชเน็น", "โชโจ", "วาย", "ชีวิตประจำวัน",
  "ผจญภัย", "จิตวิทยา"
];

export const books: Book[] = [
  {
    id: "1",
    title: "ดาบพิฆาตอสูร",
    titleEn: "Demon Slayer",
    author: "โคโยฮารุ โกโตเกะ",
    publisher: "NED Comics",
    type: "manga",
    genres: ["แอ็คชัน", "แฟนตาซี", "โชเน็น"],
    tags: ["อสูร", "ดาบ", "ครอบครัว", "สู้รบ"],
    description: "เรื่องราวของทันจิโร่ คามาโดะ เด็กหนุ่มผู้ออกเดินทางเพื่อตามหาวิธีเปลี่ยนน้องสาวที่กลายเป็นอสูรกลับมาเป็นมนุษย์ ผ่านการฝึกฝนเป็นนักล่าอสูรและเผชิญศึกมากมาย",
    coverUrl: "https://images.unsplash.com/photo-1612178537253-bccd437b730e?w=300&h=450&fit=crop",
    price: 75,
    rating: 4.9,
    reviewCount: 1250,
    isPopular: true,
  },
  {
    id: "2",
    title: "ผ่าพิภพไททัน",
    titleEn: "Attack on Titan",
    author: "ฮาจิเมะ อิซายามะ",
    publisher: "NED Comics",
    type: "manga",
    genres: ["แอ็คชัน", "ดราม่า", "จิตวิทยา"],
    tags: ["ไททัน", "สงคราม", "อิสรภาพ", "มืด"],
    description: "ในโลกที่มนุษย์ถูกคุกคามโดยไททัน สิ่งมีชีวิตยักษ์กินคน เอเรน เยเกอร์ สาบานว่าจะกำจัดไททันทุกตัว หลังจากไททันทำลายกำแพงบ้านเกิดและฆ่าแม่ของเขา",
    coverUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&h=450&fit=crop",
    price: 75,
    rating: 4.8,
    reviewCount: 980,
    isPopular: true,
  },
  {
    id: "3",
    title: "วันพีซ",
    titleEn: "One Piece",
    author: "เออิจิโร่ โอดะ",
    publisher: "Siam Inter Comics",
    type: "manga",
    genres: ["แอ็คชัน", "ผจญภัย", "คอมเมดี้", "โชเน็น"],
    tags: ["โจรสลัด", "ผจญภัย", "มิตรภาพ", "สมบัติ"],
    description: "การผจญภัยของมังกี้ ดี. ลูฟี่ เด็กหนุ่มที่ฝันจะเป็นราชาโจรสลัด ออกเดินทางรวบรวมลูกเรือเพื่อค้นหาสมบัติในตำนาน วันพีซ",
    coverUrl: "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=300&h=450&fit=crop",
    price: 69,
    rating: 4.9,
    reviewCount: 2100,
    isPopular: true,
  },
  {
    id: "4",
    title: "นิยายรักต่างโลก: เจ้าสาวแห่งจักรพรรดิ",
    author: "ฟ้าใส",
    publisher: "Jamsai",
    type: "novel",
    genres: ["โรแมนติก", "แฟนตาซี", "ต่างโลก"],
    tags: ["ต่างโลก", "จักรพรรดิ", "อบอุ่นหัวใจ", "นางเอกเก่ง"],
    description: "สาวออฟฟิศธรรมดาถูกส่งไปยังโลกต่างมิติ กลายเป็นเจ้าสาวของจักรพรรดิผู้เย็นชา เธอต้องใช้ความรู้สมัยใหม่เอาตัวรอดในวังหลวง",
    coverUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=450&fit=crop",
    price: 299,
    rating: 4.5,
    reviewCount: 340,
    isNew: true,
  },
  {
    id: "5",
    title: "จูจุสึไคเซ็น",
    titleEn: "Jujutsu Kaisen",
    author: "เกเกะ อากุทามิ",
    publisher: "NED Comics",
    type: "manga",
    genres: ["แอ็คชัน", "สยองขวัญ", "โชเน็น"],
    tags: ["คำสาป", "ต่อสู้", "มืด", "โรงเรียน"],
    description: "ยูจิ อิทาโดริ นักเรียนมัธยมที่กลืนนิ้วของราชาคำสาปเพื่อช่วยเพื่อน และถูกดึงเข้าสู่โลกของนักเวทย์คำสาป",
    coverUrl: "https://images.unsplash.com/photo-1601850494422-3cf14624b0b3?w=300&h=450&fit=crop",
    price: 75,
    rating: 4.7,
    reviewCount: 870,
    isPopular: true,
  },
  {
    id: "6",
    title: "เกิดใหม่ทั้งทีก็เป็นสไลม์ไปซะแล้ว",
    titleEn: "That Time I Got Reincarnated as a Slime",
    author: "ฟิวส์",
    publisher: "animag books",
    type: "novel",
    genres: ["แฟนตาซี", "อิเซไค", "คอมเมดี้"],
    tags: ["อิเซไค", "สไลม์", "สร้างอาณาจักร", "OP"],
    description: "ชายวัยกลางคนถูกฆ่าและเกิดใหม่เป็นสไลม์ในโลกแฟนตาซี ด้วยพลังพิเศษเขาค่อยๆ สร้างอาณาจักรของตนเองจากศูนย์",
    coverUrl: "https://images.unsplash.com/photo-1589998059171-988d887df646?w=300&h=450&fit=crop",
    price: 250,
    rating: 4.6,
    reviewCount: 520,
    isPopular: true,
  },
  {
    id: "7",
    title: "ลิขิตรักข้ามภพ",
    author: "ดอกไม้ริมทาง",
    publisher: "เอเวอร์วาย",
    type: "novel",
    genres: ["โรแมนติก", "ดราม่า", "ต่างโลก"],
    tags: ["ข้ามภพ", "ราชสำนัก", "อบอุ่นหัวใจ", "ดราม่า"],
    description: "แพทย์สาวยุคใหม่ตื่นขึ้นมาในร่างหญิงสาวแห่งราชสำนักโบราณ เธอใช้ความรู้ทางการแพทย์เอาตัวรอดและพบรักกับแม่ทัพหนุ่ม",
    coverUrl: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300&h=450&fit=crop",
    price: 320,
    rating: 4.4,
    reviewCount: 280,
    isNew: true,
  },
  {
    id: "8",
    title: "สปาย × แฟมิลี่",
    titleEn: "SPY x FAMILY",
    author: "ทัตสึยะ เอ็นโดะ",
    publisher: "NED Comics",
    type: "manga",
    genres: ["คอมเมดี้", "แอ็คชัน", "ชีวิตประจำวัน"],
    tags: ["สายลับ", "ครอบครัว", "ตลก", "น่ารัก"],
    description: "สายลับระดับชาติต้องสร้างครอบครัวปลอมเพื่อภารกิจ โดยไม่รู้ว่าภรรยาเป็นมือสังหารและลูกบุญธรรมอ่านใจคนได้",
    coverUrl: "https://images.unsplash.com/photo-1513001900722-370f803f498d?w=300&h=450&fit=crop",
    price: 75,
    rating: 4.8,
    reviewCount: 750,
    isPopular: true,
  },
  {
    id: "9",
    title: "ฝากใจไว้กับจันทร์",
    author: "ฮาเน่",
    publisher: "Jamsai",
    type: "novel",
    genres: ["วาย", "โรแมนติก", "ชีวิตประจำวัน"],
    tags: ["วาย", "มหาวิทยาลัย", "อบอุ่นหัวใจ", "หวาน"],
    description: "เรื่องราวรักหวานๆ ของรุ่นพี่นักดนตรีและรุ่นน้องคณะอักษรศาสตร์ที่ค่อยๆ เปิดใจให้กันผ่านบทเพลงและแสงจันทร์",
    coverUrl: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=300&h=450&fit=crop",
    price: 289,
    rating: 4.6,
    reviewCount: 410,
    isNew: true,
  },
  {
    id: "10",
    title: "โคนัน ยอดนักสืบจิ๋ว",
    titleEn: "Detective Conan",
    author: "โกโช อาโอยามะ",
    publisher: "NED Comics",
    type: "manga",
    genres: ["สืบสวน", "แอ็คชัน", "ดราม่า"],
    tags: ["สืบสวน", "ฆาตกรรม", "ปริศนา", "สมาร์ท"],
    description: "ชินอิจิ คุโด้ นักสืบมัธยมอัจฉริยะถูกวายร้ายวางยาจนร่างหดเล็ก เขาใช้ชื่อโคนัน เอโดงาวะ และไขคดีต่างๆ เพื่อตามล่าองค์กรชุดดำ",
    coverUrl: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=300&h=450&fit=crop",
    price: 69,
    rating: 4.7,
    reviewCount: 1800,
    isPopular: true,
  },
  {
    id: "11",
    title: "ตำนานนักรบแห่งสวรรค์",
    author: "มิ่งกมล",
    publisher: "เอเวอร์วาย",
    type: "novel",
    genres: ["แฟนตาซี", "ผจญภัย", "แอ็คชัน"],
    tags: ["จีนกำลังภายใน", "สวรรค์", "นักรบ", "มหากาพย์"],
    description: "เด็กกำพร้าค้นพบคัมภีร์โบราณและก้าวเข้าสู่เส้นทางนักรบ ฝ่าฟันอุปสรรคเพื่อปกป้องดินแดนจากอสูรร้ายที่จะทำลายสวรรค์",
    coverUrl: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=300&h=450&fit=crop",
    price: 350,
    rating: 4.3,
    reviewCount: 190,
    isNew: true,
  },
  {
    id: "12",
    title: "มายฮีโร่ อคาเดเมีย",
    titleEn: "My Hero Academia",
    author: "โคเฮ โฮริโคชิ",
    publisher: "NED Comics",
    type: "manga",
    genres: ["แอ็คชัน", "โชเน็น", "ชีวิตประจำวัน"],
    tags: ["ฮีโร่", "พลังวิเศษ", "โรงเรียน", "ฝัน"],
    description: "ในโลกที่ 80% ของประชากรมีพลังวิเศษ เด็กหนุ่มไร้พลังอย่างมิโดริยะ ฝันอยากเป็นฮีโร่ที่ยิ่งใหญ่ที่สุด",
    coverUrl: "https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=300&h=450&fit=crop",
    price: 75,
    rating: 4.6,
    reviewCount: 680,
  },
];

export function searchBooks(query: string, filters?: { type?: BookType; genres?: Genre[] }): Book[] {
  let result = books;
  
  if (query) {
    const q = query.toLowerCase();
    result = result.filter(b =>
      b.title.toLowerCase().includes(q) ||
      (b.titleEn?.toLowerCase().includes(q)) ||
      b.author.toLowerCase().includes(q) ||
      b.tags.some(t => t.includes(q)) ||
      b.genres.some(g => g.includes(q)) ||
      b.description.toLowerCase().includes(q)
    );
  }

  if (filters?.type) {
    result = result.filter(b => b.type === filters.type);
  }

  if (filters?.genres?.length) {
    result = result.filter(b => filters.genres!.some(g => b.genres.includes(g)));
  }

  return result;
}
