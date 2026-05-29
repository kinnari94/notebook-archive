"""MongoDB Atlas connection and all database operations."""

import streamlit as st
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from datetime import datetime
from typing import Optional
import re

# ── Connection ────────────────────────────────────────────────────────────────

def _resolve_uri() -> str:
    """URI priority: session_state (Settings page) > secrets.toml > empty."""
    if uri := st.session_state.get("mongodb_uri", ""):
        return uri
    try:
        return st.secrets.get("MONGODB_URI", "")
    except Exception:
        return ""

def _resolve_db_name() -> str:
    if name := st.session_state.get("mongodb_db", ""):
        return name
    try:
        return st.secrets.get("MONGODB_DB", "bapaji_archive")
    except Exception:
        return "bapaji_archive"

@st.cache_resource
def _get_cached_client(uri: str):
    """Cached by URI so changing the URI in Settings gets a fresh client."""
    if not uri:
        return None
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        return client
    except Exception:
        return None

def get_db_client():
    return _get_cached_client(_resolve_uri())

def get_db():
    client = get_db_client()
    if client is None:
        return None
    return client[_resolve_db_name()]

def test_connection(uri: str) -> tuple[bool, str]:
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        client.close()
        return True, "Connection successful"
    except ConnectionFailure:
        return False, "Could not connect — check URI and network"
    except Exception as e:
        return False, str(e)

# ── Collection names ──────────────────────────────────────────────────────────

COLLECTIONS = {
    "incidents":            "incidents",
    "people":               "people",
    "locations":            "locations",
    "sources":              "sources",
    "extractions":          "extraction_jobs",
    "daily_dateline":       "daily_dateline",
    "health":               "health_aahar_discipline",
    "spiritual_exp":        "spiritual_exp",
    "institutional":        "institutional_timeline",
    "wings":                "wings",
    "physical_spaces":      "physical_spaces",
    "seva_projects":        "seva_projects",
    "awards":               "awards_accreds",
    "artifacts":            "artifacts",
    "social_contextual":    "social_contextual",
    "counts":               "counts",
}

# ── Stats ─────────────────────────────────────────────────────────────────────

def get_archive_stats() -> dict:
    db = get_db()
    if db is None:
        return {}
    stats = {}
    for key, col in COLLECTIONS.items():
        try:
            stats[key] = db[col].count_documents({})
        except Exception:
            stats[key] = 0
    return stats

def get_category_breakdown() -> list[dict]:
    db = get_db()
    if db is None:
        return []
    try:
        pipeline = [
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        return list(db["incidents"].aggregate(pipeline))
    except Exception:
        return []

def get_recent_extractions(limit=10) -> list[dict]:
    db = get_db()
    if db is None:
        return []
    try:
        return list(
            db["extraction_jobs"]
            .find({}, {"_id": 0})
            .sort("started_at", -1)
            .limit(limit)
        )
    except Exception:
        return []

# ── Insert ────────────────────────────────────────────────────────────────────

def insert_incidents(incidents: list[dict], source_meta: dict) -> int:
    db = get_db()
    if db is None or not incidents:
        return 0
    now = datetime.utcnow()
    for inc in incidents:
        inc["extracted_at"] = now
        inc["source_notebook"] = source_meta.get("notebook_id", "")
        inc["source_title"]    = source_meta.get("notebook_title", "")
        inc["source_type"]     = "notebooklm_transcript"
        if "people" not in inc:
            inc["people"] = []
        if "locations" not in inc:
            inc["locations"] = []
        if "access_tier" not in inc:
            inc["access_tier"] = 1
    try:
        result = db["incidents"].insert_many(incidents)
        return len(result.inserted_ids)
    except Exception:
        return 0

def upsert_person(name: str, person_type: str = "", relation: str = "") -> str:
    db = get_db()
    if db is None:
        return ""
    try:
        result = db["people"].find_one_and_update(
            {"name": name},
            {"$setOnInsert": {
                "name": name,
                "person_type": person_type,
                "relation_to_bapaji": relation,
                "created_at": datetime.utcnow()
            }},
            upsert=True,
            return_document=True
        )
        return str(result.get("_id", ""))
    except Exception:
        return ""

def log_extraction_job(job: dict):
    db = get_db()
    if db is None:
        return
    try:
        db["extraction_jobs"].insert_one(job)
    except Exception:
        pass

def update_extraction_job(job_id: str, update: dict):
    db = get_db()
    if db is None:
        return
    from bson import ObjectId
    try:
        db["extraction_jobs"].update_one(
            {"_id": ObjectId(job_id)},
            {"$set": update}
        )
    except Exception:
        pass

# ── Query ─────────────────────────────────────────────────────────────────────

def query_incidents(
    category: Optional[str] = None,
    person: Optional[str] = None,
    location: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    access_tier_max: int = 1,
    search_text: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
) -> tuple[list[dict], int]:
    db = get_db()
    if db is None:
        return [], 0

    filt: dict = {"access_tier": {"$lte": access_tier_max}}

    if category:
        filt["category"] = category
    if person:
        filt["people"] = {"$regex": person, "$options": "i"}
    if location:
        filt["locations"] = {"$regex": location, "$options": "i"}
    if year_from or year_to:
        yr: dict = {}
        if year_from:
            yr["$gte"] = year_from
        if year_to:
            yr["$lte"] = year_to
        filt["date.year"] = yr
    if search_text:
        filt["$text"] = {"$search": search_text}

    try:
        total = db["incidents"].count_documents(filt)
        cursor = (
            db["incidents"]
            .find(filt)
            .sort("date.year", 1)
            .skip(skip)
            .limit(limit)
        )
        docs = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            docs.append(doc)
        return docs, total
    except Exception:
        return [], 0

def get_incident_by_id(incident_id: str) -> Optional[dict]:
    db = get_db()
    if db is None:
        return None
    from bson import ObjectId
    try:
        doc = db["incidents"].find_one({"_id": ObjectId(incident_id)})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc
    except Exception:
        return None

def get_all_people(limit=200) -> list[str]:
    db = get_db()
    if db is None:
        return []
    try:
        result = db["incidents"].distinct("people")
        flat = []
        for item in result:
            if isinstance(item, list):
                flat.extend(item)
            elif isinstance(item, str) and item.strip():
                flat.append(item.strip())
        return sorted(set(flat))[:limit]
    except Exception:
        return []

def get_all_locations(limit=200) -> list[str]:
    db = get_db()
    if db is None:
        return []
    try:
        result = db["incidents"].distinct("locations")
        flat = []
        for item in result:
            if isinstance(item, list):
                flat.extend(item)
            elif isinstance(item, str) and item.strip():
                flat.append(item.strip())
        return sorted(set(flat))[:limit]
    except Exception:
        return []

def get_timeline_data() -> list[dict]:
    db = get_db()
    if db is None:
        return []
    try:
        pipeline = [
            {"$match": {"date.year": {"$exists": True, "$ne": None}}},
            {"$group": {
                "_id": "$date.year",
                "count": {"$sum": 1},
                "categories": {"$addToSet": "$category"},
                "incidents": {"$push": {"desc": "$description", "cat": "$category", "id": {"$toString": "$_id"}}}
            }},
            {"$sort": {"_id": 1}}
        ]
        return list(db["incidents"].aggregate(pipeline))
    except Exception:
        return []

def ensure_text_index():
    db = get_db()
    if db is None:
        return
    try:
        db["incidents"].create_index(
            [("description", "text"), ("source_chunk", "text"), ("people", "text")],
            name="full_text_search",
            default_language="english"
        )
    except Exception:
        pass
