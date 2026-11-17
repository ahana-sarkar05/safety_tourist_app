"""
services/news.py — Fetch recent news articles for the region.

Sources (all free, no API key required unless NEWS_API_KEY is set):
  1. GDELT DOC API v2
  2. Google News RSS
  3. NewsAPI.org (optional — set NEWS_API_KEY in .env)
"""
from __future__ import annotations

import hashlib
import logging
import os
import time
from datetime import datetime, timezone

import feedparser
import requests

from services.classifier import classify, deduplicate

logger = logging.getLogger(__name__)

_NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
_REGION_DISPLAY = os.getenv("REGION_DISPLAY", "India (National)")

# Safety-relevant search terms spanning major Indian regions and cities
SEARCH_TERMS = [
    # General national tourist safety terms
    "tourist safety India", "tourist advisory India", "scam tourist India",
    "theft tourist India", "harassment tourist India",
    # North
    "accident Delhi", "theft Delhi", "fire Delhi", "traffic Delhi", "protest Delhi",
    "tourist scam Agra", "theft Jaipur", "crime Jaipur", "flood Varanasi",
    "landslide Himachal", "landslide Uttarakhand", "accident Manali",
    # West
    "accident Mumbai", "heavy rain Mumbai", "waterlogging Mumbai", "theft Mumbai",
    "scam tourist Goa", "beach accident Goa", "theft Pune",
    # South
    "accident Bengaluru", "traffic Bengaluru", "fire Bengaluru",
    "accident Chennai", "cyclone Chennai", "waterlogging Chennai",
    "theft Kochi", "robbery Ernakulam", "accident Kochi", "high tide Kerala",
    "landslide Wayanad", "traffic Hyderabad",
    # East & Northeast
    "theft Kolkata", "fire Kolkata", "accident Kolkata", "waterlogging Kolkata",
    "flood Assam", "landslide Darjeeling", "cyclone Odisha",
]


# ─── GDELT DOC API ───────────────────────────────────────────────────────────
def _fetch_gdelt(query: str, max_records: int = 10) -> list[dict]:
    url = "https://api.gdeltproject.org/api/v2/doc/doc"
    params = {
        "query": query,
        "mode": "artlist",
        "maxrecords": max_records,
        "format": "json",
        "timespan": "2d",
        "sourcelang": "english",
    }
    try:
        r = requests.get(url, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        articles = data.get("articles", []) or []
        result = []
        for a in articles:
            result.append({
                "headline": a.get("title", ""),
                "source_url": a.get("url", ""),
                "source": "GDELT",
                "timestamp": a.get("seendate", datetime.now(timezone.utc).isoformat()),
                "body": "",
            })
        return result
    except Exception as exc:
        logger.warning("GDELT fetch failed for '%s': %s", query, exc)
        return []


# ─── Google News RSS ─────────────────────────────────────────────────────────
def _fetch_gnews_rss(query: str) -> list[dict]:
    encoded = query.replace(" ", "+")
    url = f"https://news.google.com/rss/search?q={encoded}&hl=en-IN&gl=IN&ceid=IN:en"
    try:
        feed = feedparser.parse(url)
        result = []
        for entry in feed.entries[:10]:
            ts = entry.get("published", datetime.now(timezone.utc).isoformat())
            result.append({
                "headline": entry.get("title", ""),
                "source_url": entry.get("link", ""),
                "source": "Google News RSS",
                "timestamp": ts,
                "body": entry.get("summary", ""),
            })
        return result
    except Exception as exc:
        logger.warning("Google News RSS failed for '%s': %s", query, exc)
        return []


# ─── NewsAPI.org (optional) ───────────────────────────────────────────────────
def _fetch_newsapi(query: str) -> list[dict]:
    if not _NEWS_API_KEY:
        return []
    url = "https://newsapi.org/v2/everything"
    params = {
        "q": query, "language": "en",
        "sortBy": "publishedAt", "pageSize": 10,
        "apiKey": _NEWS_API_KEY,
    }
    try:
        r = requests.get(url, params=params, timeout=15)
        r.raise_for_status()
        articles = r.json().get("articles", [])
        return [{
            "headline": a.get("title", ""),
            "source_url": a.get("url", ""),
            "source": f"NewsAPI / {a.get('source', {}).get('name', '')}",
            "timestamp": a.get("publishedAt", datetime.now(timezone.utc).isoformat()),
            "body": a.get("description", "") or "",
        } for a in articles]
    except Exception as exc:
        logger.warning("NewsAPI failed for '%s': %s", query, exc)
        return []


# ─── Geocode + match to DB ────────────────────────────────────────────────────
def _extract_location(headline: str, body: str) -> tuple[float | None, float | None, str | None]:
    """Try to extract a lat/lon from the article by matching known places or Nominatim."""
    from api.db import get_db

    # Check headline against place names in DB
    text = (headline + " " + body).lower()
    try:
        db = get_db()
        places = db.execute("SELECT name, lat, lon FROM places").fetchall()
        for name, lat, lon in places:
            if name.lower() in text:
                return lat, lon, name
    except Exception:
        pass

    # Fallback: try Nominatim on candidate place names
    from services.geocoder import geocode
    import re
    STOPWORDS = {
        "the", "in", "at", "for", "on", "to", "of", "and", "a", "an",
        "india", "kerala", "theft", "crime", "police", "arrest",
        "court", "minister", "government", "times", "news", "today",
        "death", "dead", "killed", "injured", "man", "woman", "youth"
    }
    caps = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b', headline)
    for cap in caps:
        if cap.lower() in STOPWORDS:
            continue
        result = geocode(cap)
        if result:
            lat, lon = result["lat"], result["lon"]
            # Validate it's roughly in the region bbox
            s = float(os.getenv("REGION_BBOX_SOUTH", "9.8"))
            n = float(os.getenv("REGION_BBOX_NORTH", "10.2"))
            w = float(os.getenv("REGION_BBOX_WEST",  "76.1"))
            e = float(os.getenv("REGION_BBOX_EAST",  "76.5"))
            if s <= lat <= n and w <= lon <= e:
                return lat, lon, cap
            break
    return None, None, None


# ─── Main public function ─────────────────────────────────────────────────────
def fetch_and_classify_news() -> list[dict]:
    """
    Fetch news from all sources, classify, deduplicate, and return incident dicts.
    Returns list of dicts ready to insert into the incidents table.
    """
    raw: list[dict] = []

    for term in SEARCH_TERMS:
        raw.extend(_fetch_gdelt(term, max_records=5))
        raw.extend(_fetch_gnews_rss(term))
        raw.extend(_fetch_newsapi(term))
        time.sleep(0.3)  # gentle on public APIs

    logger.info("Raw articles fetched: %d", len(raw))

    # Filter out empty headlines
    raw = [a for a in raw if a.get("headline", "").strip()]

    # Deduplicate by headline similarity
    raw = deduplicate(raw, threshold=0.65)
    logger.info("After dedup: %d articles", len(raw))

    incidents: list[dict] = []
    for art in raw:
        itype, severity = classify(art["headline"], art.get("body", ""))
        if itype == "OTHER":
            continue  # skip irrelevant articles

        lat, lon, location = _extract_location(art["headline"], art.get("body", ""))

        # Default to region centre if no location found
        if lat is None:
            lat = float(os.getenv("REGION_LAT", "9.9312"))
            lon = float(os.getenv("REGION_LON", "76.2673"))

        # Normalise timestamp
        ts = art.get("timestamp", "")
        try:
            if isinstance(ts, str) and ts:
                # Handle GDELT format: "20240101T120000Z"
                if "T" in ts and len(ts) == 16 and ts.endswith("Z") is False and ":" not in ts:
                    ts = datetime.strptime(ts, "%Y%m%dT%H%M%SZ").isoformat()
        except Exception:
            ts = datetime.now(timezone.utc).isoformat()

        incidents.append({
            "headline": art["headline"][:500],
            "incident_type": itype,
            "severity": severity,
            "lat": lat,
            "lon": lon,
            "location_name": location or os.getenv("REGION_DISPLAY", "Kochi"),
            "source_url": art["source_url"],
            "source": art["source"],
            "timestamp": ts or datetime.now(timezone.utc).isoformat(),
            "verified": False,
            "raw_text": art.get("body", "")[:1000],
        })

    logger.info("Classified incidents: %d", len(incidents))
    return incidents
