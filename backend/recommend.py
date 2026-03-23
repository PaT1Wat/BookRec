import numpy as np
from lightfm import LightFM
from lightfm.data import Dataset
from supabase import create_client
import os

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

def get_recommendations(user_id: str, n: int = 10):
    # ดึง favorites จาก Supabase
    favs = supabase.table("favorite").select("*").execute().data
    books = supabase.table("books").select("bookID,title").execute().data
    tags  = supabase.table("bookTag").select("*").execute().data

    if not favs or not books:
        return []

    dataset = Dataset()
    dataset.fit(
        users=[f["user_id"] for f in favs],
        items=[b["bookID"] for b in books],
        item_features=[t["tagID"] for t in tags]
    )

    (interactions, _) = dataset.build_interactions(
        [(f["user_id"], f["bookID"]) for f in favs]
    )

    item_features = dataset.build_item_features(
        [(t["bookID"], [t["tagID"]]) for t in tags]
    )

    model = LightFM(loss="warp")
    model.fit(interactions, item_features=item_features, epochs=30)

    # predict
    uid = dataset.mapping()[0].get(user_id)
    if uid is None:
        return []

    n_items = interactions.shape[1]
    scores = model.predict(uid, np.arange(n_items), item_features=item_features)
    top_ids = np.argsort(-scores)[:n]

    # map กลับเป็น bookID
    id_map = {v: k for k, v in dataset.mapping()[2].items()}
    return [id_map[i] for i in top_ids if i in id_map]