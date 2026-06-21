import os
import pickle
from pathlib import Path
from collections import defaultdict
from functools import lru_cache

import numpy as np
from dotenv import load_dotenv
from lightfm import LightFM
from lightfm.data import Dataset
from supabase import create_client

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

BASE_DIR = Path(__file__).parent
MODEL_DIR = BASE_DIR / "models"
MODEL_FILE = MODEL_DIR / "lightfm.pkl"


def fetch_table(name):
    """ดึงข้อมูลทั้งหมดจาก Supabase table ที่ระบุ"""
    return supabase.table(name).select("*").execute().data or []


@lru_cache(maxsize=1)
def fetch_data():
    """
    ดึงข้อมูลหลักทั้งหมดที่ใช้ในระบบแนะนำ และ cache ไว้ในหน่วยความจำ
    เพื่อไม่ต้องดึงซ้ำทุกครั้งที่มีการเรียกใช้
    ประกอบด้วย: books, interaction, tag, bookTag
    """
    return {
        "books": fetch_table("books"),
        "interaction": fetch_table("interaction"),
        "tag": fetch_table("tag"),
        "bookTag": fetch_table("bookTag"),
    }


def clear_cache():
    """ล้าง cache ของ fetch_data เพื่อบังคับให้ดึงข้อมูลใหม่จาก Supabase"""
    fetch_data.cache_clear()


def get_book_id(row):
    """ดึง bookID จาก row ของ interaction โดยรองรับหลายรูปแบบชื่อ field"""
    return row.get("bookID") or row.get("book_id") or row.get("bookId")


def action_weight(action, rating=None):
    """
    คำนวณ weight จาก action และ rating
    - favorite: 5.0 (แสดงความชอบชัดเจนที่สุด)
    - review: คำนวณจากดาว 1-5
        - 5 ดาว = 5.0 (ชอบมาก)
        - 4 ดาว = 3.8
        - 3 ดาว = 2.6 (กลางๆ)
        - 2 ดาว = 1.4
        - 1 ดาว = -1.0 (ไม่ชอบ → กรองออกเพราะ weight <= 0)
    - view: 0.1 (แค่คลิกดู ยังไม่แน่ใจว่าชอบ)
    """
    if action == "favorite":
        return 5.0
    if action == "view":
        return 0.1
    if action == "review":
        if rating is None: 
            return 2.5  # ไม่มีดาว → กลางๆ
        # สูตร: แปลง rating 1-5 → weight -1.0 ถึง 5.0
        return round(1.5 * rating - 2.5, 2)
    return 0.0


def clean_ids(ids):
    """
    กรอง None ออก และ deduplicate list ของ ID
    คืนค่าเป็น list ของ string ที่ไม่ซ้ำกัน
    """
    result = []
    for value in ids:
        if value is None:
            continue
        value = str(value)
        if value not in result:
            result.append(value)
    return result


def build_book_tags(data):
    """
    สร้าง dict mapping bookID → set of tagName
    ใช้สำหรับ filter หนังสือตาม genre และสร้าง item features ให้ LightFM
    """
    tag_map = {
        tag.get("tagID"): tag.get("tagName")
        for tag in data["tag"]
    }
    book_tags = defaultdict(set)
    for row in data["bookTag"]:
        book_id = row.get("bookID")
        tag_id = row.get("tagID")
        tag_name = tag_map.get(tag_id)
        if book_id and tag_name:
            book_tags[str(book_id)].add(str(tag_name))
    return book_tags


def book_match_genres(book_id, genres, book_tags):
    """
    ตรวจสอบว่าหนังสือมี genre ตรงตามที่ต้องการทุกตัวหรือไม่
    ถ้า genres ว่าง → คืน True (ไม่กรอง)
    """
    if not genres:
        return True
    need = {str(g).strip().lower() for g in genres}
    tags = {str(t).strip().lower() for t in book_tags.get(str(book_id), set())}
    return need.issubset(tags)


def filter_by_genres(ids, genres, book_tags):
    """กรอง list ของ bookID ให้เหลือเฉพาะหนังสือที่ตรง genre ที่ระบุ"""
    return [
        book_id
        for book_id in clean_ids(ids)
        if book_match_genres(book_id, genres, book_tags)
    ]


def get_interacted_books(user_id, data):
    """
    ดึง set ของ bookID ที่ผู้ใช้เคย interact แล้ว (favorite, review, view)
    ใช้สำหรับกรองหนังสือที่เคยดูแล้วออกจากผลแนะนำ
    """
    interacted = set()
    for row in data["interaction"]:
        if str(row.get("user_id")) == str(user_id):
            book_id = get_book_id(row)
            if book_id:
                interacted.add(str(book_id))
    return interacted


def build_item_features(data):
    """
    สร้าง dict mapping bookID → list of "tag:tagName"
    ใช้เป็น item features ให้ LightFM เรียนรู้ความสัมพันธ์ระหว่าง tag กับความชอบของผู้ใช้
    """
    book_tags = build_book_tags(data)
    features = {}
    for book in data["books"]:
        book_id = book.get("bookID")
        if not book_id:
            continue
        features[str(book_id)] = [
            f"tag:{tag}"
            for tag in book_tags.get(str(book_id), set())
        ]
    return features


def train_and_save_model(epochs=10):
    """
    Train LightFM model จาก interaction ทั้งหมดในระบบ แล้วบันทึกลงไฟล์ .pkl

    ขั้นตอน:
    1. ดึงข้อมูล interaction ทั้งหมด
    2. คำนวณ weight ของแต่ละ interaction จาก action_weight()
    3. กรองเฉพาะ interaction ที่มี weight > 0 (ตัด 1 ดาวออก)
    4. สร้าง item features จาก tag ของแต่ละหนังสือ
    5. Train LightFM ด้วย WARP loss (เหมาะกับ implicit feedback)
    6. บันทึก model, dataset, item_feature_tuples ลงไฟล์
    """
    clear_cache()
    data = fetch_data()

    users = set()
    items = set()

    for book in data["books"]:
        book_id = book.get("bookID")
        if book_id:
            items.add(str(book_id))

    interaction_rows = []
    for row in data["interaction"]:
        user_id = row.get("user_id")
        book_id = get_book_id(row)
        rating = row.get("rating")
        weight = action_weight(row.get("actionType"), rating)
        if user_id and book_id and weight > 0:
            users.add(str(user_id))
            items.add(str(book_id))
            interaction_rows.append((str(user_id), str(book_id), weight))

    if not users or not items or not interaction_rows:
        return None

    item_features_map = build_item_features(data)

    all_features = set()
    for values in item_features_map.values():
        all_features.update(values)

    dataset = Dataset()
    dataset.fit(
        users=list(users),
        items=list(items),
        item_features=list(all_features),
    )

    interactions, weights = dataset.build_interactions(interaction_rows)

    item_feature_tuples = [
        (book_id, values)
        for book_id, values in item_features_map.items()
    ]

    item_features = dataset.build_item_features(item_feature_tuples)

    model = LightFM(
        loss="warp",       # WARP: เหมาะกับ implicit feedback (ไม่มี negative sample)
        no_components=8,   # จำนวน latent dimension
        learning_rate=0.05,
        random_state=42,
    )

    model.fit(
        interactions,
        sample_weight=weights,
        item_features=item_features,
        epochs=epochs,
        num_threads=1,
    )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    with open(MODEL_FILE, "wb") as file:
        pickle.dump(
            {
                "model": model,
                "dataset": dataset,
                "item_feature_tuples": item_feature_tuples,
            },
            file,
        )

    print(f"[train] done — users={len(users)}, items={len(items)}, features={len(all_features)}")
    return True


def load_model():
    """โหลด model ที่ train แล้วจากไฟล์ .pkl คืน None ถ้าไม่มีไฟล์"""
    if not MODEL_FILE.exists():
        return None
    with open(MODEL_FILE, "rb") as file:
        return pickle.load(file)

# ─── interactionScore / rating helpers ──────────────────────────────────────
# ✅ ตรงกับสูตรฝั่ง frontend (book_interaction_stats):
#    interactionScore = favoriteCount*5.0 + reviewActionCount*4.5 + viewCount*0.1
# ใช้เป็นเกณฑ์เรียงหลักทุกเคส (A/B/C/D + genre filter ที่ผู้ใช้เลือกเอง)
# ถ้า interactionScore เท่ากันเป๊ะ ถึงใช้ rating (เฉลี่ยดาว) เป็น tie-breaker
def build_interaction_scores(data):
    """
    คำนวณ interactionScore และ rating ของหนังสือทุกเล่ม จาก interaction ทั้งระบบ
    คืนค่าเป็น dict: bookID(str) → {"score": float, "rating": float}
    """
    fav_count = defaultdict(int)
    review_count = defaultdict(int)
    view_count = defaultdict(int)
    rating_sum = defaultdict(float)
    rating_n = defaultdict(int)

    for row in data["interaction"]:
        book_id = get_book_id(row)
        if not book_id:
            continue
        book_id = str(book_id)
        action = row.get("actionType")
        if action == "favorite":
            fav_count[book_id] += 1
        elif action == "review":
            review_count[book_id] += 1
            rating = row.get("rating")
            if rating is not None:
                rating_sum[book_id] += float(rating)
                rating_n[book_id] += 1
        elif action == "view":
            view_count[book_id] += 1

    book_ids = {str(b.get("bookID")) for b in data["books"] if b.get("bookID")}
    book_ids |= set(fav_count) | set(review_count) | set(view_count)

    scores = {}
    for book_id in book_ids:
        score = (
            fav_count.get(book_id, 0) * 5.0
            + review_count.get(book_id, 0) * 4.5
            + view_count.get(book_id, 0) * 0.1
        )
        n = rating_n.get(book_id, 0)
        rating = (rating_sum[book_id] / n) if n > 0 else 0.0
        scores[book_id] = {"score": score, "rating": rating}

    return scores

def fallback_from_interaction(user_id, n=12, genres=None):
    """
    ระบบแนะนำสำรอง (Fallback) ใช้เมื่อ LightFM ใช้งานไม่ได้
    เช่น ผู้ใช้ใหม่ที่ไม่อยู่ใน model หรือข้อมูลไม่พอ train

    วิธีคำนวณ (ตรงกับกฎฝั่ง frontend ทุกเคส — A/B/C/D + genre filter):
    1. คำนวณ interactionScore ของหนังสือแต่ละเล่ม (favoriteCount*5.0 +
       reviewActionCount*4.5 + viewCount*0.1) → หนังสือที่คนสนใจรวมกันมาก
       จะได้คะแนนสูง (ยอดนิยม)
    2. เรียงตาม interactionScore มากไปน้อยก่อนเสมอ ถ้า score เท่ากันเป๊ะ
       ถึงใช้ rating (เฉลี่ยดาว) เป็น tie-breaker
    3. กรองหนังสือที่ผู้ใช้เคยดูแล้วออก
    4. กรอง genre ถ้ามีการระบุ
    5. ถ้าได้ไม่ครบ n เล่ม → เติมด้วยหนังสือที่เหลือ เรียงด้วยกฎเดียวกัน
       (interactionScore ก่อน แล้วค่อย rating)
    """
    data = fetch_data()
    book_tags = build_book_tags(data)
    interacted = get_interacted_books(user_id, data)
    stats = build_interaction_scores(data)

    def sort_key(book_id):
        s = stats.get(book_id, {"score": 0.0, "rating": 0.0})
        return (-s["score"], -s["rating"])

    ranked = sorted(
        (book_id for book_id in stats.keys() if book_id not in interacted),
        key=sort_key,
    )
    ranked_filtered = filter_by_genres(ranked, genres, book_tags)

    if len(ranked_filtered) < n:
        remaining_book_ids = [
            str(b.get("bookID"))
            for b in data["books"]
            if b.get("bookID")
            and str(b.get("bookID")) not in interacted
            and str(b.get("bookID")) not in ranked_filtered
        ]
        remaining_sorted = sorted(remaining_book_ids, key=sort_key)
        for bid in remaining_sorted:
            if book_match_genres(bid, genres, book_tags):
                ranked_filtered.append(bid)
                if len(ranked_filtered) >= n:
                    break

    return ranked_filtered[:n]


def _do_predict(obj, uid, item_map, item_feature_tuples):
    """
    ให้ LightFM ทำนายคะแนนหนังสือทุกเล่มสำหรับผู้ใช้คนนี้
    คืนค่าเป็น array ของคะแนน (index ตรงกับ item_map)
    แยกเป็นฟังก์ชันเพื่อให้ retry ได้ง่ายเมื่อ features ไม่ตรง
    """
    dataset = obj["dataset"]
    model = obj["model"]
    item_features = dataset.build_item_features(item_feature_tuples)
    scores = model.predict(
        uid,
        np.arange(len(item_map)),
        item_features=item_features,
    )
    return scores


def get_user_preferred_genres(user_id):
    """
    ดึง genre ที่ผู้ใช้เลือกไว้ตอนสมัครหรือตั้งค่าโปรไฟล์
    ใช้เป็น default genre filter เมื่อผู้ใช้ไม่ได้เลือก genre เองบนหน้าหลัก
    """
    try:
        user_tags = supabase.table("user_tags").select("tagID").eq("user_id", user_id).execute().data or []
        if not user_tags:
            return []
        tag_ids = [ut["tagID"] for ut in user_tags]
        tags = supabase.table("tag").select("tagID, tagName, tagType").in_("tagID", tag_ids).execute().data or []
        return [t["tagName"] for t in tags if t.get("tagType") == "genre"]
    except Exception as e:
        print(f"[recommend] failed to get user tags: {e}")
        return []


def get_recommendations(user_id: str, n: int = 12, genres: list[str] | None = None):
    """
    ฟังก์ชันหลักสำหรับแนะนำหนังสือให้ผู้ใช้

    ลำดับการทำงาน:
    1. ดึง genre ที่ผู้ใช้ชอบ (จาก profile หรือ parameter)
    2. โหลด LightFM model → ถ้าไม่มี train ใหม่อัตโนมัติ
    3. ถ้าผู้ใช้ไม่อยู่ใน model (ผู้ใช้ใหม่) → ใช้ fallback
    4. ถ้า features ไม่ตรง (มีหนังสือ/tag ใหม่) → retrain แล้ว retry 1 ครั้ง
    5. เรียงหนังสือตามคะแนน LightFM จากสูงไปต่ำ
    6. กรองออก: หนังสือที่เคยดูแล้ว, ไม่ตรง genre
    7. คืน 12 เล่มแรก

    เงื่อนไขพิเศษ:
    - ถ้าผู้ใช้เลือก genre filter บนหน้าหลัก → แนะนำเฉพาะหนังสือที่มี interaction ในระบบ
      (เพื่อให้ผลแม่นยำกว่าสุ่มจากหนังสือใหม่ที่ยังไม่มีใครเคยดู)
    """
    data = fetch_data()
    book_tags = build_book_tags(data)
    interacted = get_interacted_books(user_id, data)
    stats = build_interaction_scores(data)

    # ถ้าไม่มี genre ที่ระบุมาเลย → ใช้ genre ที่ผู้ใช้ชอบจาก profile แทน
    effective_genres = genres
    if not effective_genres:
        effective_genres = get_user_preferred_genres(user_id)

    # bookID ที่มี interaction อย่างน้อย 1 ครั้งในระบบ
    interacted_book_ids = {
        str(get_book_id(row))
        for row in data["interaction"]
        if get_book_id(row)
    }

    obj = load_model()

    if obj is None:
        # ไม่มี model เลย — ลอง train ครั้งแรก
        print("[recommend] no model found — training now...")
        train_and_save_model(epochs=10)
        obj = load_model()
        if obj is None:
            return fallback_from_interaction(user_id, n, effective_genres)

    model    = obj["model"]
    dataset  = obj["dataset"]
    item_feature_tuples = obj["item_feature_tuples"]

    user_map, item_map, *_ = dataset.mapping()
    uid = user_map.get(str(user_id))

    # ผู้ใช้ใหม่ที่ยังไม่มีใน model → ใช้ fallback (ยอดนิยม)
    if uid is None:
        return fallback_from_interaction(user_id, n, effective_genres)

    try:
        scores = _do_predict(obj, uid, item_map, item_feature_tuples)

    except ValueError as e:
        # features ไม่ตรง เช่น มีหนังสือหรือ tag ใหม่เพิ่มเข้ามา → retrain แล้ว retry
        print(f"[recommend] feature mismatch ({e}) — retraining model...")
        result = train_and_save_model(epochs=10)

        if result is None:
            # ข้อมูลไม่พอ train → fallback
            return fallback_from_interaction(user_id, n, effective_genres)

        # โหลด model ใหม่แล้ว retry
        obj = load_model()
        if obj is None:
            return fallback_from_interaction(user_id, n, effective_genres)

        dataset  = obj["dataset"]
        item_feature_tuples = obj["item_feature_tuples"]
        user_map, item_map, *_ = dataset.mapping()
        uid = user_map.get(str(user_id))

        if uid is None:
            return fallback_from_interaction(user_id, n, effective_genres)

        try:
            scores = _do_predict(obj, uid, item_map, item_feature_tuples)
        except Exception as e2:
            print(f"[recommend] retry failed ({e2}) — fallback")
            return fallback_from_interaction(user_id, n, effective_genres)

    reverse_item_map = {v: k for k, v in item_map.items()}

    # ✅ จัดอันดับ (item_index, lightfm_score) แล้วเรียงด้วย:
    #    1) lightfm_score มากไปน้อย (เกณฑ์หลักจาก personalization model)
    #    2) ถ้า lightfm_score เท่ากันเป๊ะ → interactionScore มากไปน้อย
    #    3) ถ้ายังเท่ากันอีก → rating มากไปน้อย (tie-breaker สุดท้าย)
    candidates = []
    for item_index, lightfm_score in enumerate(scores):
        book_id = reverse_item_map.get(int(item_index))
        if not book_id:
            continue
        book_id = str(book_id)
        if book_id in interacted:
            continue
        if effective_genres and not book_match_genres(book_id, effective_genres, book_tags):
            continue
        if genres and (book_id not in interacted_book_ids):
            continue
        s = stats.get(book_id, {"score": 0.0, "rating": 0.0})
        candidates.append((book_id, float(lightfm_score), s["score"], s["rating"]))

    candidates.sort(key=lambda c: (-c[1], -c[2], -c[3]))

    result = [book_id for book_id, *_ in candidates[:n]]

    return result if result else fallback_from_interaction(user_id, n, effective_genres)