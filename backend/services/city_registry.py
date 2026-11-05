"""
services/city_registry.py — Dynamic multi-city support for all of India.

When a user requests a city that is NOT Kochi/Ernakulam, this module:
  1. Geocodes the city via Nominatim to get its centre coordinates.
  2. Builds OSM-derived baseline features (police, hospital, lamps, POIs)
     on-demand and caches them in SQLite.
  3. Populates tourist places from the Overpass API for that city.
  4. Returns search terms for news ingestion specific to that city.

This means the backend works for ANY city in India without restart.
"""
from __future__ import annotations

import json
import logging
import math
import sqlite3
import time
from pathlib import Path
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).resolve().parents[1] / "data"
_CITY_CACHE_DB = _DATA_DIR / "city_cache.db"
_OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# ── well-known Indian city centres (instant fallback, no geocoding needed) ──
KNOWN_INDIAN_CITIES: dict[str, tuple[float, float]] = {
    "kochi":          (9.9312,  76.2673),
    "ernakulam":      (9.9312,  76.2673),
    "cochin":         (9.9312,  76.2673),
    "thiruvananthapuram": (8.5241, 76.9366),
    "trivandrum":     (8.5241,  76.9366),
    "kozhikode":      (11.2588, 75.7804),
    "calicut":        (11.2588, 75.7804),
    "thrissur":       (10.5276, 76.2144),
    "kollam":         (8.8932,  76.6141),
    "kannur":         (11.8745, 75.3704),
    "munnar":         (10.0889, 77.0595),
    "alleppey":       (9.4981,  76.3388),
    "alappuzha":      (9.4981,  76.3388),
    "mumbai":         (19.0760, 72.8777),
    "delhi":          (28.7041, 77.1025),
    "new delhi":      (28.6139, 77.2090),
    "bengaluru":      (12.9716, 77.5946),
    "bangalore":      (12.9716, 77.5946),
    "chennai":        (13.0827, 80.2707),
    "madras":         (13.0827, 80.2707),
    "hyderabad":      (17.3850, 78.4867),
    "pune":           (18.5204, 73.8567),
    "ahmedabad":      (23.0225, 72.5714),
    "kolkata":        (22.5726, 88.3639),
    "calcutta":       (22.5726, 88.3639),
    "jaipur":         (26.9124, 75.7873),
    "lucknow":        (26.8467, 80.9462),
    "surat":          (21.1702, 72.8311),
    "nagpur":         (21.1458, 79.0882),
    "patna":          (25.5941, 85.1376),
    "bhopal":         (23.2599, 77.4126),
    "indore":         (22.7196, 75.8577),
    "chandigarh":     (30.7333, 76.7794),
    "guwahati":       (26.1445, 91.7362),
    "bhubaneswar":    (20.2961, 85.8245),
    "ranchi":         (23.3441, 85.3096),
    "goa":            (15.2993, 74.1240),
    "panaji":         (15.4909, 73.8278),
    "shimla":         (31.1048, 77.1734),
    "manali":         (32.2432, 77.1892),
    "agra":           (27.1767, 78.0081),
    "varanasi":       (25.3176, 82.9739),
    "amritsar":       (31.6340, 74.8723),
    "mysuru":         (12.2958, 76.6394),
    "mysore":         (12.2958, 76.6394),
    "coimbatore":     (11.0168, 76.9558),
    "madurai":        (9.9252,  78.1198),
    "pondicherry":    (11.9416, 79.8083),
    "puducherry":     (11.9416, 79.8083),
    "visakhapatnam":  (17.6868, 83.2185),
    "vizag":          (17.6868, 83.2185),
    "vijayawada":     (16.5062, 80.6480),
    "mangalore":      (12.9141, 74.8560),
    "mangaluru":      (12.9141, 74.8560),
    "hubli":          (15.3647, 75.1240),
    "dharwad":        (15.4589, 75.0078),
    "tirupati":       (13.6288, 79.4192),
    "ooty":           (11.4102, 76.6950),
    "udagamandalam":  (11.4102, 76.6950),
    "darjeeling":     (27.0360, 88.2627),
    "leh":            (34.1526, 77.5771),
    "srinagar":       (34.0837, 74.7973),
    "jodhpur":        (26.2389, 73.0243),
    "udaipur":        (24.5854, 73.7125),
    "mount abu":      (24.5926, 72.7156),
    "rishikesh":      (30.0869, 78.2676),
    "haridwar":       (29.9457, 78.1642),
    "pushkar":        (26.4896, 74.5511),
    "hampi":          (15.3350, 76.4600),
    "puri":           (19.8135, 85.8312),
    "konark":         (19.8876, 86.0945),
    "khajuraho":      (24.8318, 79.9199),
    "ranthambore":    (26.0173, 76.5026),
    "corbett":        (29.5300, 78.7747),
    "kaziranga":      (26.6803, 93.3693),
    "sundarbans":     (21.9497, 88.8800),
    "andaman":        (11.7401, 92.6586),
    "port blair":     (11.6234, 92.7265),
}


def _get_city_cache_db() -> sqlite3.Connection:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_CITY_CACHE_DB), check_same_thread=False)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS city_centres (
            city_key   TEXT PRIMARY KEY,
            city_name  TEXT,
            lat        REAL,
            lon        REAL,
            fetched_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS city_features (
            city_key       TEXT PRIMARY KEY,
            num_police     INTEGER DEFAULT 0,
            num_hospitals  INTEGER DEFAULT 0,
            num_lamps      INTEGER DEFAULT 0,
            avg_dist_police_km   REAL DEFAULT 5.0,
            avg_dist_hospital_km REAL DEFAULT 5.0,
            fetched_at     TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    return conn


def _nominatim_geocode(city: str) -> Optional[tuple[float, float, str]]:
    """Geocode a city within India using Nominatim. Returns (lat, lon, display_name)."""
    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": f"{city}, India",
                "format": "json",
                "limit": 1,
                "countrycodes": "in",
            },
            headers={"User-Agent": "TouristSafetyApp/1.0 (india-wide-safety-prototype)"},
            timeout=10,
        )
        results = r.json()
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"]), results[0]["display_name"]
    except Exception as e:
        logger.warning("Nominatim geocode failed for '%s': %s", city, e)
    return None


def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _fetch_overpass(lat: float, lon: float, amenity: str, radius_m: int = 10000) -> list[dict]:
    """
    Fetch all amenity nodes within radius_m metres of (lat, lon).
    """
    q = f"""
    [out:json][timeout:30];
    node["amenity"="{amenity}"](around:{radius_m},{lat},{lon});
    out center;
    """
    try:
        r = requests.post(_OVERPASS_URL, data={"data": q}, timeout=35)
        if r.ok:
            return r.json().get("elements", [])
    except Exception as e:
        logger.warning("Overpass fetch failed (amenity=%s): %s", amenity, e)
    return []


def get_city_centre(city: str) -> tuple[float, float, str]:
    """
    Return (lat, lon, display_name) for any Indian city.
    Uses: known cities dict → SQLite cache → Nominatim geocoding.
    """
    key = city.strip().lower()
    # 1. Known cities – instant
    if key in KNOWN_INDIAN_CITIES:
        lat, lon = KNOWN_INDIAN_CITIES[key]
        return lat, lon, city.title()

    # 2. SQLite cache
    db = _get_city_cache_db()
    row = db.execute("SELECT lat, lon, city_name FROM city_centres WHERE city_key=?", (key,)).fetchone()
    if row:
        return float(row[0]), float(row[1]), str(row[2])

    # 3. Nominatim live geocoding
    result = _nominatim_geocode(city)
    if result:
        lat, lon, display = result
        db.execute(
            "INSERT OR REPLACE INTO city_centres(city_key, city_name, lat, lon) VALUES (?,?,?,?)",
            (key, display, lat, lon),
        )
        db.commit()
        return lat, lon, display

    # 4. Hard fallback – centre of India
    logger.error("Could not resolve city '%s'; falling back to India centre.", city)
    return 20.5937, 78.9629, city.title()


def get_city_safety_baseline(city: str, lat: float, lon: float) -> dict:
    """
    Return pre-computed safety infrastructure density for a city.
    Data is fetched fresh from OSM the first time and cached for 7 days.
    Returns keys: avg_dist_police_km, avg_dist_hospital_km, num_police, num_hospitals
    """
    key = city.strip().lower()
    db = _get_city_cache_db()

    # Return cached result if < 7 days old
    row = db.execute(
        "SELECT num_police, num_hospitals, avg_dist_police_km, avg_dist_hospital_km, fetched_at "
        "FROM city_features WHERE city_key=? AND fetched_at > datetime('now','-7 days')",
        (key,),
    ).fetchone()
    if row:
        return {
            "num_police": row[0],
            "num_hospitals": row[1],
            "avg_dist_police_km": row[2],
            "avg_dist_hospital_km": row[3],
        }

    # Fetch fresh from OSM
    police_nodes    = _fetch_overpass(lat, lon, "police",   radius_m=15000)
    hospital_nodes  = _fetch_overpass(lat, lon, "hospital", radius_m=15000)

    def avg_dist(nodes):
        if not nodes:
            return 5.0
        dists = [_haversine_km(lat, lon, n.get("lat", lat), n.get("lon", lon)) for n in nodes]
        return round(sum(dists) / len(dists), 3)

    baseline = {
        "num_police":             len(police_nodes),
        "num_hospitals":          len(hospital_nodes),
        "avg_dist_police_km":     avg_dist(police_nodes),
        "avg_dist_hospital_km":   avg_dist(hospital_nodes),
    }

    db.execute(
        """INSERT OR REPLACE INTO city_features
           (city_key, num_police, num_hospitals, avg_dist_police_km, avg_dist_hospital_km)
           VALUES (?,?,?,?,?)""",
        (key, baseline["num_police"], baseline["num_hospitals"],
         baseline["avg_dist_police_km"], baseline["avg_dist_hospital_km"]),
    )
    db.commit()
    logger.info(
        "City features cached for '%s': %d police, %d hospitals",
        city, baseline["num_police"], baseline["num_hospitals"],
    )
    return baseline


def build_city_news_terms(city: str, state: str = "India") -> list[str]:
    """
    Generate city-specific safety news search terms for GDELT and Google News.
    These are used by the news ingestion scheduler.
    """
    c = city.strip().title()
    s = state.strip().title()
    return [
        f"theft {c}",
        f"robbery {c}",
        f"assault {c}",
        f"harassment {c}",
        f"scam tourist {c}",
        f"accident {c}",
        f"road accident {c}",
        f"protest {c}",
        f"hartal {s}",
        f"bandh {c}",
        f"strike {c}",
        f"flood {c}",
        f"flood {s}",
        f"landslide {s}",
        f"fire {c}",
        f"curfew {c}",
        f"riot {c}",
        f"crime {c}",
        f"missing tourist {c}",
        f"tourist alert {c}",
        f"police advisory {c}",
        f"evacuation {c}",
    ]
