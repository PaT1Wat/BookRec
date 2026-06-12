import os
import json
import time
import asyncio
import traceback
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from recommend import get_recommendations, train_and_save_model
from google import genai

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── Books cache ────────────────────────────────────────────────────────────
_books_cache: list = []
_books_cache_time: float = 0
CACHE_TTL = 600  # 10 min

# ─── ดึงหนังสือทั้งหมดจาก Supabase ─────────────────────────────────────────
async def _fetch_all_books() -> list:
    """ดึงหนังสือทุกเล่มพร้อม tags และ type"""
    loop = asyncio.get_event_loop()
    
    def _sync_fetch():
        res = supabase.table("books").select(
            "bookID, title, titleEn, rating, is_hidden, "
            "book_type!fk_book_type(slug), "
            "author!books_authorID_fkey(authorName), "
            "bookTag(tag:tagID(tagName))"
        ).order("bookID", desc=True).execute()
        return res.data or []

    rows = await loop.run_in_executor(None, _sync_fetch)

    books = []
    for b in rows:
        if b.get("is_hidden"):
            continue
        tags = [
            bt["tag"]["tagName"]
            for bt in (b.get("bookTag") or [])
            if bt.get("tag") and bt["tag"].get("tagName")
        ]
        books.append({
            "title":      b.get("title", ""),
            "titleEn":    b.get("titleEn", ""),
            "type":       (b.get("book_type") or {}).get("slug", ""),
            "tags":       tags[:8],
            "rating":     float(b.get("rating") or 0),
            "author":     ((b.get("author") or {}).get("authorName") or ""),
        })
    return books

async def get_books() -> list:
    global _books_cache, _books_cache_time
    now = time.time()
    if _books_cache and (now - _books_cache_time) < CACHE_TTL:
        return _books_cache
    try:
        data = await _fetch_all_books()
        _books_cache = data
        _books_cache_time = now
        print(f"[cache] refreshed — {len(data)} books")
        return data
    except Exception as e:
        print(f"[cache] fetch failed: {e}")
        return _books_cache  # ใช้ cache เก่าถ้า fetch ไม่ได้

# ─── Background refresh ทุก 5 นาที ─────────────────────────────────────────
async def _bg_refresh():
    while True:
        await asyncio.sleep(300)
        try:
            data = await _fetch_all_books()
            global _books_cache, _books_cache_time
            _books_cache = data
            _books_cache_time = time.time()
            print(f"[bg_refresh] {len(data)} books")
        except Exception as e:
            print(f"[bg_refresh] failed: {e}")

@app.on_event("startup")
async def startup():
    await get_books()
    asyncio.create_task(_bg_refresh())
    print("[startup] books cache ready")

# ─── CHAT ───────────────────────────────────────────────────────────────────
@app.post("/chat")
async def chat(body: dict):
    try:
        if not gemini_client:
            return {"reply": "ยังไม่ได้ตั้งค่า Gemini API key", "recommendations": []}

        user_msg = body.get("message", "")
        history  = body.get("history", [])
        books_context = await get_books()

        history_text = "\n".join(
            f"{m.get('role')}: {m.get('content')}"
            for m in history[-10:]
            if m.get("content")
        )

        # ─── Compact format: ส่งหนังสือครบทุกเล่มแต่ใช้ key สั้น ───────────────
        # t=title, e=titleEn, k=type, g=tags, a=author
        compact_books = [
            {
                "t": b.get("title", ""),
                "e": b.get("titleEn", ""),
                "k": b.get("type", ""),
                "g": b.get("tags", [])[:4], 
                "a": b.get("author", ""),
            }
            for b in books_context
        ][:300]
        books_json = json.dumps(compact_books, ensure_ascii=False, separators=(",", ":"))

        prompt = f"""คุณคือ BookBot ผู้ช่วยแนะนำหนังสือภาษาไทย

ประวัติ:{history_text}

ฐานข้อมูลหนังสือทั้งหมด({len(compact_books)}เล่ม) — t=ชื่อไทย,e=ชื่อEng,k=ประเภท,g=แนว/tag,a=ผู้แต่ง:
{books_json}

กฎ:
- ใช้ข้อมูลจากฐานข้อมูลนี้เท่านั้น อย่าแต่งหนังสือที่ไม่มีในระบบ
- ถ้าผู้ใช้พูดต่อจากคำถามก่อนหน้า ให้ใช้ประวัติการสนทนาช่วยตีความ
- ถ้าไม่พบหนังสือตรงตามที่ขอ ให้บอกตรงๆ และแนะนำที่ใกล้เคียงที่สุด
- ตอบกลับเป็น JSON เท่านั้น โดย recommendations ต้องเป็น array เสมอ
- ใน recommendations ให้ใช้ชื่อจาก field "t" เป็น title เสมอ

รูปแบบ:{{"reply":"ข้อความตอบ","recommendations":[{{"title":"ชื่อหนังสือ (field t)","reason":"เหตุผล"}}]}}
คำถาม:{user_msg}"""

        response = None
        last_error = None
        models = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-2.0-flash"]

        for model in models:
            try:
                response = gemini_client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config={
                        "temperature": 0.3,
                        "maxOutputTokens": 1024,
                        "response_mime_type": "application/json",
                    },
                )
                print(f"[gemini] ok: {model}")
                break
            except Exception as e:
                last_error = e
                print(f"[gemini] failed {model}: {repr(e)}")
                time.sleep(2)

        if response is None:
            raise last_error

        text = (response.text or "").strip()

        # ลบ markdown fences
        text = text.replace("```json", "").replace("```", "").strip()

        def safe_extract(raw: str) -> dict:
            """พยายาม extract reply+recommendations จาก string ทุกรูปแบบ"""
            raw = raw.strip()

            # 1. parse ตรงๆ
            try:
                obj = json.loads(raw)
                if isinstance(obj, dict):
                    return obj
            except Exception:
                pass

            # 2. ถ้า JSON truncated → ลอง repair โดยปิด bracket ที่เปิดค้างไว้
            try:
                # นับ { และ [ ที่เปิดไว้แต่ยังไม่ปิด
                depth_curly = 0
                depth_square = 0
                in_string = False
                escape_next = False
                for ch in raw:
                    if escape_next:
                        escape_next = False
                        continue
                    if ch == "\\" and in_string:
                        escape_next = True
                        continue
                    if ch == '"' and not escape_next:
                        in_string = not in_string
                        continue
                    if in_string:
                        continue
                    if ch == "{": depth_curly += 1
                    elif ch == "}": depth_curly -= 1
                    elif ch == "[": depth_square += 1
                    elif ch == "]": depth_square -= 1

                repaired = raw
                repaired += "]" * max(0, depth_square)
                repaired += "}" * max(0, depth_curly)
                obj = json.loads(repaired)
                if isinstance(obj, dict):
                    return obj
            except Exception:
                pass

            return {}

        obj = safe_extract(text)

        reply = obj.get("reply", "")

        # unwrap ถ้า reply เป็น JSON string ซ้อนอีกชั้น
        if isinstance(reply, str) and reply.strip().startswith("{"):
            try:
                inner = json.loads(reply.strip())
                reply = inner.get("reply", reply)
                if not obj.get("recommendations") and inner.get("recommendations"):
                    obj["recommendations"] = inner["recommendations"]
            except Exception:
                pass

        if not reply:
            reply = text  # fallback ส่ง raw text ดีกว่าเงียบ

        return {
            "reply":           reply,
            "recommendations": obj.get("recommendations", []),
            "total_books":     len(books_context),
        }

    except Exception as e:
        traceback.print_exc()
        return {"reply": f"เกิดข้อผิดพลาด: {str(e)}", "recommendations": []}


@app.post("/cache/refresh")
async def refresh_cache():
    """Force refresh books cache"""
    global _books_cache, _books_cache_time
    _books_cache_time = 0
    data = await get_books()
    return {"status": "ok", "count": len(data)}


@app.get("/recommend/{user_id}")
def recommend(user_id: str, genre: str | None = Query(default=None)):
    try:
        genres = genre.split(",") if genre else None
        book_ids = get_recommendations(user_id=user_id, n=12, genres=genres)
        return {"bookIDs": book_ids}
    except Exception as e:
        traceback.print_exc()
        return {"bookIDs": [], "error": str(e)}


@app.post("/admin/retrain")
def retrain():
    try:
        result = train_and_save_model(epochs=10)
        if result is None:
            return {"status": "error", "message": "Training skipped or failed"}
        return {"status": "done", "message": "Model retrained successfully"}
    except Exception as e:
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


@app.get("/")
def root():
    return {"status": "BookRec API running", "cached_books": len(_books_cache)}