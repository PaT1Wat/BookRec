import os
import pickle
from pathlib import Path
import numpy as np
from lightfm import LightFM
from lightfm.data import Dataset
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_DIR = Path(__file__).parent
MODEL_DIR = BASE_DIR / "models"
MODEL_FILE = MODEL_DIR / "lightfm.pkl"


def _fetch_raw_data():
    # Fetch minimal required tables from Supabase
    favs = supabase.table("favorite").select("*").execute().data or []
    books = supabase.table("books").select("*").execute().data or []
    tags = supabase.table("tag").select("*").execute().data or []
    book_tags = supabase.table("bookTag").select("*").execute().data or []
    reviews = supabase.table("review").select("*").execute().data or []
    book_types = supabase.table("book_type").select("*").execute().data or []

    return {
        "favs": favs,
        "books": books,
        "tags": tags,
        "book_tags": book_tags,
        "reviews": reviews,
        "book_types": book_types,
    }


def _build_item_features(books, book_tags, tags, book_types):
    # map tagID -> tagName
    tag_map = {t.get("tagID"): (t.get("tagName") or str(t.get("tagID"))) for t in tags}
    type_map = {t.get("id"): (t.get("slug") or str(t.get("id"))) for t in book_types}

    book_feat_map = {}
    for b in books:
        bid = b.get("bookID")
        feats = []
        # add tags
        for bt in book_tags:
            if bt.get("bookID") == bid:
                tagname = tag_map.get(bt.get("tagID"))
                if tagname:
                    feats.append(f"tag:{tagname}")
        # add type
        t_id = b.get("type_id") or b.get("typeId") or b.get("type")
        if t_id:
            slug = type_map.get(t_id)
            if slug:
                feats.append(f"type:{slug}")
        # publisher/author could be added similarly if needed
        book_feat_map[bid] = list(set(feats))

    return book_feat_map


def train_and_save_model(epochs: int = 20):
    data = _fetch_raw_data()
    favs = data["favs"]
    books = data["books"]
    tags = data["tags"]
    book_tags = data["book_tags"]
    reviews = data.get("reviews", [])
    book_types = data["book_types"]

    if not books:
        return None

    users = sorted({str(f.get("user_id")) for f in favs})
    items = sorted({str(b.get("bookID")) for b in books})

    # build item features
    book_feat_map = _build_item_features(books, book_tags, tags, book_types)
    # all feature names
    all_features = set()
    for feats in book_feat_map.values():
        all_features.update(feats)

    dataset = Dataset()
    dataset.fit(users=users, items=items, item_features=list(all_features))

    # build interactions with weights (favorites + reviews)
    interactions_list = []
    for f in favs:
        uid = str(f.get("user_id"))
        bid = str(f.get("bookID") or f.get("book_id") or f.get("bookId"))
        weight = f.get("weight") if f.get("weight") is not None else 4.0
        interactions_list.append((uid, bid, float(weight)))

    # include reviews: weight by rating (+ extra if comment text exists)
    for r in reviews:
        uid = str(r.get("user_id"))
        bid = str(r.get("bookID") or r.get("book_id") or r.get("bookId"))
        rating = r.get("rating") or 0
        has_comment = bool((r.get("comment") or "").strip())
        # base weight: rating (0-5) mapped + bonus for written comment
        weight = 1.0 + float(rating)
        if has_comment:
            weight += 1.0
        interactions_list.append((uid, bid, float(weight)))

    interactions, _ = dataset.build_interactions(interactions_list)

    # build item features tuples
    item_feature_tuples = []
    for bid, feats in book_feat_map.items():
        item_feature_tuples.append((str(bid), feats))

    item_features_matrix = dataset.build_item_features(item_feature_tuples)

    model = LightFM(loss="warp", no_components=32)
    model.fit(interactions, item_features=item_features_matrix, epochs=epochs, num_threads=4)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with open(MODEL_FILE, "wb") as f:
        pickle.dump({"model": model, "dataset": dataset, "item_feature_tuples": item_feature_tuples}, f)

    return {"model": model, "dataset": dataset, "item_feature_tuples": item_feature_tuples}


def load_model():
    if not MODEL_FILE.exists():
        return None
    with open(MODEL_FILE, "rb") as f:
        obj = pickle.load(f)
    return obj


def get_recommendations(user_id: str, n: int = 10):
    # load or train model
    obj = load_model()
    if obj is None:
        obj = train_and_save_model(epochs=20)
        if obj is None:
            return []

    model = obj["model"]
    dataset = obj["dataset"]
    item_feature_tuples = obj["item_feature_tuples"]

    user_map, item_map, _ = dataset.mapping()
    uid = user_map.get(str(user_id))
    if uid is None:
        # fallback: return top popular books by favorites
        favs = _fetch_raw_data()["favs"]
        counts = {}
        for f in favs:
            bid = str(f.get("bookID") or f.get("book_id") or f.get("bookId"))
            counts[bid] = counts.get(bid, 0) + 1
        top = sorted(counts.items(), key=lambda x: -x[1])[:n]
        return [bid for bid, _ in top]

    n_items = len(item_map)
    # build item_features matrix from saved tuples
    item_features_matrix = dataset.build_item_features(item_feature_tuples)

    scores = model.predict(uid, np.arange(n_items), item_features=item_features_matrix)
    top_internal = np.argsort(-scores)[:n]

    # invert item_map (raw -> internal) to internal -> raw
    inv_item_map = {v: k for k, v in item_map.items()}
    recommendations = [inv_item_map.get(int(i)) for i in top_internal]
    return [r for r in recommendations if r is not None]