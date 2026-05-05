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
    return supabase.table(name).select("*").execute().data or []


@lru_cache(maxsize=1)
def fetch_data():
    return {
        "books": fetch_table("books"),
        "interaction": fetch_table("interaction"),
        "tag": fetch_table("tag"),
        "bookTag": fetch_table("bookTag"),
    }


def clear_cache():
    fetch_data.cache_clear()


def get_book_id(row):
    return row.get("bookID") or row.get("book_id") or row.get("bookId")


def action_weight(action):
    weights = {
        "favorite": 5.0,
        "review": 4.5,
        "rating": 4.0,
        "search": 2.0,
        "detail": 1.2,
        "click": 1.0,
        "view": 0.8,
    }

    return weights.get(str(action or "").lower(), 0.0)


def clean_ids(ids):
    result = []

    for value in ids:
        if value is None:
            continue

        value = str(value)

        if value not in result:
            result.append(value)

    return result


def build_book_tags(data):
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
    if not genres:
        return True
    need = {str(g).strip().lower() for g in genres}
    tags = {str(t).strip().lower() for t in book_tags.get(str(book_id), set())}

    return need.issubset(tags)


def filter_by_genres(ids, genres, book_tags):
    return [
        book_id
        for book_id in clean_ids(ids)
        if book_match_genres(book_id, genres, book_tags)
    ]


def get_interacted_books(user_id, data):
    interacted = set()

    for row in data["interaction"]:
        if str(row.get("user_id")) == str(user_id):
            book_id = get_book_id(row)

            if book_id:
                interacted.add(str(book_id))

    return interacted


def build_item_features(data):
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
        weight = action_weight(row.get("actionType"))

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
        loss="warp",
        no_components=8,
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

    return True


def load_model():
    if not MODEL_FILE.exists():
        return None

    with open(MODEL_FILE, "rb") as file:
        return pickle.load(file)


def fallback_from_interaction(user_id, n=12, genres=None):
    data = fetch_data()
    book_tags = build_book_tags(data)
    interacted = get_interacted_books(user_id, data)

    scores = defaultdict(float)

    for row in data["interaction"]:
        book_id = get_book_id(row)
        weight = action_weight(row.get("actionType"))

        if book_id and weight > 0:
            scores[str(book_id)] += weight

    ranked = [
        book_id
        for book_id, _ in sorted(scores.items(), key=lambda x: -x[1])
        if book_id not in interacted
    ]

    ranked = filter_by_genres(ranked, genres, book_tags)

    return ranked[:n]


def get_recommendations(user_id: str, n: int = 12, genres: list[str] | None = None):
    data = fetch_data()
    book_tags = build_book_tags(data)
    interacted = get_interacted_books(user_id, data)

    obj = load_model()

    if obj is None:
        return fallback_from_interaction(user_id, n, genres)

    model = obj["model"]
    dataset = obj["dataset"]
    item_feature_tuples = obj["item_feature_tuples"]

    user_map, item_map, *_ = dataset.mapping()
    uid = user_map.get(str(user_id))

    if uid is None:
        return fallback_from_interaction(user_id, n, genres)

    item_features = dataset.build_item_features(item_feature_tuples)

    scores = model.predict(
        uid,
        np.arange(len(item_map)),
        item_features=item_features,
    )

    reverse_item_map = {v: k for k, v in item_map.items()}

    result = []

    for item_index in np.argsort(-scores):
        book_id = reverse_item_map.get(int(item_index))

        if not book_id:
            continue

        book_id = str(book_id)

        if book_id in interacted:
            continue

        if genres and not book_match_genres(book_id, genres, book_tags):
            continue

        result.append(book_id)

        if len(result) >= n:
            break

    return result if result else fallback_from_interaction(user_id, n, genres)
