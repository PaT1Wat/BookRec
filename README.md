# 📚 BookRec — ระบบแนะนำหนังสือด้วย AI

BookRec เป็นระบบแนะนำหนังสือสำหรับมังงะ นิยาย และไลท์โนเวล โดยระบบสามารถแนะนำหนังสือให้เหมาะกับความสนใจของผู้ใช้ผ่านข้อมูลพฤติกรรม การเลือกแนวที่ชอบ และระบบ AI Chatbot

ระบบนี้พัฒนาในรูปแบบ Full-stack Web Application โดยใช้ React TypeScript สำหรับ Frontend, Python FastAPI สำหรับ Backend, Supabase สำหรับฐานข้อมูลและระบบ Authentication, LightFM สำหรับระบบแนะนำหนังสือ และ Gemini API สำหรับ AI Chatbot

---

## 🎯 วัตถุประสงค์ของโปรเจกต์

โปรเจกต์ BookRec ถูกพัฒนาขึ้นเพื่อแก้ปัญหาผู้ใช้ไม่รู้ว่าจะอ่านหนังสือเรื่องอะไรดี โดยระบบจะช่วยแนะนำหนังสือที่เหมาะสมกับผู้ใช้แต่ละคนจากข้อมูลหลายส่วน เช่น แนวหนังสือที่ผู้ใช้สนใจ หนังสือที่กดถูกใจ รีวิว และข้อมูลปฏิสัมพันธ์กับหนังสือ

ระบบนี้ยังมี AI Chatbot ที่ช่วยให้ผู้ใช้สามารถถามคำถาม เช่น “แนะนำนิยายแนวโรแมนติกหน่อย” หรือ “อยากอ่านมังงะแฟนตาซี” แล้วระบบจะตอบกลับเป็นคำแนะนำในรูปแบบภาษาธรรมชาติ

---

## 🛠️ เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี |
|------|-----------|
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui |
| Backend | Python 3.10, FastAPI |
| Recommendation | LightFM |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth, Google OAuth |
| AI Chatbot | Gemini API |
| Deployment | Vercel |

---

## 📁 โครงสร้างโปรเจกต์

```txt
📦 readwisely-ai
 ┣ 📂backend
 ┃ ┣ 📂models
 ┃ ┣ 📄main.py
 ┃ ┣ 📄recommend.py
 ┃ ┗ 📄requirements.txt
 ┣ 📂public
 ┃ ┣ 📄favicon.ico
 ┃ ┣ 📄favicon1.ico
 ┃ ┣ 📄placeholder.svg
 ┃ ┣ 📄robots.txt
 ┃ ┗ 📄_redirects
 ┣ 📂src
 ┃ ┣ 📂assets
 ┃ ┃ ┗ 📄hero-banner.jpg
 ┃ ┣ 📂components
 ┃ ┃ ┣ 📂ui
 ┃ ┃ ┣ 📄AIChatButton.tsx
 ┃ ┃ ┣ 📄BookCard.tsx
 ┃ ┃ ┣ 📄BookSection.tsx
 ┃ ┃ ┣ 📄CoverUpload.tsx
 ┃ ┃ ┣ 📄GenreOnboardingGate.tsx
 ┃ ┃ ┣ 📄GenreOnboardingModal.tsx
 ┃ ┃ ┣ 📄HeroSection.tsx
 ┃ ┃ ┣ 📄Navbar.tsx
 ┃ ┃ ┣ 📄NavLink.tsx
 ┃ ┃ ┣ 📄ProtectedRoute.tsx
 ┃ ┃ ┣ 📄RecommendationSection.tsx
 ┃ ┃ ┗ 📄ReviewSection.tsx
 ┃ ┣ 📂context
 ┃ ┃ ┣ 📄AuthContext.tsx
 ┃ ┃ ┗ 📄BooksContext.tsx
 ┃ ┣ 📂data
 ┃ ┃ ┗ 📄books.ts
 ┃ ┣ 📂hooks
 ┃ ┃ ┣ 📄use-mobile.tsx
 ┃ ┃ ┗ 📄use-toast.ts
 ┃ ┣ 📂integrations
 ┃ ┃ ┣ 📂lovable
 ┃ ┃ ┃ ┗ 📄index.ts
 ┃ ┃ ┗ 📂supabase
 ┃ ┃ ┃ ┣ 📄client.ts
 ┃ ┃ ┃ ┗ 📄types.ts
 ┃ ┣ 📂lib
 ┃ ┃ ┣ 📄favorites.ts
 ┃ ┃ ┗ 📄utils.ts
 ┃ ┣ 📂pages
 ┃ ┃ ┣ 📄AdminPage.tsx
 ┃ ┃ ┣ 📄AuthPage.tsx
 ┃ ┃ ┣ 📄BookDetailPage.tsx
 ┃ ┃ ┣ 📄DashboardPage.tsx
 ┃ ┃ ┣ 📄FavoritesPage.tsx
 ┃ ┃ ┣ 📄Index.tsx
 ┃ ┃ ┣ 📄NotFound.tsx
 ┃ ┃ ┣ 📄ProfilePage.tsx
 ┃ ┃ ┣ 📄ResetPasswordPage.tsx
 ┃ ┃ ┗ 📄SearchPage.tsx
 ┃ ┣ 📂test
 ┃ ┃ ┣ 📄example.test.ts
 ┃ ┃ ┗ 📄setup.ts
 ┃ ┣ 📄App.css
 ┃ ┣ 📄App.tsx
 ┃ ┣ 📄index.css
 ┃ ┣ 📄main.tsx
 ┃ ┗ 📄vite-env.d.ts
 ┣ 📂supabase
 ┃ ┣ 📂.temp
 ┃ ┣ 📂migrations
 ┃ ┗ 📄config.toml
 ┣ 📂venv
 ┣ 📄package.json
 ┗ 📄vercel.json

 🧩 อธิบายโครงสร้างโปรเจกต์
Backend

โฟลเดอร์ backend ใช้สำหรับเก็บระบบหลังบ้านของโปรเจกต์ โดยเขียนด้วย Python FastAPI

main.py

เป็นไฟล์หลักของ Backend ทำหน้าที่เปิด FastAPI server และสร้าง API endpoint ต่าง ๆ เช่น

/ สำหรับตรวจสอบสถานะ server
/recommend/{user_id} สำหรับแนะนำหนังสือ
/chat สำหรับรับข้อความจากผู้ใช้และส่งต่อให้ Gemini API

ไฟล์นี้เป็นจุดเชื่อมต่อระหว่าง Frontend, Supabase, ระบบแนะนำ และ AI Chatbot

recommend.py

เป็นไฟล์ที่เกี่ยวกับระบบ Recommendation ใช้ LightFM ในการสร้างโมเดลแนะนำหนังสือ โดยระบบจะนำข้อมูลผู้ใช้ หนังสือ และพฤติกรรมต่าง ๆ มาคำนวณคะแนน แล้วเลือกหนังสือที่เหมาะสมกับผู้ใช้มากที่สุด

requirements.txt

ใช้เก็บรายชื่อ Python packages ที่ Backend ต้องใช้ เช่น FastAPI, Uvicorn, LightFM และ library อื่น ๆ

Public

โฟลเดอร์ public ใช้เก็บ static files ที่ browser สามารถเข้าถึงได้โดยตรง

favicon.ico

เป็นโลโก้หลักของเว็บไซต์ ใช้แสดงบน browser tab และควรใช้ไฟล์นี้เป็น favicon หลักของระบบ

favicon1.ico

เป็นไฟล์ favicon สำรอง ถ้าไม่ได้ใช้งานจริงสามารถลบออกได้เพื่อลดความสับสน

_redirects

ใช้สำหรับแก้ปัญหา routing บน Vercel โดยเฉพาะกรณี React Router เช่น /auth, /profile, /admin ถ้าไม่มีไฟล์นี้อาจเกิดปัญหา 404 เมื่อ refresh หรือเข้าหน้าโดยตรง

Src

โฟลเดอร์ src คือส่วน Frontend ทั้งหมดของระบบ เขียนด้วย React TypeScript

Components

โฟลเดอร์ components ใช้เก็บ component ที่นำไปใช้ซ้ำในหลายหน้า

BookCard.tsx

ใช้แสดงข้อมูลหนังสือแต่ละเล่ม เช่น ปกหนังสือ ชื่อหนังสือ คะแนน และปุ่มต่าง ๆ

BookSection.tsx

ใช้รวมหนังสือหลายเล่มเป็นหมวดหมู่ เช่น ยอดนิยม มาใหม่ หรือหนังสือแนะนำสำหรับคุณ

AIChatButton.tsx

ใช้แสดงปุ่ม Chatbot บนหน้าเว็บ เมื่อผู้ใช้กดจะสามารถคุยกับ AI เพื่อขอคำแนะนำหนังสือได้

GenreOnboardingGate.tsx

ใช้ตรวจสอบว่าผู้ใช้เคยเลือกแนวหนังสือที่สนใจหรือยัง ถ้ายังไม่เคยเลือก ระบบจะแสดง popup ให้เลือกแนวที่ชอบ

GenreOnboardingModal.tsx

เป็น popup สำหรับเลือกแนวหนังสือที่ผู้ใช้สนใจ ข้อมูลนี้จะถูกบันทึกลง Supabase และนำไปใช้เป็นส่วนหนึ่งของระบบแนะนำหนังสือ

ReviewSection.tsx

ใช้แสดงและจัดการรีวิวหนังสือ เช่น คะแนน ความคิดเห็น และข้อมูลผู้รีวิว

Navbar.tsx

เป็นแถบนำทางหลักของเว็บไซต์ เช่น หน้าแรก ค้นหา รายการโปรด โปรไฟล์ และปุ่มเข้าสู่ระบบ

Context

โฟลเดอร์ context ใช้จัดการ global state ของระบบ

AuthContext.tsx

ใช้จัดการระบบผู้ใช้ เช่น

ตรวจสอบว่าผู้ใช้ login อยู่หรือไม่
เก็บข้อมูล session
ตรวจสอบ role ว่าเป็น admin หรือ user
ตรวจสอบว่าผู้ใช้ต้องเลือกแนวหนังสือก่อนหรือไม่
logout ผู้ใช้
BooksContext.tsx

ใช้จัดการข้อมูลหนังสือทั้งหมด เช่น

ดึงหนังสือจาก Supabase
เพิ่มหนังสือ
แก้ไขหนังสือ
ลบหนังสือ
refetch ข้อมูลใหม่หลังมีการเปลี่ยนแปลง 

Integrations
integrations/supabase/client.ts

เป็นไฟล์สำหรับสร้าง Supabase client เพื่อให้ Frontend เชื่อมต่อกับ Supabase ได้

integrations/supabase/types.ts

เป็นไฟล์ TypeScript types ที่ generate จากโครงสร้างฐานข้อมูล Supabase ใช้ช่วยให้เขียน query ได้ปลอดภัยและลด error จากชื่อ table หรือ column ผิด

Pages

โฟลเดอร์ pages ใช้เก็บหน้าหลักของเว็บไซต์

Index.tsx

หน้าแรกของเว็บไซต์ แสดง Hero section, รายการหนังสือยอดนิยม, หนังสือมาใหม่, มังงะ, นิยาย, ไลท์โนเวล และหนังสือแนะนำสำหรับผู้ใช้

SearchPage.tsx

หน้าค้นหาหนังสือ ผู้ใช้สามารถค้นหาหนังสือตามชื่อ ผู้แต่ง หรือแนวหนังสือได้

BookDetailPage.tsx

หน้าแสดงรายละเอียดหนังสือ เช่น ชื่อเรื่อง ปก คำอธิบาย ผู้แต่ง สำนักพิมพ์ คะแนน และรีวิว

FavoritesPage.tsx

หน้าแสดงหนังสือที่ผู้ใช้กดถูกใจหรือบันทึกไว้

AdminPage.tsx

หน้าสำหรับผู้ดูแลระบบ ใช้เพิ่ม แก้ไข และลบข้อมูลหนังสือ รวมถึงจัดการข้อมูลผู้แต่ง สำนักพิมพ์ และแท็ก

DashboardPage.tsx

หน้าแสดงข้อมูลสถิติของระบบ เช่น จำนวนหนังสือ จำนวนผู้ใช้ หรือข้อมูลภาพรวมสำหรับ admin

AuthPage.tsx

หน้าสำหรับเข้าสู่ระบบและสมัครสมาชิก รองรับ Email/Password และ Google OAuth ผ่าน Supabase Auth

ProfilePage.tsx

หน้าโปรไฟล์ผู้ใช้ แสดงข้อมูลผู้ใช้ แนวหนังสือที่สนใจ และสามารถแก้ไขข้อมูลบางส่วนได้

ResetPasswordPage.tsx

หน้าสำหรับรีเซ็ตรหัสผ่าน

NotFound.tsx

หน้า 404 สำหรับกรณีผู้ใช้เข้า route ที่ไม่มีอยู่ในระบบ

Supabase

โฟลเดอร์ supabase ใช้เก็บไฟล์เกี่ยวกับฐานข้อมูล เช่น migrations และ config

migrations

ใช้เก็บประวัติการเปลี่ยนแปลงฐานข้อมูล เช่น การสร้าง table หรือแก้ schema

config.toml

ใช้เก็บ config ของ Supabase CLI

⚙️ ขั้นตอนการติดตั้งก่อนเริ่มใช้งาน

ก่อนเริ่มใช้งานโปรเจกต์ ต้องติดตั้งเครื่องมือพื้นฐานให้พร้อม

1. ติดตั้ง Node.js

ใช้สำหรับรัน Frontend

เวอร์ชันที่แนะนำ:

Node.js >= 18

ตรวจสอบเวอร์ชัน:

node -v
npm -v

2. ติดตั้ง Python

ใช้สำหรับรัน Backend

เวอร์ชันที่แนะนำ:

Python >= 3.10

ตรวจสอบเวอร์ชัน:

python --version

3. ติดตั้ง Git

ใช้สำหรับ clone โปรเจกต์จาก GitHub

ตรวจสอบเวอร์ชัน:

git --version

4. สมัครบัญชี Supabase

Supabase ใช้สำหรับ

เก็บข้อมูลหนังสือ
เก็บข้อมูลผู้ใช้
ระบบ login/register
Google OAuth
Database PostgreSQL

5. สมัครและสร้าง Gemini API Key

Gemini API ใช้สำหรับระบบ AI Chatbot

เข้าไปที่ Google AI Studio แล้วสร้าง API Key จากนั้นนำมาใส่ในไฟล์ .env ของ Backend

📦 ขั้นตอนการติดตั้งโปรเจกต์
1. Clone โปรเจกต์
git clone <YOUR_GIT_URL>
cd readwisely-ai

2. ติดตั้ง Frontend

อยู่ที่ root project แล้วรัน:

npm install

3. สร้างไฟล์ .env สำหรับ Frontend

สร้างไฟล์ .env ที่ root project

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_BACKEND_URL=http://localhost:8000

ตัวแปรเหล่านี้ใช้สำหรับให้ Frontend เชื่อมต่อกับ Supabase และ Backend

4. ติดตั้ง Backend

เข้าไปที่โฟลเดอร์ backend

cd backend

สร้าง virtual environment

python -m venv venv

เปิดใช้งาน virtual environment

Windows:

venv\Scripts\activate

Mac/Linux:

source venv/bin/activate

ติดตั้ง dependencies

pip install -r requirements.txt

5. สร้างไฟล์ .env สำหรับ Backend

สร้างไฟล์ .env ในโฟลเดอร์ backend

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key

คำอธิบาย:
SUPABASE_URL คือ URL ของ Supabase project
SUPABASE_KEY คือ service role key ใช้เฉพาะฝั่ง Backend
GEMINI_API_KEY คือ key สำหรับเรียก Gemini API

🚀 ขั้นตอนการรันโปรเจกต์

โปรเจกต์นี้ต้องรัน 2 ส่วนพร้อมกัน คือ Backend และ Frontend

Terminal 1 — รัน Backend
cd backend
venv\Scripts\activate
uvicorn main:app --reload

Backend จะทำงานที่:

http://localhost:8000

สามารถดู API Docs ได้ที่:

http://localhost:8000/docs

Terminal 2 — รัน Frontend

กลับมาที่ root project แล้วรัน:

npm run dev

Frontend จะทำงานที่:

http://localhost:5173

🔄 ขั้นตอนการทำงานของระบบ
1. ผู้ใช้เข้าสู่เว็บไซต์

เมื่อผู้ใช้เข้าเว็บ ระบบ React จะโหลดหน้าแรกจาก Index.tsx แล้วดึงข้อมูลหนังสือผ่าน BooksContext.tsx

2. ระบบตรวจสอบสถานะผู้ใช้

AuthContext.tsx จะตรวจสอบ Supabase session ว่าผู้ใช้ login อยู่หรือไม่

ถ้ายังไม่ได้ login ผู้ใช้จะเป็น Guest
ถ้า login แล้ว ระบบจะดึงข้อมูล user และ role จาก Supabase

3. ผู้ใช้เลือกแนวหนังสือที่สนใจ

ถ้าผู้ใช้ login ครั้งแรกและยังไม่เคยเลือกแนว ระบบจะแสดง GenreOnboardingModal.tsx

แนวที่ผู้ใช้เลือกจะถูกบันทึกลง table เช่น user_tags
ข้อมูลนี้จะถูกใช้เป็นส่วนหนึ่งของการแนะนำหนังสือ

4. ระบบแนะนำหนังสือ

ระบบแนะนำทำงานได้ 2 ลักษณะ

แบบที่ 1: แนะนำจากแนวที่ผู้ใช้เลือก

Frontend จะดึงแนวที่ผู้ใช้สนใจ แล้วนำมา match กับ tag หรือ genre ของหนังสือ เพื่อแสดงหนังสือที่ตรงความสนใจ

แบบที่ 2: แนะนำจาก Backend

Frontend เรียก API:

GET /recommend/{user_id}

Backend จะใช้ LightFM คำนวณหนังสือที่เหมาะสมจากพฤติกรรมของผู้ใช้ เช่น favorite, review หรือ interaction

5. ผู้ใช้ค้นหาหนังสือ

เมื่อผู้ใช้เข้า SearchPage.tsx ระบบจะกรองหนังสือตามคำค้นหา เช่น ชื่อหนังสือ ผู้แต่ง หรือแท็ก

6. ผู้ใช้ดูรายละเอียดหนังสือ

เมื่อกดหนังสือ ระบบจะพาไปที่ BookDetailPage.tsx เพื่อดูรายละเอียดหนังสือ รีวิว และปุ่ม favorite

7. ผู้ใช้กด favorite หรือ review

ข้อมูล favorite และ review จะถูกบันทึกลง Supabase แล้วสามารถนำไปใช้เป็นข้อมูล interaction สำหรับ recommendation system ได้

8. ผู้ใช้คุยกับ AI Chatbot

เมื่อกดปุ่ม AI Chatbot ระบบจะส่งข้อความผู้ใช้ไปที่ Backend endpoint:

POST /chat

Backend จะส่งข้อความพร้อม context ไปยัง Gemini API แล้วส่งคำตอบกลับมาให้ Frontend แสดงผล

🧠 การทำงานของ Recommendation System

ระบบ Recommendation ใช้ LightFM ซึ่งเป็นโมเดลที่รองรับทั้ง Collaborative Filtering และ Content-based Filtering

ขั้นตอนโดยรวม:

ดึงข้อมูลผู้ใช้ หนังสือ และ interaction จาก Supabase
แปลงข้อมูลเป็น matrix
train หรือ load model
predict score ของหนังสือแต่ละเล่ม
sort ตามคะแนน
ส่งผลลัพธ์กลับเป็นรายการหนังสือแนะนำ

ตัวอย่าง flow:

User Behavior → Interaction Matrix → LightFM Model → Predict Score → Recommended Books
🤖 การทำงานของ AI Chatbot

AI Chatbot ใช้ Gemini API เพื่อสร้างคำตอบจากข้อความผู้ใช้

ขั้นตอน:

ผู้ใช้พิมพ์ข้อความ
Frontend ส่งข้อความไป Backend
Backend รวมข้อมูลหนังสือเป็น context
Backend ส่ง prompt ไป Gemini API
Gemini ตอบกลับ
Frontend แสดงคำตอบใน UI

ตัวอย่าง request:

{
  "message": "แนะนำมังงะแนวแฟนตาซีหน่อย",
  "books": [
    {
      "title": "One Piece",
      "type": "manga",
      "tags": ["ผจญภัย"]
    }
  ]
}

🔐 การทำงานของ Authentication

ระบบใช้ Supabase Auth สำหรับ login/register

รองรับ:

Email/Password
Google OAuth
ขั้นตอน:

ผู้ใช้เข้าสู่ระบบจาก AuthPage.tsx
Supabase ตรวจสอบข้อมูล
Supabase ส่ง session กลับมา
AuthContext.tsx เก็บ session และ user
ระบบใช้ข้อมูล user เพื่อแสดงเมนูและสิทธิ์ที่เหมาะสม

👤 บทบาทผู้ใช้งาน
Role	สิทธิ์
Guest	ดูหนังสือและค้นหา
User	บันทึกหนังสือโปรด รีวิว และใช้ AI Chatbot
Admin	เพิ่ม แก้ไข ลบหนังสือ และดู Dashboard

🛡️ การทำงานของ Admin

Admin สามารถเข้าใช้งานหน้า AdminPage.tsx และ DashboardPage.tsx

ระบบจะตรวจสอบ role จาก Supabase table user

ถ้า role เป็น admin จะสามารถเข้าได้
ถ้าไม่ใช่ admin ระบบจะแสดงข้อความว่าไม่มีสิทธิ์เข้าถึง

ตั้งค่า admin ได้ด้วย SQL:

UPDATE public.user
SET role = 'admin'
WHERE email = 'your-email@example.com';

🌐 การ Deploy บน Vercel

ระบบ Frontend สามารถ deploy บน Vercel ได้

เนื่องจากโปรเจกต์ใช้ React Router จึงต้องมีไฟล์ redirect เพื่อแก้ปัญหา 404 ตอน refresh หน้า เช่น /auth, /profile, /admin
ไฟล์ที่ใช้:

public/_redirects

เนื้อหา:

/* /index.html 200

และสามารถใช้ vercel.json ได้เช่นกัน:

{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}

🖼️ การตั้งค่าโลโก้

ระบบใช้ favicon หลักจากไฟล์:

public/favicon.ico

ถ้าต้องการเปลี่ยนโลโก้บน browser tab ให้เปลี่ยนไฟล์นี้

❗ ปัญหาที่พบบ่อย
Backend import error

ให้ติดตั้ง dependencies ใหม่:

pip install -r requirements.txt

Frontend เชื่อม Supabase ไม่ได้

ตรวจสอบไฟล์ .env

URL ถูกต้องหรือไม่
key ถูกต้องหรือไม่
ไม่มีช่องว่างเกิน

Chatbot ไม่ตอบ

ตรวจสอบว่าใส่ GEMINI_API_KEY ถูกต้องใน backend/.env

Login Google แล้ว redirect error

ตรวจสอบ Supabase Redirect URLs และ Google OAuth settings

ควรมี URL เช่น:

https://your-domain.vercel.app/**

Vercel เข้า /auth แล้ว 404

ตรวจสอบว่าเพิ่มไฟล์ _redirects หรือ vercel.json แล้ว

📌 จุดเด่นของโปรเจกต์
เป็น Full-stack Web Application
มีระบบ Login และ Role
มีระบบ Recommendation ด้วย LightFM
มี AI Chatbot ด้วย Gemini API
ใช้ Supabase เป็นฐานข้อมูลจริง
Deploy ได้จริงบน Vercel
โครงสร้างโค้ดชัดเจนและต่อยอดได้

👨‍💻 ผู้พัฒนา

นายปฏิวัติ เชียงมูล
สาขาวิชาวิทยาการคอมพิวเตอร์