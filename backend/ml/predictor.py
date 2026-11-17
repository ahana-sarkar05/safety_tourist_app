"""
ml/predictor.py — get_base_score(lat, lon, dt) -> (score, reasons)

Wraps the trained LightGBM model with:
  - H3 cell feature lookup from cell_features.csv
  - Live rain_mm from Open-Meteo via services/weather.py
"""
from __future__ import annotations

import logging
from datetime import datetime
from functools import lru_cache

import numpy as np
import pandas as pd

from ml.safety_score_model import FEATURES, REASONS, safety_score
from ml.train import load_model

logger = logging.getLogger(__name__)

# ── Lazy-loaded singletons ─────────────────────────────────────────────────
_model    = None
_explainer = None
_cell_df  : pd.DataFrame | None = None


def _get_model_and_explainer():
    global _model, _explainer
    if _model is None:
        _model, _explainer = load_model()
    return _model, _explainer


def _get_cell_df() -> pd.DataFrame:
    global _cell_df
    if _cell_df is None:
        from data.build_cell_features import load_cell_features
        _cell_df = load_cell_features()
        logger.info("Loaded cell_features: %d cells", len(_cell_df))
    return _cell_df


# ── Main public function ───────────────────────────────────────────────────
def get_base_score(
    lat: float,
    lon: float,
    dt: datetime | None = None,
    rain_mm: float | None = None,
    city: str = "",
) -> tuple[int, list[str]]:
    """
    Compute the ML-based (static + time) safety score for a GPS point.

    Parameters
    ----------
    lat, lon : float   GPS coordinates
    dt       : datetime  Point in time (defaults to now)
    rain_mm  : float | None  Override rain; if None, fetches from Open-Meteo

    Returns
    -------
    score   : int   0-100  (higher = safer)
    reasons : list[str]  human-readable risk factors
    """
    if dt is None:
        dt = datetime.now()

    hour       = dt.hour
    is_weekend = int(dt.weekday() >= 5)   # Sat=5, Sun=6

    # Fetch rain if not provided
    if rain_mm is None:
        try:
            from services.weather import get_current_rain
            rain_mm = get_current_rain(lat, lon)
        except Exception as exc:
            logger.warning("Weather fetch failed: %s — using rain_mm=0", exc)
            rain_mm = 0.0

    # Look up cell features
    df = _get_cell_df()
    from data.build_cell_features import features_for_point
    feat = features_for_point(df, lat, lon, hour, is_weekend, rain_mm)

    if feat is None:
        logger.warning("No cell features for (%.4f, %.4f) — using city baseline for '%s'", lat, lon, city)
        feat = _default_features(hour, is_weekend, rain_mm, city=city, lat=lat, lon=lon)

    model, explainer = _get_model_and_explainer()
    score, _, reasons = safety_score(model, explainer, feat)
    return score, reasons


def _default_features(
    hour: int,
    is_weekend: int,
    rain_mm: float,
    city: str = "",
    lat: float = 20.5937,
    lon: float = 78.9629,
) -> dict:
    """
    Fallback feature vector when the point is off the H3 grid (any city in India).
    If city is known, fetch its real police/hospital baseline from city_registry.
    """
    dist_police_km   = 3.0
    dist_hospital_km = 4.0

    if city:
        try:
            from services.city_registry import get_city_safety_baseline
            baseline = get_city_safety_baseline(city, lat, lon)
            dist_police_km   = baseline.get("avg_dist_police_km",   3.0)
            dist_hospital_km = baseline.get("avg_dist_hospital_km", 4.0)
        except Exception as exc:
            logger.debug("City baseline lookup failed for '%s': %s", city, exc)

    return {
        "hour": hour, "is_weekend": is_weekend, "rain_mm": rain_mm,
        "light_density": 0.5, "poi_density": 0.5,
        "dist_police_km":   dist_police_km,
        "dist_hospital_km": dist_hospital_km,
        "past_incidents": 2,
    }
