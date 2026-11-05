"""
api/db.py — SQLite database helpers.

Tables:
  places   — tourist attractions from OSM + Wikipedia
  incidents — news-derived + user-reported incidents
"""
from __future__ import annotations

import json
import logging
import os
import sqlite3
import time
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

_DB_PATH = Path(__file__).resolve().parents[1] / os.getenv("DB_PATH", "data/places.db")
_conn: sqlite3.Connection | None = None

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# ── Connection ────────────────────────────────────────────────────────────────
def get_db() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute("PRAGMA foreign_keys=ON")
    return _conn


def close_db():
    global _conn
    if _conn:
        _conn.close()
        _conn = None


# ── Schema ────────────────────────────────────────────────────────────────────
DDL = """
CREATE TABLE IF NOT EXISTS places (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    lat         REAL NOT NULL,
    lon         REAL NOT NULL,
    category    TEXT,
    description TEXT,
    h3_cell     TEXT,
    wikidata_id TEXT,
    osm_id      TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_places_lat_lon ON places(lat, lon);

CREATE TABLE IF NOT EXISTS incidents (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    place_id      INTEGER REFERENCES places(id),
    headline      TEXT NOT NULL,
    incident_type TEXT NOT NULL DEFAULT 'OTHER',
    severity      INTEGER NOT NULL DEFAULT 1,
    lat           REAL,
    lon           REAL,
    location_name TEXT,
    source_url    TEXT,
    source        TEXT,
    timestamp     TEXT,
    verified      INTEGER NOT NULL DEFAULT 0,
    raw_text      TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inc_timestamp ON incidents(timestamp);
CREATE INDEX IF NOT EXISTS idx_inc_lat_lon   ON incidents(lat, lon);
"""


def init_db():
    db = get_db()
    db.executescript(DDL)
    db.commit()
    logger.info("Database initialised at %s", _DB_PATH)

    # Seed places if empty
    count = db.execute("SELECT COUNT(*) FROM places").fetchone()[0]
    if count == 0:
        logger.info("Places table empty — seeding from OSM …")
        try:
            seed_places_from_osm()
        except Exception as exc:
            logger.error("OSM seeding failed: %s", exc)
            _seed_fallback_places()


# ── OSM place seeding ─────────────────────────────────────────────────────────
def _overpass_fetch(query: str) -> list:
    try:
        r = requests.post(OVERPASS_URL, data={"data": query}, timeout=15)
        if r.ok:
            return r.json().get("elements", [])
        logger.warning("Overpass HTTP %d - falling back to curated places", r.status_code)
    except Exception as exc:
        logger.warning("Overpass error: %s - falling back to curated places", exc)
    return []


def seed_places_from_osm():
    import h3 as h3lib

    place   = os.getenv("REGION_NAME",   "Ernakulam")
    al      = os.getenv("ADMIN_LEVEL",   "5")
    h3_res  = int(os.getenv("H3_RES",    "8"))

    query = f"""
[out:json][timeout:30];
area["name"="{place}"]["boundary"="administrative"]["admin_level"="{al}"]->.a;
(
  nwr["tourism"~"attraction|museum|viewpoint|gallery|aquarium|theme_park|zoo|artwork"](area.a);
  nwr["historic"](area.a);
  nwr["leisure"~"park|nature_reserve|beach_resort"](area.a);
  nwr["amenity"~"place_of_worship|theatre|cinema"](area.a);
);
out center tags;
"""
    elements = _overpass_fetch(query)
    logger.info("OSM returned %d tourism/historic elements", len(elements))

    if not elements:
        logger.info("Using curated tourist landmarks for Kochi/Ernakulam...")
        _seed_fallback_places()
        return

    db = get_db()
    inserted = 0
    for e in elements:
        tags = e.get("tags", {})
        name = tags.get("name") or tags.get("name:en")
        if not name:
            continue

        lat = lon = None
        if "lat" in e:
            lat, lon = e["lat"], e["lon"]
        elif "center" in e:
            lat, lon = e["center"]["lat"], e["center"]["lon"]
        if lat is None:
            continue

        category = (
            tags.get("tourism") or tags.get("historic") or
            tags.get("leisure") or tags.get("amenity") or "place"
        )
        h3_cell = h3lib.latlng_to_cell(lat, lon, h3_res)
        osm_id  = f"{e.get('type','n')}{e.get('id', '')}"
        wikidata = tags.get("wikidata", "")

        desc = _fetch_wikipedia_summary(name, wikidata)
        try:
            db.execute(
                """INSERT OR IGNORE INTO places
                   (name, lat, lon, category, description, h3_cell, wikidata_id, osm_id)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (name, lat, lon, category, desc, h3_cell, wikidata, osm_id),
            )
            inserted += 1
        except sqlite3.IntegrityError:
            pass

    db.commit()
    logger.info("Inserted %d places from OSM", inserted)


def _fetch_wikipedia_summary(name: str, wikidata_id: str = "") -> str:
    try:
        import wikipediaapi
        wiki = wikipediaapi.Wikipedia(
            language="en",
            user_agent=os.getenv("NOMINATIM_USER_AGENT", "TouristSafetyApp/1.0"),
        )
        page = wiki.page(name)
        if page.exists():
            return page.summary[:500]
    except Exception as exc:
        logger.debug("Wikipedia fetch failed for '%s': %s", name, exc)
    return ""


def _seed_fallback_places():
    """Insert iconic tourist destinations across all regions of India."""
    fallback = [
        # North India
        ("Taj Mahal, Agra",            27.1751, 78.0421, "historic",   "UNESCO World Heritage ivory-white marble mausoleum on the Yamuna river"),
        ("India Gate, New Delhi",      28.6129, 77.2295, "historic",   "War memorial and iconic central promenade in the heart of Delhi"),
        ("Red Fort, Delhi",            28.6562, 77.2410, "historic",   "Historic Mughal fortress complex in Old Delhi"),
        ("Qutub Minar, Delhi",         28.5245, 77.1855, "historic",   "73-metre minaret of victory built in 1193 with rich carvings"),
        ("Golden Temple, Amritsar",    31.6200, 74.8765, "spiritual",  "Preeminent spiritual site of Sikhism covered with gold leaf"),
        ("Hawa Mahal, Jaipur",         26.9239, 75.8267, "historic",   "Palace of Winds constructed in pink and red sandstone"),
        ("City Palace, Jaipur",        26.9258, 75.8237, "museum",     "Stunning royal palace complex with courtyards, gardens and museums"),
        ("Amber Fort, Jaipur",         26.9855, 75.8513, "historic",   "Majestic hilltop fort overlooking Maota Lake"),
        ("Kashi Vishwanath, Varanasi", 25.3109, 83.0107, "spiritual",  "Ancient Hindu temple on the western bank of the holy Ganges"),
        ("Dashashwamedh Ghat, Varanasi",25.3060, 83.0103,"attraction", "Famous river ghat celebrated for evening Ganga Aarti ceremonies"),

        # West India
        ("Gateway of India, Mumbai",   18.9220, 72.8347, "attraction", "Colonial arch monument overlooking Mumbai Harbor and Arabian Sea"),
        ("Marine Drive, Mumbai",       18.9430, 72.8230, "attraction", "Queen's Necklace arc-shaped seaside promenade in South Mumbai"),
        ("Elephanta Caves, Mumbai",    18.9633, 72.9315, "historic",   "Rock-cut cave temples dedicated to Shiva on Gharapuri Island"),
        ("Calangute Beach, Goa",       15.5439, 73.7553, "beach",      "Lively coastal stretch with water sports and beach cafes in North Goa"),
        ("Basilica of Bom Jesus, Goa", 15.5009, 73.9116, "historic",   "Baroque UNESCO world heritage church holding relics of St. Francis Xavier"),
        ("Baga Beach, Goa",            15.5553, 73.7516, "beach",      "Popular beach destination known for night markets and water activities"),

        # South India
        ("Fort Kochi Promenade",       9.9668,  76.2420, "beach",      "Historic seaside promenade lined with Chinese fishing nets"),
        ("Chinese Fishing Nets, Kochi",9.9678,  76.2415, "attraction", "Famous shoreline fishing cantilever installations in Fort Kochi"),
        ("Mysore Palace, Mysuru",      12.3052, 76.6552, "historic",   "Royal residence of the Wadiyar dynasty illuminated by thousands of lights"),
        ("Virupaksha Temple, Hampi",   15.3350, 76.4600, "historic",   "7th-century temple in UNESCO Hampi boulder landscape"),
        ("Charminar, Hyderabad",       17.3616, 78.4747, "historic",   "16th-century mosque with four grand arches and bustling bazaars"),
        ("Marina Beach, Chennai",      13.0500, 80.2824, "beach",      "One of the longest natural urban beaches in the world"),
        ("Meenakshi Amman Temple, Madurai",9.9195,78.1193,"spiritual", "Historic Hindu temple complex with towering gopurams"),
        ("Munnar Tea Gardens, Kerala", 10.0889, 77.0595, "nature",     "Rolling emerald tea estates and hill station viewpoint"),

        # East & Northeast India
        ("Victoria Memorial, Kolkata", 22.5448, 88.3426, "museum",     "Grand marble monument with lush landscaped gardens in Kolkata"),
        ("Howrah Bridge, Kolkata",     22.5851, 88.3468, "attraction", "Iconic cantilever bridge spanning the Hooghly River"),
        ("Sun Temple, Konark",         19.8876, 86.0945, "historic",   "13th-century Sun Temple shaped like a colossal chariot with stone wheels"),
        ("Jagannath Temple, Puri",     19.8048, 85.8180, "spiritual",  "Sacred Hindu pilgrimage temple on the Odisha coast"),
        ("Tiger Hill, Darjeeling",     26.9950, 88.2860, "viewpoint",  "Panoramic sunrise viewpoint over Mount Kanchenjunga"),
        ("Kamakhya Temple, Guwahati",  26.1664, 91.7054, "spiritual",  "Sacred hilltop temple dedicated to mother goddess Kamakhya"),
    ]
    db = get_db()
    import h3 as h3lib
    h3_res = int(os.getenv("H3_RES", "8"))
    for name, lat, lon, cat, desc in fallback:
        try:
            h3_cell = h3lib.latlng_to_cell(lat, lon, h3_res)
        except Exception:
            h3_cell = ""
        db.execute(
            "INSERT OR IGNORE INTO places(name,lat,lon,category,description,h3_cell) VALUES(?,?,?,?,?,?)",
            (name, lat, lon, cat, desc, h3_cell),
        )
    db.commit()
    logger.info("Inserted %d Pan-India fallback places", len(fallback))


# ── Incident helpers ──────────────────────────────────────────────────────────
def save_incidents(incidents: list[dict]):
    """Upsert a batch of incident dicts into the DB (skip exact headline duplicates)."""
    db = get_db()
    inserted = 0
    for inc in incidents:
        # Skip if same headline + source_url already in DB
        exists = db.execute(
            "SELECT 1 FROM incidents WHERE headline=? AND source_url=?",
            (inc.get("headline",""), inc.get("source_url","")),
        ).fetchone()
        if exists:
            continue

        # Try to match a place_id
        place_id = None
        if inc.get("lat") and inc.get("lon"):
            row = db.execute(
                """SELECT id FROM places
                   ORDER BY (ABS(lat-?) + ABS(lon-?)) LIMIT 1""",
                (inc["lat"], inc["lon"]),
            ).fetchone()
            if row:
                place_id = row[0]

        db.execute(
            """INSERT INTO incidents
               (place_id, headline, incident_type, severity, lat, lon,
                location_name, source_url, source, timestamp, verified, raw_text)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                place_id,
                inc.get("headline", "")[:500],
                inc.get("incident_type", "OTHER"),
                int(inc.get("severity", 1)),
                inc.get("lat"), inc.get("lon"),
                inc.get("location_name", ""),
                inc.get("source_url", ""),
                inc.get("source", ""),
                inc.get("timestamp", ""),
                int(inc.get("verified", False)),
                inc.get("raw_text", "")[:1000],
            ),
        )
        inserted += 1
    db.commit()
    logger.info("Saved %d new incidents to DB", inserted)
    return inserted
