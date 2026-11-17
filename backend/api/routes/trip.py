"""api/routes/trip.py — POST /trip"""
import math
import os
from datetime import datetime, timezone

from fastapi import APIRouter

from api.models import TripDestination, TripRequest, TripResponse
from services.scoring import DISCLAIMER, get_live_score, best_hours_today

router = APIRouter()

INTEREST_CATEGORY_MAP: dict[str, list[str]] = {
    "historical":  ["historic", "museum", "place_of_worship", "attraction"],
    "beach":       ["beach", "beach_resort", "viewpoint"],
    "nature":      ["park", "nature_reserve", "viewpoint"],
    "food":        ["restaurant", "cafe", "marketplace"],
    "art":         ["gallery", "artwork", "theatre"],
    "shopping":    ["mall", "marketplace"],
    "spiritual":   ["place_of_worship", "shrine"],
}


def _haversine(la1, lo1, la2, lo2) -> float:
    R = 6371.0
    dlat = math.radians(la2 - la1)
    dlon = math.radians(lo2 - lo1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(la1)) * math.cos(math.radians(la2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _interest_score(category: str, interests: list[str]) -> int:
    if not interests:
        return 0
    cat = (category or "").lower()
    for interest in interests:
        mapped = INTEREST_CATEGORY_MAP.get(interest.lower(), [interest.lower()])
        if any(m in cat for m in mapped):
            return 1
    return 0


@router.post("/trip", response_model=TripResponse)
def plan_trip(req: TripRequest):
    from api.db import get_db

    db = get_db()
    rows = db.execute(
        "SELECT id,name,lat,lon,category,description FROM places"
    ).fetchall()

    user_lat, user_lon = req.lat, req.lon
    if (user_lat is None or user_lon is None) and req.location_name:
        from api.routes.safety import resolve_coordinates
        try:
            user_lat, user_lon, _ = resolve_coordinates(req.location_name, None, None)
        except Exception:
            pass

    destinations: list[TripDestination] = []

    for pid, name, plat, plon, cat, desc in rows:
        # Score
        res = get_live_score(plat, plon)

        # Distance from user
        dist_km = None
        if user_lat is not None and user_lon is not None:
            dist_km = round(_haversine(user_lat, user_lon, plat, plon), 2)

        # Live incidents nearby (last 24 h, radius 2 km)
        incidents_nearby = db.execute(
            """SELECT headline, incident_type, severity, timestamp, source_url, verified
               FROM incidents
               WHERE timestamp >= datetime('now', '-24 hours')
                 AND lat BETWEEN ? AND ?
                 AND lon BETWEEN ? AND ?""",
            (plat - 0.03, plat + 0.03, plon - 0.03, plon + 0.03),
        ).fetchall()
        live_incs = [
            {
                "headline": r[0], "type": r[1], "severity": r[2],
                "timestamp": r[3], "source_url": r[4],
                "verified": bool(r[5]),
            }
            for r in incidents_nearby[:3]
        ]

        # Best hours
        best_h: list[dict] = []
        try:
            best_h = best_hours_today(plat, plon)
        except Exception:
            pass

        destinations.append(TripDestination(
            id=pid, name=name, category=cat or "",
            lat=plat, lon=plon,
            score=res["score"], label=res["label"],
            top_reasons=res["explanation"][:3],
            live_incidents=live_incs,
            best_hours_today=best_h,
            distance_km=dist_km,
            description=(desc or "")[:200],
        ))

    # Sort
    if req.sort_by == "distance" and user_lat is not None:
        destinations.sort(key=lambda d: d.distance_km if d.distance_km is not None else 9999)
    elif req.sort_by == "interest":
        destinations.sort(
            key=lambda d: (-_interest_score(d.category, req.interests), -d.score)
        )
    else:  # safety (default)
        destinations.sort(key=lambda d: -d.score)

    return TripResponse(
        query_city=req.city,
        destinations=destinations,
        total=len(destinations),
        sorted_by=req.sort_by,
        generated_at=datetime.now(timezone.utc).isoformat(),
        disclaimer=DISCLAIMER,
    )
