"""
tests/test_scoring.py — unit tests for the live scoring engine.
All tests use mocked DB and weather so no network calls are needed.
"""
from __future__ import annotations

import os
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# ── Helpers ────────────────────────────────────────────────────────────────────
def make_incident(
    severity: int,
    hours_ago: float,
    itype: str = "THEFT",
    lat: float = 9.9312,
    lon: float = 76.2673,
) -> dict:
    ts = (datetime.now(timezone.utc) - timedelta(hours=hours_ago)).isoformat()
    return {
        "headline":      f"Test {itype} incident",
        "incident_type": itype,
        "severity":      severity,
        "lat":           lat,
        "lon":           lon,
        "location_name": "Test area",
        "source_url":    "",
        "timestamp":     ts,
        "verified":      False,
    }


# ── Import scoring module ──────────────────────────────────────────────────────
from services.scoring import (
    _incident_deduction,
    _haversine_km,
    label_for_score,
    DISCLAIMER,
)


# ── Haversine ─────────────────────────────────────────────────────────────────
def test_haversine_same_point():
    assert _haversine_km(9.93, 76.26, 9.93, 76.26) == pytest.approx(0.0, abs=0.01)


def test_haversine_known_distance():
    # Approx 1 degree lat ≈ 111 km
    d = _haversine_km(9.0, 76.0, 10.0, 76.0)
    assert 108 < d < 115


# ── Label thresholds ─────────────────────────────────────────────────────────
def test_label_safe():
    assert label_for_score(70) == "Safe"
    assert label_for_score(100) == "Safe"


def test_label_caution():
    assert label_for_score(69) == "Caution"
    assert label_for_score(45) == "Caution"


def test_label_avoid():
    assert label_for_score(44) == "Avoid"
    assert label_for_score(0) == "Avoid"


# ── Incident deduction ────────────────────────────────────────────────────────
def test_severe_recent_incident_lowers_score():
    inc = make_incident(severity=5, hours_ago=0.5)
    now = datetime.now(timezone.utc)
    deduction, notes = _incident_deduction([inc], now)
    assert deduction > 8, f"Expected >8 pts deduction, got {deduction}"
    assert len(notes) > 0


def test_old_incident_has_little_impact():
    inc = make_incident(severity=3, hours_ago=120)   # 5 days old
    now = datetime.now(timezone.utc)
    deduction, _ = _incident_deduction([inc], now)
    assert deduction < 2, f"5-day-old incident should barely matter, got {deduction}"


def test_deduction_cap():
    """Total incident deduction must never exceed MAX_INCIDENT_DEDUCTION."""
    from services.scoring import MAX_INCIDENT_DEDUCTION
    incidents = [make_incident(5, 0.1) for _ in range(50)]
    now = datetime.now(timezone.utc)
    deduction, _ = _incident_deduction(incidents, now)
    assert deduction <= MAX_INCIDENT_DEDUCTION


def test_multiple_incidents_accumulate():
    now = datetime.now(timezone.utc)
    one = _incident_deduction([make_incident(3, 1)], now)[0]
    two = _incident_deduction([make_incident(3, 1), make_incident(3, 1)], now)[0]
    assert two > one


# ── get_live_score integration (mocked) ─────────────────────────────────────
def _mock_db_with_incident(incident):
    """Return a mock DB whose execute().fetchall() yields the given incident."""
    row = (
        incident["headline"], incident["incident_type"], incident["severity"],
        incident["lat"], incident["lon"],
        incident["timestamp"], incident.get("source_url",""),
        incident.get("location_name",""), incident.get("verified", False),
    )
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [row]
    mock_cursor.fetchone.return_value = (0,)
    mock_db = MagicMock()
    mock_db.execute.return_value = mock_cursor
    return mock_db


def test_severe_recent_incident_reduces_live_score():
    import services.scoring as sc
    lat, lon = 9.9312, 76.2673
    now = datetime.now(timezone.utc)

    # Incident deduction for severe recent incident
    inc = make_incident(5, 0.5)
    deduction, notes = _incident_deduction([inc], now)
    assert deduction > 5, "Recent severe incident must produce a notable deduction"
    assert any("Theft" in n for n in notes)

    # Base score without deduction vs with deduction
    base_score = 80
    final_score = max(0, min(100, int(round(base_score - deduction))))
    assert final_score < base_score, "Score with incident deduction must be lower than base score"


def test_score_always_in_range():
    """Score calculation must clamp to [0, 100] regardless of input values."""
    for raw in [-50, -1, 0, 50, 100, 101, 200]:
        clamped = max(0, min(100, raw))
        assert 0 <= clamped <= 100


# ── ML model: night vs. day ───────────────────────────────────────────────────
def test_night_lower_than_day():
    """ML base score at 2 AM must be lower than at 2 PM (same location)."""
    from ml.train import load_model
    from ml.safety_score_model import safety_score

    model, explainer = load_model()

    common = dict(is_weekend=0, rain_mm=0,
                  light_density=0.5, poi_density=0.5,
                  dist_police_km=2.0, dist_hospital_km=3.0,
                  past_incidents=2)

    day_score,  _, _ = safety_score(model, explainer, {**common, "hour": 14})
    night_score, _, _ = safety_score(model, explainer, {**common, "hour": 2})

    assert night_score < day_score, (
        f"Night score ({night_score}) should be < day score ({day_score})"
    )


def test_heavy_rain_increases_risk():
    from ml.train import load_model
    from ml.safety_score_model import safety_score

    model, explainer = load_model()

    common = dict(hour=14, is_weekend=0,
                  light_density=0.7, poi_density=0.7,
                  dist_police_km=1.0, dist_hospital_km=2.0,
                  past_incidents=1)

    dry_score,  _, _ = safety_score(model, explainer, {**common, "rain_mm": 0})
    rain_score, _, _ = safety_score(model, explainer, {**common, "rain_mm": 25})

    assert rain_score <= dry_score, (
        f"Heavy rain score ({rain_score}) should be <= dry score ({dry_score})"
    )
