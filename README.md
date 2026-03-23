# 📚 BookRec — ระบบแนะนำหนังสือด้วย AI

ระบบแนะนำหนังสือมังงะ นิยาย และไลท์โนเวล พัฒนาด้วย React TypeScript + Python FastAPI + LightFM + AI Chatbot

---

## 🛠️ เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี |
|------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Python 3.10, FastAPI, LightFM |
| Database | Supabase (PostgreSQL) |
| AI Chatbot | OpenRouter API |
| Auth | Supabase Auth |

---

## 📁 โครงสร้างโปรเจกต์

```
readwisely-ai/
├── src/                    # React Frontend
│   ├── components/         # UI Components
│   ├── context/            # AuthContext, BooksContext
│   ├── pages/              # หน้าต่าง ๆ
│   └── lib/                # Utilities
├── backend/                # Python FastAPI Backend
│   ├── main.py             # API Endpoints
│   ├── recommend.py        # LightFM Model
│   ├── requirements.txt    # Python Dependencies
│   └── .env                # Environment Variables (ไม่ commit)
├── .env                    # Frontend Environment Variables
└── package.json
```

---

## ⚙️ การติดตั้งและรันโปรเจกต์

### สิ่งที่ต้องมีก่อน

- [Node.js](https://nodejs.org/) >= 18
- [Python](https://www.python.org/) >= 3.10
- บัญชี [Supabase](https://supabase.com)
- บัญชี [OpenRouter](https://openrouter.ai)

---

### 1. Clone โปรเจกต์

```bash
git clone <YOUR_GIT_URL>
cd readwisely-ai
```

---

### 2. ติดตั้ง Frontend

```bash
# ติดตั้ง dependencies
npm install

# สร้างไฟล์ .env
```

สร้างไฟล์ `.env` ที่ root ของโปรเจกต์:

```dotenv
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
```

---

### 3. ติดตั้ง Backend

```bash
# เข้าไปในโฟลเดอร์ backend
cd backend

# สร้าง Virtual Environment
python -m venv venv

# เปิดใช้ venv (Windows)
venv\Scripts\activate

# เปิดใช้ venv (Mac/Linux)
source venv/bin/activate

# ติดตั้ง dependencies
pip install -r requirements.txt
```

สร้างไฟล์ `backend/.env`:

```dotenv
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJ...   # service_role key
OPENROUTER_API_KEY=sk-or-v1-...
```

---

### 4. ตั้งค่าฐานข้อมูล Supabase

1. เข้า [Supabase Dashboard](https://supabase.com/dashboard)
2. เปิด **SQL Editor**
3. Copy SQL จากไฟล์ `database/schema.sql` แล้วรัน

---

## 🚀 การรันโปรเจกต์

ต้องรัน **2 terminal พร้อมกัน**

### Terminal 1 — รัน Backend

```bash
cd backend

# เปิด venv (Windows)
venv\Scripts\activate

# เปิด venv (Mac/Linux)
source venv/bin/activate

# รัน FastAPI Server
uvicorn main:app --reload
```

Backend จะรันที่ → **http://localhost:8000**

ดู API Docs ได้ที่ → **http://localhost:8000/docs**

---

### Terminal 2 — รัน Frontend

```bash
# กลับไปที่ root ก่อน
cd ..

# รัน React App
npm run dev
```

Frontend จะรันที่ → **http://localhost:5173**

---

## 🔑 การขอ API Keys

### Supabase Keys

1. เข้า [Supabase Dashboard](https://supabase.com/dashboard)
2. เลือกโปรเจกต์ → **Project Settings → API**
3. Copy:
   - `Project URL` → ใส่ใน `SUPABASE_URL` และ `VITE_SUPABASE_URL`
   - `anon public` → ใส่ใน `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` → ใส่ใน `SUPABASE_KEY` (Backend เท่านั้น ❗)

### OpenRouter API Key

1. เข้า [https://openrouter.ai](https://openrouter.ai)
2. ไปที่ **API Keys → Create**
3. Copy key → ใส่ใน `OPENROUTER_API_KEY`

---

## 📌 Endpoints ของ Backend

| Method | Endpoint | คำอธิบาย |
|--------|----------|-----------|
| GET | `/` | ตรวจสอบสถานะ Server |
| GET | `/recommend/{user_id}` | แนะนำหนังสือสำหรับ User |
| POST | `/chat` | สนทนากับ AI Chatbot |

### ตัวอย่าง Request /chat

```json
POST http://localhost:8000/chat
{
  "message": "แนะนำมังงะแนวแฟนตาซีหน่อย",
  "books": [
    { "title": "One Piece", "type": "manga", "tags": ["ผจญภัย"] }
  ]
}
```

---

## 👤 บทบาทผู้ใช้งาน

| Role | สิทธิ์ |
|------|--------|
| Guest | ดูหนังสือ ค้นหา |
| User | บันทึกหนังสือโปรด รีวิว ใช้ Chatbot |
| Admin | จัดการหนังสือ ดู Dashboard สถิติ |

### ตั้งค่า Admin

รัน SQL นี้ใน Supabase SQL Editor:

```sql
UPDATE public.user
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

---

## ❗ ปัญหาที่พบบ่อย

**Backend รันแล้ว import error**
```bash
pip install -r requirements.txt
```

**Frontend เชื่อม Supabase ไม่ได้**
→ เช็คไฟล์ `.env` ว่า key ถูกต้องและไม่มีช่องว่างหน้าหลัง

**Chatbot ตอบ error**
→ เช็ค `OPENROUTER_API_KEY` ใน `backend/.env`

**LightFM warning เรื่อง OpenMP**
→ ไม่กระทบการทำงาน เป็นแค่ warning ปกติบน Windows

---

## 👨‍💻 ผู้พัฒนา

นายปฏิวัติ เชียงมูล — สาขาวิชาวิทยาการคอมพิวเตอร์