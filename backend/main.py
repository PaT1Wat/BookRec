import os
import json
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


@app.post("/chat")
async def chat(body: dict):
    try:
        if not gemini_client:
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
- ตอบเป็น JSON เท่านั้น

รูปแบบ JSON:
{{
  "reply": "ข้อความสั้น ๆ",
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

        text = (getattr(response, "text", "") or "").strip()
        text = text.replace("```json", "").replace("```", "").strip()

        try:
            parsed = json.loads(text)
            return {
                "reply": parsed.get("reply", "ผมลองคัดหนังสือที่ใกล้เคียงให้แล้วครับ"),
                "recommendations": parsed.get("recommendations", []),
            }
        except Exception:
            return {"reply": text or "ระบบยังไม่สามารถตอบได้", "recommendations": []}

    except Exception as e:
        print("[api] chat failed:", e)
        return {"reply": "ระบบแชตกำลังมีปัญหาชั่วคราว", "recommendations": []}


@app.get("/recommend/{user_id}")
def recommend(user_id: str, genre: str | None = Query(default=None)):
    try:
        genres = genre.split(",") if genre else None

        book_ids = get_recommendations(
            user_id=user_id,
            n=12,
            genres=genres,
        )

        print(f"[api] recommend ok user={user_id}, genres={genres}, count={len(book_ids)}")

        return {"bookIDs": book_ids}

    except Exception as e:
        print(f"[api] recommend failed user={user_id}: {e}")
        return {"bookIDs": [], "error": str(e)}


@app.post("/admin/retrain")
def retrain():
    try:
        result = train_and_save_model(epochs=10)

        if result is None:
            return {"status": "error", "message": "Training skipped or failed"}

        return {"status": "done", "message": "Model retrained successfully"}

    except Exception as e:
        print("[api] retrain failed:", e)
        return {
            "reply": f"เกิดข้อผิดพลาด: {str(e)}",
            "recommendations": [],
        }


@app.get("/")
def root():
    return {"status": "BookRec API running"}
