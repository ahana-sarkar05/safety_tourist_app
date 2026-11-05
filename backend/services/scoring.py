"""
services/scoring.py — Live safety score computation.

final_score = base_score − incident_deductions − weather_deductions
Clamped to [0, 100] and labelled Safe / Caution / Avoid.
"""
from __future__ import annotations

import logging
import math
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────
INCIDENT_RADIUS_KM = 2.0      # search radius for nearby incidents
INCIDENT_HALF_LIFE_H = 36.0   # decay half-life in hours
MAX_INCIDENT_DEDUCTION = 30   # cap total incident penalty
SEVERITY_WEIGHT = 2.5         # points per severity unit (before decay)

WEATHER_PENALTIES = {
    "Thunderstorm active":  8,
    "Heavy rain currently": 6,
    "Moderate rain":        3,
    "Heavy rain expected":  4,
    "Strong winds":         4,
}

PROTEST_PENALTY = 5           # for protest/hartal/curfew/riot incidents

LABEL_SAFE    = "Safe"
LABEL_CAUTION = "Caution"
LABEL_AVOID   = "Avoid"

DISCLAIMER = (
    "Safety scores are risk estimates from public data and news, "
    "not guarantees. Always exercise personal judgement."
)


# ── Haversine distance ────────────────────────────────────────────────────────
def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Incident deduction ────────────────────────────────────────────────────────
def _incident_deduction(incidents: list[dict], now: datetime) -> tuple[float, list[str]]:
    """
    Compute total deduction from nearby incidents with recency decay.
    Returns (deduction_points, explanation_strings).
    """
    total = 0.0
    notes: list[str] = []

    for inc in incidents:
        try:
            ts_str = inc.get("timestamp", "")
            if ts_str:
                ts = datetime.fromisoformat(str(ts_str).replace("Z", "+00:00"))
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                now_utc = now.astimezone(timezone.utc) if now.tzinfo else now.replace(tzinfo=timezone.utc)
                age_h = (now_utc - ts).total_seconds() / 3600
            else:
                age_h = 24.0

            age_h = max(0.0, age_h)
            decay = 0.5 ** (age_h / INCIDENT_HALF_LIFE_H)
            deduction = inc.get("severity", 1) * SEVERITY_WEIGHT * decay
            total += deduction

            age_label = (
                f"{int(age_h)}h ago" if age_h >= 1
                else f"{int(age_h * 60)}min ago"
            )
            loc = inc.get("location_name", "nearby")
            itype = inc.get("incident_type", "Incident")
            headline = inc.get("headline", "")[:60]
            msg = f"{itype.title()} reported {age_label} near {loc}"
            if headline:
                msg += f': "{headline}..."'
            notes.append(msg)
        except Exception as exc:
            logger.debug("Incident processing error: %s", exc)
            total += inc.get("severity", 1) * SEVERITY_WEIGHT * 0.1

    return min(total, MAX_INCIDENT_DEDUCTION), notes


# ── Main scoring function ─────────────────────────────────────────────────────
def get_live_score(
    lat: float,
    lon: float,
    dt: datetime | None = None,
    rain_mm: float | None = None,
    city: str = "",
) -> dict:
    """
    Compute the final live safety score for (lat, lon) at datetime dt.

    Returns a dict with:
      score, label, explanation, data_freshness, confidence, disclaimer
    """
    if dt is None:
        dt = datetime.now()

    explanation: list[str] = []
    data_issues: list[str] = []

    # ── 1. Base score from ML model ──────────────────────────────────────────
    base_score = 65       # fallback
    base_reasons: list[str] = []
    try:
        from ml.predictor import get_base_score
        base_score, base_reasons = get_base_score(lat, lon, dt, rain_mm=rain_mm, city=city)
        explanation.extend(base_reasons)
    except Exception as exc:
        logger.warning("Base score failed: %s — using fallback %d", exc, base_score)
        data_issues.append("ML model unavailable (using fallback score)")

    total_deduction = 0.0

    # ── 2. Live incident deduction ───────────────────────────────────────────
    try:
        from api.db import get_db
        db = get_db()
        # Fetch incidents within bounding box (quick pre-filter) and last 48 h
        rows = db.execute(
            """
            SELECT headline, incident_type, severity, lat, lon,
                   timestamp, source_url, location_name, verified
            FROM incidents
            WHERE timestamp >= datetime('now', '-48 hours')
              AND lat BETWEEN ? AND ?
              AND lon BETWEEN ? AND ?
            """,
            (lat - 0.05, lat + 0.05, lon - 0.05, lon + 0.05),
        ).fetchall()
        cols = ["headline","incident_type","severity","lat","lon",
                "timestamp","source_url","location_name","verified"]
        nearby = []
        for row in rows:
            inc = dict(zip(cols, row))
            if _haversine_km(lat, lon, inc["lat"], inc["lon"]) <= INCIDENT_RADIUS_KM:
                nearby.append(inc)

        if nearby:
            inc_deduct, inc_notes = _incident_deduction(nearby, dt)
            total_deduction += inc_deduct
            explanation.extend(inc_notes[:4])   # show up to 4 incident reasons

            # Extra penalty for active protests/hartals
            hot_types = {"PROTEST", "CURFEW", "RIOT"}
            if any(i["incident_type"] in hot_types for i in nearby):
                total_deduction += PROTEST_PENALTY
                explanation.append("Active protest / hartal / curfew in area")

    except Exception as exc:
        logger.warning("Incident DB query failed: %s", exc)
        data_issues.append("Incident data temporarily unavailable")

    # ── 3. Weather deductions ────────────────────────────────────────────────
    weather_warnings: list[str] = []
    try:
        from services.weather import get_weather_warnings
        weather_warnings = get_weather_warnings(lat, lon)
        for w in weather_warnings:
            for key, penalty in WEATHER_PENALTIES.items():
                if key in w:
                    total_deduction += penalty
                    break
            explanation.append(w)
    except Exception as exc:
        logger.warning("Weather check failed: %s", exc)
        data_issues.append("Weather data unavailable")

    # ── 4. Final score ───────────────────────────────────────────────────────
    final = int(round(max(0, min(100, base_score - total_deduction))))

    if final >= 70:
        label = LABEL_SAFE
    elif final >= 45:
        label = LABEL_CAUTION
    else:
        label = LABEL_AVOID

    if data_issues:
        explanation.extend([f"[!] {d}" for d in data_issues])

    # Confidence note
    confidence = "high" if not data_issues else ("medium" if len(data_issues) == 1 else "low")

    return {
        "score": final,
        "base_score": base_score,
        "label": label,
        "explanation": explanation,
        "weather_warnings": weather_warnings,
        "data_freshness": dt.isoformat(),
        "confidence": confidence,
        "disclaimer": DISCLAIMER,
    }


def label_for_score(score: int) -> str:
    if score >= 70: return LABEL_SAFE
    if score >= 45: return LABEL_CAUTION
    return LABEL_AVOID


def best_hours_today(lat: float, lon: float) -> list[dict]:
    """
    Return the 5 safest hours today based on ML model (no live modifiers).
    Each entry: {hour, score, label}
    """
    from ml.predictor import get_base_score
    now = datetime.now()
    results = []
    try:
        from services.weather import get_hourly_rain
        rain_list = get_hourly_rain(lat, lon, now.date())
    except Exception:
        rain_list = [0.0] * 24

    for h in range(24):
        dt_h = now.replace(hour=h, minute=0, second=0, microsecond=0)
        rain = rain_list[h] if h < len(rain_list) else 0.0
        try:
            score, _ = get_base_score(lat, lon, dt_h, rain_mm=rain)
        except Exception:
            score = 65
        results.append({"hour": h, "score": score, "label": label_for_score(score)})

    results.sort(key=lambda x: -x["score"])
    return results[:5]
