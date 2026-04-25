import os
import pickle
import traceback
from pathlib import Path
from collections import defaultdict

from dotenv import load_dotenv
load_dotenv()

import numpy as np
from lightfm import LightFM
from lightfm.data import Dataset
from lightfm.evaluation import precision_at_k
from supabase import create_client

# =============================================================
# SUPABASE CONFIG
# =============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

DEBUG_SKIP_LIGHTFM = os.getenv("DEBUG_SKIP_LIGHTFM", "false").lower() == "true"

BASE_DIR = Path(__file__).parent
MODEL_DIR = BASE_DIR / "models"
MODEL_FILE = MODEL_DIR / "lightfm.pkl"


# =============================================================
# DATA FETCHING
# =============================================================

def _fetch_raw_data():
    print("[recommend] fetching raw data...")

    favs = supabase.table("favorite").select("*").execute().data or []
    print("[recommend] favs:", len(favs))

    books = supabase.table("books").select("*").execute().data or []
    print("[recommend] books:", len(books))

    tags = supabase.table("tag").select("*").execute().data or []
    print("[recommend] tags:", len(tags))

    book_tags = supabase.table("bookTag").select("*").execute().data or []
    print("[recommend] book_tags:", len(book_tags))

    reviews = supabase.table("review").select("*").execute().data or []
    print("[recommend] reviews:", len(reviews))

    book_types = supabase.table("book_type").select("*").execute().data or []
    print("[recommend] book_types:", len(book_types))

    interactions = supabase.table("interaction").select("*").execute().data or []
    print("[recommend] interactions:", len(interactions))

    if books:
        print("[recommend] sample book row:", books[0])

    return {
        "favs": favs,
        "books": books,
        "tags": tags,
        "book_tags": book_tags,
        "reviews": reviews,
        "book_types": book_types,
        "interactions": interactions,
    }


# =============================================================
# FEATURE BUILDING
# =============================================================

def _build_item_features(books, book_tags, tags, book_types):
    tag_map = {
        t.get("tagID"): (t.get("tagName") or str(t.get("tagID")))
        for t in tags
    }
    type_map = {
        t.get("id"): (t.get("slug") or t.get("name") or str(t.get("id")))
        for t in book_types
    }

    book_feat_map = {}

    for b in books:
        bid = b.get("bookID")
        feats = []

        for bt in book_tags:
            if bt.get("bookID") == bid:
                tagname = tag_map.get(bt.get("tagID"))
                if tagname:
                    feats.append(f"tag:{tagname}")

        t_id = b.get("type_id") or b.get("typeId") or b.get("type")
        if t_id:
            slug = type_map.get(t_id)
            if slug:
                feats.append(f"type:{slug}")

        book_feat_map[bid] = sorted(list(set(feats)))

    return book_feat_map


# =============================================================
# HELPERS
# =============================================================

def _normalize_text(value):
    return str(value or "").strip().lower()


def _build_book_maps(books, tags, book_types, book_tags):
    book_by_id = {str(b.get("bookID")): b for b in books if b.get("bookID") is not None}

    tag_name_by_id = {
        t.get("tagID"): t.get("tagName")
        for t in tags
    }

    type_slug_by_id = {
        t.get("id"): t.get("slug")
        for t in book_types
    }

    type_name_by_id = {
        t.get("id"): t.get("name")
        for t in book_types
    }

    book_tag_names = defaultdict(set)
    for bt in book_tags:
        bid = bt.get("bookID")
        tid = bt.get("tagID")
        if bid is not None and tid in tag_name_by_id:
            tag_name = tag_name_by_id[tid]
            if tag_name:
                book_tag_names[str(bid)].add(tag_name)

    return book_by_id, tag_name_by_id, type_slug_by_id, type_name_by_id, book_tag_names


def _get_interacted_book_ids_for_user(user_id: str, favs, reviews, interactions):
    interacted = set()

    for f in favs:
        if str(f.get("user_id")) == str(user_id):
            bid = f.get("bookID") or f.get("book_id") or f.get("bookId")
            if bid is not None:
                interacted.add(str(bid))

    for r in reviews:
        if str(r.get("user_id")) == str(user_id):
            bid = r.get("bookID") or r.get("book_id") or r.get("bookId")
            if bid is not None:
                interacted.add(str(bid))

    for it in interactions:
        if str(it.get("user_id")) == str(user_id):
            bid = it.get("bookID") or it.get("book_id") or it.get("bookId")
            if bid is not None:
                interacted.add(str(bid))

    return interacted


def _interaction_weight(action_type: str) -> float:
    action = str(action_type or "").lower()

    if action == "view":
        return 0.4
    if action == "favorite":
        return 4.0
    if action == "review":
        return 3.5

    if action in {"unfavorite", "review_delete"}:
        return 0.0

    return 0.0


def _clean_book_ids(values):
    cleaned = []
    for v in values:
        if v is None:
            continue
        s = str(v).strip()
        if s.isdigit():
            cleaned.append(s)
    return cleaned


def _get_user_preferred_tag_ids(user_id: str):
    try:
        rows = (
            supabase
            .table("user_tags")
            .select("tagID")
            .eq("user_id", user_id)
            .execute()
            .data
            or []
        )

        return {
            int(r["tagID"])
            for r in rows
            if r.get("tagID") is not None
        }
    except Exception as e:
        print("[recommend] fetch user_tags failed:", e)
        return set()


def _build_item_activity(favs, reviews, interactions):
    activity = defaultdict(float)

    for f in favs:
        bid = f.get("bookID") or f.get("book_id") or f.get("bookId")
        if bid is not None:
            activity[str(bid)] += 3.0

    for r in reviews:
        bid = r.get("bookID") or r.get("book_id") or r.get("bookId")
        if bid is not None:
            activity[str(bid)] += 2.0

    for it in interactions:
        bid = it.get("bookID") or it.get("book_id") or it.get("bookId")
        if bid is not None:
            activity[str(bid)] += _interaction_weight(it.get("actionType"))

    return activity


def _book_matches_genre(bid, genre, book_by_id, book_tag_names, type_slug_by_id, type_name_by_id):
    if not genre:
        return True

    norm_genre = _normalize_text(genre)
    if not norm_genre:
        return True

    bid = str(bid)
    tags = {_normalize_text(t) for t in book_tag_names.get(bid, set())}
    if norm_genre in tags:
        return True

    book = book_by_id.get(bid)
    if not book:
        return False

    t_id = book.get("type_id")
    type_slug = _normalize_text(type_slug_by_id.get(t_id))
    type_name = _normalize_text(type_name_by_id.get(t_id))

    return norm_genre in {type_slug, type_name}


def _filter_candidate_ids_by_genre(candidate_ids, genre, books, tags, book_types, book_tags):
    if not genre:
        return _clean_book_ids(candidate_ids)

    book_by_id, _, type_slug_by_id, type_name_by_id, book_tag_names = _build_book_maps(
        books, tags, book_types, book_tags
    )

    filtered = []
    for bid in candidate_ids:
        if _book_matches_genre(bid, genre, book_by_id, book_tag_names, type_slug_by_id, type_name_by_id):
            filtered.append(str(bid))

    return _clean_book_ids(filtered)


def _popularity_fallback(n: int, favs, reviews, interactions, exclude=None):
    exclude = exclude or set()
    scores = defaultdict(float)

    for f in favs:
        bid = f.get("bookID") or f.get("book_id") or f.get("bookId")
        if bid is not None:
            scores[str(bid)] += 3.0

    for r in reviews:
        bid = r.get("bookID") or r.get("book_id") or r.get("bookId")
        rating = float(r.get("rating") or 0)
        comment_bonus = 1.0 if (r.get("comment") or "").strip() else 0.0
        if bid is not None:
            scores[str(bid)] += 1.0 + rating + comment_bonus

    for it in interactions:
        bid = it.get("bookID") or it.get("book_id") or it.get("bookId")
        if bid is None:
            continue
        w = _interaction_weight(it.get("actionType"))
        if w > 0:
            scores[str(bid)] += w

    ranked = [
        bid for bid, _ in sorted(scores.items(), key=lambda x: (-x[1], x[0]))
        if bid not in exclude
    ]
    return _clean_book_ids(ranked[:n])


def _content_profile_fallback(
    user_id: str,
    n: int,
    books,
    favs,
    reviews,
    interactions,
    book_tags,
    tags,
    book_types,
    genre: str | None = None,
):
    interacted = _get_interacted_book_ids_for_user(user_id, favs, reviews, interactions)
    preferred_tag_ids = _get_user_preferred_tag_ids(user_id)
    if not books:
        return []

    book_by_id, _, type_slug_by_id, type_name_by_id, book_tag_names = _build_book_maps(
        books, tags, book_types, book_tags
    )
    item_activity = _build_item_activity(favs, reviews, interactions)

    preferred_tags = defaultdict(float)
    preferred_types = defaultdict(float)

    for f in favs:
        if str(f.get("user_id")) == str(user_id):
            bid = str(f.get("bookID") or f.get("book_id") or f.get("bookId") or "")
            if bid:
                for tag in book_tag_names.get(bid, set()):
                    preferred_tags[tag] += 3.0

                book_row = book_by_id.get(bid)
                if book_row:
                    t_slug = type_slug_by_id.get(book_row.get("type_id"))
                    if t_slug:
                        preferred_types[t_slug] += 2.0

    for r in reviews:
        if str(r.get("user_id")) == str(user_id):
            bid = str(r.get("bookID") or r.get("book_id") or r.get("bookId") or "")
            rating = float(r.get("rating") or 0)
            if bid:
                for tag in book_tag_names.get(bid, set()):
                    preferred_tags[tag] += max(1.0, rating)

                book_row = book_by_id.get(bid)
                if book_row:
                    t_slug = type_slug_by_id.get(book_row.get("type_id"))
                    if t_slug:
                        preferred_types[t_slug] += max(1.0, rating / 2.0)

    for it in interactions:
        if str(it.get("user_id")) == str(user_id):
            bid = str(it.get("bookID") or it.get("book_id") or it.get("bookId") or "")
            w = _interaction_weight(it.get("actionType"))
            if not bid or w <= 0:
                continue

            for tag in book_tag_names.get(bid, set()):
                preferred_tags[tag] += w

            book_row = book_by_id.get(bid)
            if book_row:
                t_slug = type_slug_by_id.get(book_row.get("type_id"))
                if t_slug:
                    preferred_types[t_slug] += max(0.5, w / 2.0)

    scored_books = []

    for b in books:
        bid = str(b.get("bookID"))
        if bid in interacted:
            continue

        if genre and not _book_matches_genre(
            bid, genre, book_by_id, book_tag_names, type_slug_by_id, type_name_by_id
        ):
            continue

        score = 0.0
        
        book_tag_ids = {
            int(bt.get("tagID"))
            for bt in book_tags
            if str(bt.get("bookID")) == bid and bt.get("tagID") is not None
        }
        
        matched_user_tags = preferred_tag_ids.intersection(book_tag_ids)

        if matched_user_tags:
            score += 10.0 * len(matched_user_tags)

        for tag in book_tag_names.get(bid, set()):
            score += preferred_tags.get(tag, 0.0) * 2.5

        t_slug = type_slug_by_id.get(b.get("type_id"))
        if t_slug:
            score += preferred_types.get(t_slug, 0.0) * 2.0

        if bool(b.get("is_new")):
            score += 2.0

        if bool(b.get("is_popular")):
            score += 0.8

        activity = item_activity.get(bid, 0.0)
        if activity == 0:
            score += 2.5
        elif activity < 2:
            score += 1.0

        if genre:
            score += 2.0

        if score > 0:
            scored_books.append((bid, score))

    scored_books.sort(key=lambda x: (-x[1], x[0]))
    return _clean_book_ids([bid for bid, _ in scored_books[:n]])


def _explore_fallback(n: int, books, favs, reviews, interactions, exclude=None, genre: str | None = None, tags=None, book_types=None, book_tags=None):
    exclude = exclude or set()
    activity = _build_item_activity(favs, reviews, interactions)

    book_by_id, _, type_slug_by_id, type_name_by_id, book_tag_names = _build_book_maps(
        books, tags or [], book_types or [], book_tags or []
    )

    scored = []
    for b in books:
        bid = str(b.get("bookID"))
        if bid in exclude:
            continue

        if genre and not _book_matches_genre(
            bid, genre, book_by_id, book_tag_names, type_slug_by_id, type_name_by_id
        ):
            continue

        score = 0.0

        if bool(b.get("is_new")):
            score += 3.0

        score += max(0.0, 3.0 - min(activity.get(bid, 0.0), 3.0))

        if bool(b.get("is_popular")):
            score += 0.5

        if genre:
            score += 1.5

        scored.append((bid, score))

    scored.sort(key=lambda x: (-x[1], x[0]))
    return _clean_book_ids([bid for bid, _ in scored[:n]])


def _merge_hybrid_lists(primary, content, explore, n):
    final = []

    def add_items(items, limit=None):
        count = 0
        for item in items:
            if item not in final:
                final.append(item)
                count += 1
            if len(final) >= n:
                return
            if limit is not None and count >= limit:
                return

    primary_quota = max(1, int(round(n * 0.5)))
    content_quota = max(1, int(round(n * 0.3)))
    explore_quota = max(1, n - primary_quota - content_quota)

    add_items(primary, primary_quota)
    add_items(content, content_quota)
    add_items(explore, explore_quota)

    if len(final) < n:
        add_items(primary)
    if len(final) < n:
        add_items(content)
    if len(final) < n:
        add_items(explore)

    return final[:n]


# =============================================================
# TRAIN & SAVE MODEL
# =============================================================

def train_and_save_model(epochs: int = 10):
    print("[recommend] train_and_save_model start...")

    if DEBUG_SKIP_LIGHTFM:
        print("[recommend] DEBUG_SKIP_LIGHTFM=true -> skip training")
        return {"model": None, "dataset": None, "item_feature_tuples": []}

    data = _fetch_raw_data()
    favs = data["favs"]
    books = data["books"]
    tags = data["tags"]
    book_tags = data["book_tags"]
    reviews = data["reviews"]
    book_types = data["book_types"]
    interactions = data["interactions"]

    if not books:
        print("[recommend] No books found — skipping training.")
        return None

    interaction_users = set()

    for f in favs:
        uid = str(f.get("user_id") or "")
        if uid:
            interaction_users.add(uid)

    for r in reviews:
        uid = str(r.get("user_id") or "")
        if uid:
            interaction_users.add(uid)

    for it in interactions:
        uid = str(it.get("user_id") or "")
        if uid:
            interaction_users.add(uid)

    users = sorted(interaction_users)
    items = sorted({str(b.get("bookID")) for b in books if b.get("bookID") is not None})

    print("[recommend] train users:", len(users))
    print("[recommend] train items:", len(items))

    if not users:
        print("[recommend] No users with interactions — skipping training.")
        return None

    book_feat_map = _build_item_features(books, book_tags, tags, book_types)
    all_features = set()
    for feats in book_feat_map.values():
        all_features.update(feats)

    print("[recommend] item features:", len(all_features))

    dataset = Dataset()
    dataset.fit(users=users, items=items, item_features=list(all_features))

    interactions_list = []

    for f in favs:
        uid = str(f.get("user_id") or "")
        bid = str(f.get("bookID") or f.get("book_id") or f.get("bookId") or "")
        weight = float(f.get("weight") if f.get("weight") is not None else 4.0)
        if uid and bid.isdigit():
            interactions_list.append((uid, bid, weight))

    for r in reviews:
        uid = str(r.get("user_id") or "")
        bid = str(r.get("bookID") or r.get("book_id") or r.get("bookId") or "")
        rating = float(r.get("rating") or 0)
        has_comment = bool((r.get("comment") or "").strip())
        weight = 0.5 + rating + (1.0 if has_comment else 0.0)
        if uid and bid.isdigit():
            interactions_list.append((uid, bid, weight))

    for it in interactions:
        uid = str(it.get("user_id") or "")
        bid = str(it.get("bookID") or it.get("book_id") or it.get("bookId") or "")
        weight = _interaction_weight(it.get("actionType"))
        if uid and bid.isdigit() and weight > 0:
            interactions_list.append((uid, bid, weight))

    print("[recommend] interactions_list:", len(interactions_list))

    if not interactions_list:
        print("[recommend] No interactions to train on.")
        return None

    interactions_matrix, weights_matrix = dataset.build_interactions(interactions_list)
    item_feature_tuples = [(str(bid), feats) for bid, feats in book_feat_map.items()]
    item_features_matrix = dataset.build_item_features(item_feature_tuples)

    model = LightFM(
        loss="warp",
        no_components=8,
        learning_rate=0.05,
        item_alpha=1e-6,
        user_alpha=1e-6,
        max_sampled=20,
        random_state=42,
    )

    print("[recommend] fitting model start...")
    try:
        model.fit(
            interactions_matrix,
            sample_weight=weights_matrix,
            item_features=item_features_matrix,
            epochs=epochs,
            num_threads=1,
            verbose=False,
        )
        print("[recommend] fit complete")
    except Exception as e:
        print("[recommend] model.fit failed:", e)
        traceback.print_exc()
        raise

    try:
        train_precision = precision_at_k(
            model,
            interactions_matrix,
            item_features=item_features_matrix,
            k=5,
        ).mean()
        print("[recommend] train precision@5:", float(train_precision))
    except Exception as e:
        print("[recommend] precision_at_k failed:", e)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with open(MODEL_FILE, "wb") as f:
        pickle.dump(
            {
                "model": model,
                "dataset": dataset,
                "item_feature_tuples": item_feature_tuples,
            },
            f,
        )

    print(
        f"[recommend] Model trained with {len(users)} users / {len(items)} items / {len(interactions_list)} interactions."
    )
    return {
        "model": model,
        "dataset": dataset,
        "item_feature_tuples": item_feature_tuples,
    }


# =============================================================
# LOAD MODEL
# =============================================================

def load_model():
    if DEBUG_SKIP_LIGHTFM:
        print("[recommend] DEBUG_SKIP_LIGHTFM=true -> load_model returns None")
        return None

    if not MODEL_FILE.exists():
        print("[recommend] model file not found")
        return None

    with open(MODEL_FILE, "rb") as f:
        obj = pickle.load(f)

    print("[recommend] model loaded from disk")
    return obj


# =============================================================
# SAVE RECOMMENDATIONS → SUPABASE
# =============================================================

def save_recommendations_to_supabase(user_id: str | None, book_ids: list[str], rec_type: str = "hybrid"):
    try:
        print(f"[recommend] saving recommendations for user={user_id}, count={len(book_ids)}, rec_type={rec_type}")

        q = supabase.table("recommendations").delete().eq("rec_type", rec_type)

        if user_id is None:
            q = q.is_("user_id", None)
        else:
            q = q.eq("user_id", user_id)

        delete_response = q.execute()
        print("[recommend] delete old recs response:", delete_response)

        clean_ids = _clean_book_ids(book_ids)

        if not clean_ids:
            print("[recommend] no valid book_ids to save")
            return

        rows = [
            {
                "user_id": user_id,
                "bookID": int(bid),
                "score": float(len(clean_ids) - i),
                "rec_type": rec_type,
            }
            for i, bid in enumerate(clean_ids)
        ]

        print("[recommend] about to insert recommendation rows:", len(rows))
        print("[recommend] sample rows:", rows[:3])

        insert_response = supabase.table("recommendations").insert(rows).execute()
        print("[recommend] insert response:", insert_response)
        print(f"[recommend] Saved {len(rows)} recs for user {user_id}")

    except Exception as e:
        print(f"[recommend] Failed to save recs for user {user_id}: {e}")
        traceback.print_exc()


# =============================================================
# GET RECOMMENDATIONS (HYBRID + OPTIONAL GENRE)
# =============================================================

def get_recommendations(user_id: str, n: int = 12, genre: str | None = None) -> list[str]:
    print(f"[recommend] get_recommendations start for user={user_id}, genre={genre}")

    raw = _fetch_raw_data()
    favs = raw["favs"]
    reviews = raw["reviews"]
    books = raw["books"]
    tags = raw["tags"]
    book_tags = raw["book_tags"]
    book_types = raw["book_types"]
    interactions = raw["interactions"]

    interacted = _get_interacted_book_ids_for_user(user_id, favs, reviews, interactions)

    primary_ids = []

    if DEBUG_SKIP_LIGHTFM:
        print("[recommend] DEBUG_SKIP_LIGHTFM=true -> using popularity as primary")
        primary_ids = _popularity_fallback(
            n=max(n * 2, 24),
            favs=favs,
            reviews=reviews,
            interactions=interactions,
            exclude=interacted,
        )
    else:
        obj = load_model()
        if obj is None:
            print("[recommend] No model found — training now...")
            obj = train_and_save_model(epochs=10)

        if obj is not None and obj.get("model") is not None:
            model = obj["model"]
            dataset = obj["dataset"]
            item_feature_tuples = obj["item_feature_tuples"]

            mapping_result = dataset.mapping()
            user_map = mapping_result[0]
            item_map = mapping_result[1]
            uid = user_map.get(str(user_id))

            print("[recommend] user in model:", uid is not None)
            print("[recommend] interacted count:", len(interacted))

            if uid is not None:
                n_items = len(item_map)
                item_features_matrix = dataset.build_item_features(item_feature_tuples)
                scores = model.predict(uid, np.arange(n_items), item_features=item_features_matrix)

                inv_item_map = {v: k for k, v in item_map.items()}
                ranked_internal = np.argsort(-scores)

                for internal_id in ranked_internal:
                    bid = inv_item_map.get(int(internal_id))
                    if bid is None:
                        continue
                    if str(bid) in interacted:
                        continue
                    primary_ids.append(str(bid))
                    if len(primary_ids) >= max(n * 3, 36):
                        break

                primary_ids = _clean_book_ids(primary_ids)
                print("[recommend] model primary recommendations:", primary_ids)

        if not primary_ids:
            primary_ids = _popularity_fallback(
                n=max(n * 2, 24),
                favs=favs,
                reviews=reviews,
                interactions=interactions,
                exclude=interacted,
            )
            print("[recommend] popularity primary fallback:", primary_ids)

    primary_ids = _filter_candidate_ids_by_genre(
        primary_ids, genre, books, tags, book_types, book_tags
    )
    print("[recommend] primary after genre filter:", primary_ids)

    content_ids = _content_profile_fallback(
        user_id=user_id,
        n=max(n * 2, 24),
        books=books,
        favs=favs,
        reviews=reviews,
        interactions=interactions,
        book_tags=book_tags,
        tags=tags,
        book_types=book_types,
        genre=genre,
    )
    print("[recommend] content recommendations:", content_ids)

    exclude_for_explore = set(interacted) | set(primary_ids) | set(content_ids)
    explore_ids = _explore_fallback(
        n=max(n * 2, 24),
        books=books,
        favs=favs,
        reviews=reviews,
        interactions=interactions,
        exclude=exclude_for_explore,
        genre=genre,
        tags=tags,
        book_types=book_types,
        book_tags=book_tags,
    )
    print("[recommend] explore recommendations:", explore_ids)

    final_ids = _merge_hybrid_lists(primary_ids, content_ids, explore_ids, n)
    print("[recommend] final hybrid recommendations:", final_ids)

    if not genre:
        save_recommendations_to_supabase(user_id, final_ids, rec_type="hybrid")

    return final_ids


# =============================================================
# COMPUTE ALL USERS + GENERAL HYBRID
# =============================================================

def compute_all_recommendations(n: int = 12):
    print("[recommend] Starting full recommendation compute...")

    try:
        raw = _fetch_raw_data()
        print(
            "[recommend] raw counts:",
            {
                "favs": len(raw["favs"]),
                "reviews": len(raw["reviews"]),
                "interactions": len(raw["interactions"]),
                "books": len(raw["books"]),
                "tags": len(raw["tags"]),
                "book_tags": len(raw["book_tags"]),
                "book_types": len(raw["book_types"]),
            },
        )

        favs = raw["favs"]
        reviews = raw["reviews"]
        interactions = raw["interactions"]
        books = raw["books"]
        tags = raw["tags"]
        book_tags = raw["book_tags"]
        book_types = raw["book_types"]

        if not DEBUG_SKIP_LIGHTFM:
            print("[recommend] training model...")
            obj = train_and_save_model(epochs=10)
            print("[recommend] train_and_save_model returned:", obj is not None)

        user_ids = set()
        for f in favs:
            if f.get("user_id"):
                user_ids.add(str(f.get("user_id")))
        for r in reviews:
            if r.get("user_id"):
                user_ids.add(str(r.get("user_id")))
        for it in interactions:
            if it.get("user_id"):
                user_ids.add(str(it.get("user_id")))

        print(f"[recommend] Computing hybrid recs for {len(user_ids)} users...")

        for uid in sorted(user_ids):
            print(f"[recommend] computing for user: {uid}")
            recs = get_recommendations(uid, n=n, genre=None)
            print(f"[recommend] recs for {uid}: {recs}")

        general_primary = _popularity_fallback(
            n=max(n * 2, 24),
            favs=favs,
            reviews=reviews,
            interactions=interactions,
        )

        general_content = _content_profile_fallback(
            user_id="__general__",
            n=max(n * 2, 24),
            books=books,
            favs=[],
            reviews=[],
            interactions=[],
            book_tags=book_tags,
            tags=tags,
            book_types=book_types,
            genre=None,
        )

        general_explore = _explore_fallback(
            n=max(n * 2, 24),
            books=books,
            favs=favs,
            reviews=reviews,
            interactions=interactions,
            exclude=set(general_primary),
            genre=None,
            tags=tags,
            book_types=book_types,
            book_tags=book_tags,
        )

        general_final = _merge_hybrid_lists(general_primary, general_content, general_explore, n)
        print("[recommend] saving general hybrid:", general_final)
        save_recommendations_to_supabase(None, general_final, rec_type="hybrid")

        print("[recommend] Done.")
        return {"status": "done", "users_processed": len(user_ids)}

    except Exception as e:
        print("[recommend] compute_all_recommendations failed:", e)
        traceback.print_exc()
        return {"status": "error", "message": str(e)}