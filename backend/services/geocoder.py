"""
services/geocoder.py — Nominatim geocoding with SQLite cache and rate limiting.

Respects OSM's 1-request/second rule and caches results so the same
query is never sent twice.
"""
from __future__ import annotations

import json
import logging
import os
import sqlite3
import time
from pathlib import Path
from threading import Lock

import requests

logger = logging.getLogger(__name__)

_USER_AGENT = os.getenv("NOMINATIM_USER_AGENT", "TouristSafetyResearchApp/1.0 (tourist-safety-kerala-project)")
_NOMINATIM  = "https://nominatim.openstreetmap.org/search"
_LAST_CALL  = 0.0
_CALL_LOCK  = Lock()

_CACHE_DB = Path(__file__).resolve().parents[1] / "data" / "geocache.db"
_db_conn: sqlite3.Connection | None = None


def _get_db() -> sqlite3.Connection:
    global _db_conn
    if _db_conn is None:
        _CACHE_DB.parent.mkdir(parents=True, exist_ok=True)
        _db_conn = sqlite3.connect(str(_CACHE_DB), check_same_thread=False)
        _db_conn.execute(
            "CREATE TABLE IF NOT EXISTS geocache "
            "(query TEXT PRIMARY KEY, result TEXT, fetched_at TEXT)"
        )
        _db_conn.commit()
    return _db_conn


def _cache_get(query: str) -> dict | None:
    row = _get_db().execute(
        "SELECT result FROM geocache WHERE query=?", (query,)
    ).fetchone()
    if row:
        return json.loads(row[0])
    return None


def _cache_set(query: str, result: dict):
    _get_db().execute(
        "INSERT OR REPLACE INTO geocache(query, result, fetched_at) VALUES(?,?,datetime('now'))",
        (query, json.dumps(result)),
    )
    _get_db().commit()


def _rate_limited_get(params: dict) -> list | None:
    global _LAST_CALL
    with _CALL_LOCK:
        elapsed = time.time() - _LAST_CALL
        if elapsed < 1.1:
            time.sleep(1.1 - elapsed)
        try:
            r = requests.get(
                _NOMINATIM, params=params,
                headers={"User-Agent": _USER_AGENT},
                timeout=10,
            )
            _LAST_CALL = time.time()
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            logger.warning("Nominatim error: %s", exc)
            _LAST_CALL = time.time()
            return None


def geocode(place_name: str, region_hint: str = "Kerala, India") -> dict | None:
    """
    Returns dict with {lat, lon, display_name} or None.
    """
    query = f"{place_name}, {region_hint}"
    cached = _cache_get(query)
    if cached is not None:
        return cached if cached else None   # {} means "not found"

    results = _rate_limited_get({
        "q": query, "format": "json", "limit": 1,
        "addressdetails": 0,
    })

    if results:
        r = results[0]
        data = {
            "lat": float(r["lat"]),
            "lon": float(r["lon"]),
            "display_name": r.get("display_name", place_name),
        }
        _cache_set(query, data)
        return data
    else:
        _cache_set(query, {})   # cache "not found"
        return None


def reverse_geocode(lat: float, lon: float) -> str:
    """Return a short place name for coordinates."""
    query = f"rev:{lat:.4f},{lon:.4f}"
    cached = _cache_get(query)
    if cached is not None:
        return cached.get("display_name", f"{lat:.4f},{lon:.4f}")

    with _CALL_LOCK:
        elapsed = time.time() - _LAST_CALL
        if elapsed < 1.1:
            time.sleep(1.1 - elapsed)
        try:
            r = requests.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lon, "format": "json"},
                headers={"User-Agent": _USER_AGENT},
                timeout=10,
            )
            _LAST_CALL = time.time()
            r.raise_for_status()
            data = r.json()
            name = data.get("address", {}).get("suburb") \
                or data.get("address", {}).get("neighbourhood") \
                or data.get("display_name", f"{lat:.4f},{lon:.4f}")
            _cache_set(query, {"display_name": name})
            return name
        except Exception as exc:
            _LAST_CALL = time.time()
            logger.warning("Reverse geocode failed: %s", exc)
            return f"{lat:.4f},{lon:.4f}"
