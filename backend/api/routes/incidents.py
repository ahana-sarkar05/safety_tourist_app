"""api/routes/incidents.py — GET /incidents and POST /incidents/report"""
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from api.models import IncidentReportRequest, IncidentResponse
from services.classifier import classify

router = APIRouter()

VALID_TYPES = {
    "THEFT", "ASSAULT", "HARASSMENT", "ACCIDENT",
    "FLOOD", "LANDSLIDE", "FIRE", "PROTEST", "SCAM",
    "CURFEW", "RIOT", "OTHER",
}


@router.get("/incidents", response_model=list[IncidentResponse])
def get_incidents(
    place_id:  Optional[int]   = Query(None),
    lat:       Optional[float] = Query(None),
    lon:       Optional[float] = Query(None),
    radius_km: float           = Query(5.0),
    hours:     int             = Query(48),
    limit:     int             = Query(50),
):
    from api.db import get_db
    import math

    db = get_db()

    if place_id is not None:
        # Get place coords
        row = db.execute("SELECT lat,lon FROM places WHERE id=?", (place_id,)).fetchone()
        if not row:
            raise HTTPException(404, f"Place {place_id} not found")
        lat, lon = row[0], row[1]

    if lat is None or lon is None:
        # Return all recent incidents region-wide
        rows = db.execute(
            """SELECT id, place_id, headline, incident_type, severity,
                      lat, lon, location_name, source_url, source,
                      timestamp, verified
               FROM incidents
               WHERE timestamp >= datetime('now', ? || ' hours')
               ORDER BY timestamp DESC LIMIT ?""",
            (f"-{hours}", limit),
        ).fetchall()
    else:
        # Bounding box pre-filter then exact haversine
        deg = radius_km / 111.0
        rows = db.execute(
            """SELECT id, place_id, headline, incident_type, severity,
                      lat, lon, location_name, source_url, source,
                      timestamp, verified
               FROM incidents
               WHERE timestamp >= datetime('now', ? || ' hours')
                 AND lat BETWEEN ? AND ?
                 AND lon BETWEEN ? AND ?
               ORDER BY timestamp DESC LIMIT ?""",
            (f"-{hours}", lat - deg, lat + deg, lon - deg, lon + deg, limit * 2),
        ).fetchall()

        def hav(la1, lo1, la2, lo2):
            R = 6371.0
            dlat = math.radians(la2 - la1)
            dlon = math.radians(lo2 - lo1)
            a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(la1)) * math.cos(math.radians(la2)) * math.sin(dlon / 2) ** 2
            return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        rows = [r for r in rows if r[5] and r[6] and hav(lat, lon, r[5], r[6]) <= radius_km]
        rows = rows[:limit]

    return [
        IncidentResponse(
            id=r[0], place_id=r[1], headline=r[2],
            incident_type=r[3], severity=r[4],
            lat=r[5], lon=r[6], location_name=r[7] or "",
            source_url=r[8] or "", source=r[9] or "",
            timestamp=r[10] or "", verified=bool(r[11]),
        )
        for r in rows
    ]


@router.post("/incidents/report", status_code=201)
def report_incident(body: IncidentReportRequest):
    """
    Allow tourists to submit their own incident reports.
    Stored as unverified. No personal data is collected.
    """
    from api.db import get_db, save_incidents

    itype = body.incident_type.upper()
    if itype not in VALID_TYPES:
        raise HTTPException(400, f"incident_type must be one of {sorted(VALID_TYPES)}")

    _, severity = classify(body.description)
    severity = max(severity, 1)

    inc = {
        "headline":      f"[User report] {itype}: {body.description[:100]}",
        "incident_type": itype,
        "severity":      severity,
        "lat":           body.lat,
        "lon":           body.lon,
        "location_name": os.getenv("REGION_DISPLAY", "Kochi"),
        "source_url":    "",
        "source":        "User report (unverified)",
        "timestamp":     datetime.now(timezone.utc).isoformat(),
        "verified":      False,
        "raw_text":      body.description[:500],
    }
    save_incidents([inc])
    return {"status": "received", "message": "Thank you. Your report has been logged as unverified."}
