import os
import json
import traceback

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from recommend import get_recommendations, train_and_save_model
from google import genai

app = FastAPI()

# =========================
# CORS
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# GEMINI
# =========================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

print("GEMINI_API_KEY =", GEMINI_API_KEY)

gemini_client = (
    genai.Client(api_key=GEMINI_API_KEY)
    if GEMINI_API_KEY
    else None
)

# =========================
# CHAT
# =========================
@app.post("/chat")
async def chat(body: dict):
    try:
        if not gemini_client:
            return {
                "reply": "ยังไม่ได้ตั้งค่า Gemini API key",
                "recommendations": [],
            }

        user_msg = body.get("message", "")
        books_context = body.get("books", [])
        history = body.get("history", [])
        
        history_text = "\n".join(
            [
                f"{m.get('role')}: {m.get('content')}" 
                for m in history[-10:]  # เอาแค่ 10 ข้อความล่าสุดในประวัติการสนทนา
                if m.get("content")  # กรองข้อความที่ไม่มี content
            ]
        )

        prompt = f"""
        คุณคือ BookBot ผู้ช่วยแนะนำหนังสือภาษาไทย

        ประวัติการสนทนาก่อนหน้า:
        {history_text}

        ข้อมูลหนังสือในระบบ:
        {json.dumps(books_context, ensure_ascii=False)}

        กฎ:
        - ใช้ข้อมูลจากระบบนี้เท่านั้น
        - ห้ามแต่งข้อมูลที่ไม่มีในระบบ
        - ถ้าผู้ใช้พูดต่อจากคำถามก่อนหน้า เช่น "ขอแบบมังงะ", "เอาแนวเดิม", "ขอแบบดราม่า"
            ให้ใช้ประวัติการสนทนาก่อนหน้ามาช่วยตีความ
        - ตอบกลับเป็น JSON เท่านั้น
        - recommendations ต้องเป็น array เสมอ

        รูปแบบ JSON:
        {{
            "reply": "ข้อความตอบกลับ",
            "recommendations": [
                {{
                    "title": "ชื่อหนังสือ",
                    "reason": "เหตุผลที่แนะนำ"
                }},
            ]
        }}

        คำถามล่าสุด:
        {user_msg}
        """

        response = None
        last_error = None
        
        models = [
            "gemini-2.5-flash",
            "gemini-3-flash",
            "gemini-2.5-flash-lite",
        ]
        
        for model in models:
            try:
                print(f"[gemini] Trying model: {model}")

                response = gemini_client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config={
                        "temperature": 0.3,
                        "maxOutputTokens": 2048,
                        "response_mime_type": "application/json",
                    },
                )
                
                print(f"[gemini] Success with model: {model}")
                break  # ถ้าสำเร็จ ให้หยุดลองโมเดลอื่น
            
            except Exception as e:
                last_error = e
                print(f"[gemini] failed {model}: {repr(e)}")
        
        if response is None:
            raise last_error
        

        text = (response.text or "").strip()

        print("\n=== GEMINI RESPONSE ===")
        print(text)
        print("=======================\n")

        # ลบ markdown block
        text = text.replace("```json", "")
        text = text.replace("```", "")
        text = text.strip()

        try:
            parsed = json.loads(text)

            return {
                "reply": parsed.get(
                    "reply",
                    "ผมลองคัดหนังสือที่ใกล้เคียงให้แล้วครับ"
                ),
                "recommendations": parsed.get(
                    "recommendations",
                    []
                ),
            }

        except Exception as json_error:
            print("JSON PARSE ERROR:", json_error)

            return {
                "reply": text or "ระบบยังไม่สามารถตอบได้",
                "recommendations": [],
            }

    except Exception as e:
        print("\n=== CHAT ERROR ===")
        traceback.print_exc()
        print("==================\n")

        return {
            "reply": f"เกิดข้อผิดพลาด: {str(e)}",
            "recommendations": [],
        }

# =========================
# RECOMMEND
# =========================
@app.get("/recommend/{user_id}")
def recommend(user_id: str, genre: str | None = Query(default=None)):
    try:
        genres = genre.split(",") if genre else None

        book_ids = get_recommendations(
            user_id=user_id,
            n=12,
            genres=genres,
        )

        print(
            f"[api] recommend ok "
            f"user={user_id}, "
            f"genres={genres}, "
            f"count={len(book_ids)}"
        )

        return {
            "bookIDs": book_ids
        }

    except Exception as e:
        print(f"[api] recommend failed user={user_id}")
        traceback.print_exc()

        return {
            "bookIDs": [],
            "error": str(e),
        }

# =========================
# RETRAIN
# =========================
@app.post("/admin/retrain")
def retrain():
    try:
        result = train_and_save_model(epochs=10)

        if result is None:
            return {
                "status": "error",
                "message": "Training skipped or failed",
            }

        return {
            "status": "done",
            "message": "Model retrained successfully",
        }

    except Exception as e:
        print("[api] retrain failed")
        traceback.print_exc()

        return {
            "status": "error",
            "message": str(e),
        }

# =========================
# ROOT
# =========================
@app.get("/")
def root():
    return {
        "status": "BookRec API running"
    }