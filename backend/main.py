import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from recommend import get_recommendations
from openai import OpenAI

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# ✅ OpenRouter ใช้ format เดียวกับ OpenAI
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

@app.post("/chat")
async def chat(body: dict):
    user_msg = body.get("message", "")
    books_context = body.get("books", [])

    response = client.chat.completions.create(
        model="meta-llama/llama-3.1-8b-instruct:free",
        messages=[
            {
                "role": "system",
                "content": f"""คุณคือ BookBot ผู้ช่วยแนะนำหนังสือภาษาไทย
ระบบมีหนังสือดังนี้: {books_context}
ช่วยตอบคำถามเกี่ยวกับหนังสือ แนะนำหนังสือ สรุปเนื้อเรื่อง
ตอบเป็นภาษาไทยเสมอ"""
            },
            {"role": "user", "content": user_msg}
        ]
    )
    return {"reply": response.choices[0].message.content}

@app.get("/recommend/{user_id}")
def recommend(user_id: str):
    book_ids = get_recommendations(user_id)
    return {"bookIDs": book_ids}

@app.get("/")
def root():
    return {"status": "BookRec API running"}