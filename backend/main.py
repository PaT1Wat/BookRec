import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from recommend import get_recommendations, compute_all_recommendations, train_and_save_model
from google import genai

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================
# GEMINI CONFIG
# =============================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=GEMINI_API_KEY)


# =============================================================
# CHAT
# =============================================================

@app.post("/chat")
async def chat(body: dict):
    try:
        if not GEMINI_API_KEY:
            return {"reply": "ยังไม่ได้ตั้งค่า Gemini API key", "recommendations": []}

        user_msg = body.get("message", "")
        books_context = body.get("books", [])

        prompt = f"""
คุณคือ BookBot ผู้ช่วยแนะนำหนังสือภาษาไทย

ข้อมูลหนังสือในระบบ:
{books_context}

กฎ:
- ใช้ข้อมูลจากระบบนี้เท่านั้น
- ห้ามแต่งข้อมูลที่ไม่มีในระบบ
- ถ้าไม่มีข้อมูลพอ ให้ตอบว่าระบบยังไม่มีข้อมูล
- ตอบเป็น JSON เท่านั้น ห้ามมี markdown ห้ามมี ``` ห้ามมีคำอธิบายนอก JSON
- recommendations ให้เลือกไม่เกิน 5 เล่ม
- reason ต้องสั้น กระชับ ไม่เกิน 1 ประโยค

รูปแบบ JSON:
{{
  "reply": "ข้อความสั้น ๆ 1-2 ประโยค",
  "recommendations": [
    {{
      "title": "ชื่อหนังสือ",
      "reason": "เหตุผลสั้น ๆ"
    }}
  ]
}}

คำถามของผู้ใช้:
{user_msg}
"""

        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        reply_text = getattr(response, "text", None)
        if not reply_text:
            return {
                "reply": "ขออภัย ระบบยังไม่สามารถสร้างคำตอบได้",
                "recommendations": [],
            }

        import json

        cleaned = reply_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned.replace("```json", "", 1).strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.replace("```", "", 1).strip()
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

        try:
            parsed = json.loads(cleaned)
            return {
                "reply": parsed.get("reply", "ผมลองคัดหนังสือที่ใกล้เคียงให้แล้วครับ"),
                "recommendations": parsed.get("recommendations", []),
            }
        except Exception:
            return {
                "reply": cleaned or "ขออภัย ระบบยังไม่สามารถสร้างคำตอบได้",
                "recommendations": [],
            }

    except Exception as e:
        print(f"[api] chat failed: {e}")
        return {
            "reply": "ขออภัย ระบบแชตกำลังมีปัญหาชั่วคราว",
            "recommendations": [],
        }


# =============================================================
# RECOMMEND (per user — รองรับ genre)
# =============================================================

@app.get("/recommend/{user_id}")
def recommend(user_id: str, genre: str | None = Query(default=None)):
    try:
        book_ids = get_recommendations(user_id, n=12, genre=genre)
        print(f"[api] recommend ok for user={user_id}, genre={genre}, count={len(book_ids)}")
        return {"bookIDs": book_ids}
    except Exception as e:
        print(f"[api] recommend failed for {user_id}, genre={genre}: {e}")
        return {"bookIDs": [], "error": str(e)}


# =============================================================
# ADMIN — COMPUTE ALL RECS
# =============================================================

@app.post("/admin/compute-recs")
def compute_recs():
    try:
        result = compute_all_recommendations(n=24)
        return result
    except Exception as e:
        print(f"[api] compute_recs failed: {e}")
        return {"status": "error", "message": str(e)}


# =============================================================
# ADMIN — RETRAIN ONLY
# =============================================================

@app.post("/admin/retrain")
def retrain():
    try:
        result = train_and_save_model(epochs=10)

        if result is None:
            return {
                "status": "error",
                "message": "Training skipped or failed"
            }

        return {
            "status": "done",
            "message": "Model retrained successfully"
        }
    except Exception as e:
        print(f"[api] retrain failed: {e}")
        return {"status": "error", "message": str(e)}


# =============================================================
# ROOT
# =============================================================

@app.get("/")
def root():
    return {"status": "BookRec API running"}