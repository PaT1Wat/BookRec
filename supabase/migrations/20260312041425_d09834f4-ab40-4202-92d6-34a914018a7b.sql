
CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_en text,
  author text NOT NULL,
  publisher text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'manga',
  genres text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  cover_url text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  is_new boolean NOT NULL DEFAULT false,
  is_popular boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view books" ON public.books
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can insert books" ON public.books
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update books" ON public.books
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete books" ON public.books
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.books (title, title_en, author, publisher, type, genres, tags, description, cover_url, price, rating, review_count, is_new, is_popular) VALUES
('ดาบพิฆาตอสูร', 'Demon Slayer', 'โคโยฮารุ โกโตเกะ', 'NED Comics', 'manga', ARRAY['แอ็คชัน','แฟนตาซี','โชเน็น'], ARRAY['อสูร','ดาบ','ครอบครัว','สู้รบ'], 'เรื่องราวของทันจิโร่ คามาโดะ เด็กหนุ่มผู้ออกเดินทางเพื่อตามหาวิธีเปลี่ยนน้องสาวที่กลายเป็นอสูรกลับมาเป็นมนุษย์', 'https://images.unsplash.com/photo-1612178537253-bccd437b730e?w=300&h=450&fit=crop', 75, 4.9, 1250, false, true),
('ผ่าพิภพไททัน', 'Attack on Titan', 'ฮาจิเมะ อิซายามะ', 'NED Comics', 'manga', ARRAY['แอ็คชัน','ดราม่า','จิตวิทยา'], ARRAY['ไททัน','สงคราม','อิสรภาพ','มืด'], 'ในโลกที่มนุษย์ถูกคุกคามโดยไททัน เอเรน เยเกอร์ สาบานว่าจะกำจัดไททันทุกตัว', 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&h=450&fit=crop', 75, 4.8, 980, false, true),
('วันพีซ', 'One Piece', 'เออิจิโร่ โอดะ', 'Siam Inter Comics', 'manga', ARRAY['แอ็คชัน','ผจญภัย','คอมเมดี้','โชเน็น'], ARRAY['โจรสลัด','ผจญภัย','มิตรภาพ','สมบัติ'], 'การผจญภัยของมังกี้ ดี. ลูฟี่ เด็กหนุ่มที่ฝันจะเป็นราชาโจรสลัด', 'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=300&h=450&fit=crop', 69, 4.9, 2100, false, true),
('นิยายรักต่างโลก: เจ้าสาวแห่งจักรพรรดิ', NULL, 'ฟ้าใส', 'Jamsai', 'novel', ARRAY['โรแมนติก','แฟนตาซี','ต่างโลก'], ARRAY['ต่างโลก','จักรพรรดิ','อบอุ่นหัวใจ','นางเอกเก่ง'], 'สาวออฟฟิศธรรมดาถูกส่งไปยังโลกต่างมิติ กลายเป็นเจ้าสาวของจักรพรรดิผู้เย็นชา', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=450&fit=crop', 299, 4.5, 340, true, false),
('จูจุสึไคเซ็น', 'Jujutsu Kaisen', 'เกเกะ อากุทามิ', 'NED Comics', 'manga', ARRAY['แอ็คชัน','สยองขวัญ','โชเน็น'], ARRAY['คำสาป','ต่อสู้','มืด','โรงเรียน'], 'ยูจิ อิทาโดริ นักเรียนมัธยมที่กลืนนิ้วของราชาคำสาป', 'https://images.unsplash.com/photo-1601850494422-3cf14624b0b3?w=300&h=450&fit=crop', 75, 4.7, 870, false, true),
('เกิดใหม่ทั้งทีก็เป็นสไลม์ไปซะแล้ว', 'That Time I Got Reincarnated as a Slime', 'ฟิวส์', 'animag books', 'novel', ARRAY['แฟนตาซี','อิเซไค','คอมเมดี้'], ARRAY['อิเซไค','สไลม์','สร้างอาณาจักร','OP'], 'ชายวัยกลางคนถูกฆ่าและเกิดใหม่เป็นสไลม์ในโลกแฟนตาซี', 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=300&h=450&fit=crop', 250, 4.6, 520, false, true),
('ลิขิตรักข้ามภพ', NULL, 'ดอกไม้ริมทาง', 'เอเวอร์วาย', 'novel', ARRAY['โรแมนติก','ดราม่า','ต่างโลก'], ARRAY['ข้ามภพ','ราชสำนัก','อบอุ่นหัวใจ','ดราม่า'], 'แพทย์สาวยุคใหม่ตื่นขึ้นมาในร่างหญิงสาวแห่งราชสำนักโบราณ', 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300&h=450&fit=crop', 320, 4.4, 280, true, false),
('สปาย × แฟมิลี่', 'SPY x FAMILY', 'ทัตสึยะ เอ็นโดะ', 'NED Comics', 'manga', ARRAY['คอมเมดี้','แอ็คชัน','ชีวิตประจำวัน'], ARRAY['สายลับ','ครอบครัว','ตลก','น่ารัก'], 'สายลับระดับชาติต้องสร้างครอบครัวปลอมเพื่อภารกิจ', 'https://images.unsplash.com/photo-1513001900722-370f803f498d?w=300&h=450&fit=crop', 75, 4.8, 750, false, true),
('ฝากใจไว้กับจันทร์', NULL, 'ฮาเน่', 'Jamsai', 'novel', ARRAY['วาย','โรแมนติก','ชีวิตประจำวัน'], ARRAY['วาย','มหาวิทยาลัย','อบอุ่นหัวใจ','หวาน'], 'เรื่องราวรักหวานๆ ของรุ่นพี่นักดนตรีและรุ่นน้องคณะอักษรศาสตร์', 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=300&h=450&fit=crop', 289, 4.6, 410, true, false),
('โคนัน ยอดนักสืบจิ๋ว', 'Detective Conan', 'โกโช อาโอยามะ', 'NED Comics', 'manga', ARRAY['สืบสวน','แอ็คชัน','ดราม่า'], ARRAY['สืบสวน','ฆาตกรรม','ปริศนา','สมาร์ท'], 'ชินอิจิ คุโด้ นักสืบมัธยมอัจฉริยะถูกวายร้ายวางยาจนร่างหดเล็ก', 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=300&h=450&fit=crop', 69, 4.7, 1800, false, true),
('ตำนานนักรบแห่งสวรรค์', NULL, 'มิ่งกมล', 'เอเวอร์วาย', 'novel', ARRAY['แฟนตาซี','ผจญภัย','แอ็คชัน'], ARRAY['จีนกำลังภายใน','สวรรค์','นักรบ','มหากาพย์'], 'เด็กกำพร้าค้นพบคัมภีร์โบราณและก้าวเข้าสู่เส้นทางนักรบ', 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=300&h=450&fit=crop', 350, 4.3, 190, true, false),
('มายฮีโร่ อคาเดเมีย', 'My Hero Academia', 'โคเฮ โฮริโคชิ', 'NED Comics', 'manga', ARRAY['แอ็คชัน','โชเน็น','ชีวิตประจำวัน'], ARRAY['ฮีโร่','พลังวิเศษ','โรงเรียน','ฝัน'], 'ในโลกที่ 80% ของประชากรมีพลังวิเศษ เด็กหนุ่มไร้พลังฝันอยากเป็นฮีโร่ที่ยิ่งใหญ่ที่สุด', 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=300&h=450&fit=crop', 75, 4.6, 680, false, false);
