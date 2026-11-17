"""
services/weather.py — Live weather data from Open-Meteo (free, no API key).

Provides:
  get_current_rain(lat, lon) -> float  (mm/h)
  get_weather_warnings(lat, lon) -> list[str]
  get_hourly_rain(lat, lon, date) -> list[float]  (24 hours)
"""
from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta
from functools import lru_cache
from threading import Lock

import requests

logger = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
_CACHE: dict = {}
_CACHE_TTL = 900   # 15 minutes
_lock = Lock()


def _cache_key(*args):
    return str(args)


def _cached_get(url: str, params: dict, ttl: int = _CACHE_TTL) -> dict | None:
    key = _cache_key(url, sorted(params.items()))
    with _lock:
        entry = _CACHE.get(key)
        if entry and (time.time() - entry["ts"]) < ttl:
            return entry["data"]
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        with _lock:
            _CACHE[key] = {"data": data, "ts": time.time()}
        return data
    except Exception as exc:
        logger.warning("Open-Meteo request failed: %s", exc)
        return None


def get_current_rain(lat: float, lon: float) -> float:
    """Return current precipitation in mm/h (0.0 on failure)."""
    params = {
        "latitude": round(lat, 1),
        "longitude": round(lon, 1),
        "current": "precipitation,rain,weathercode",
        "timezone": "Asia/Kolkata",
    }
    data = _cached_get(OPEN_METEO_URL, params)
    if not data:
        return 0.0
    try:
        return float(data.get("current", {}).get("precipitation", 0.0))
    except Exception:
        return 0.0


def get_weather_warnings(lat: float, lon: float) -> list[str]:
    """
    Return a list of active weather warning strings.
    Based on WMO weather codes and precipitation thresholds.
    """
    params = {
        "latitude": round(lat, 1),
        "longitude": round(lon, 1),
        "current": "precipitation,weathercode,windspeed_10m,temperature_2m",
        "hourly": "precipitation,weathercode",
        "forecast_days": 1,
        "timezone": "Asia/Kolkata",
    }
    data = _cached_get(OPEN_METEO_URL, params)
    warnings: list[str] = []

    if not data:
        return warnings

    try:
        current  = data.get("current", {})
        rain_now = float(current.get("precipitation", 0))
        code     = int(current.get("weathercode", 0))
        wind_kph = float(current.get("windspeed_10m", 0))

        if rain_now > 10:
            warnings.append(f"Heavy rain currently ({rain_now:.1f} mm/h)")
        elif rain_now > 3:
            warnings.append(f"Moderate rain ({rain_now:.1f} mm/h)")

        if code in range(95, 100):   # thunderstorm codes
            warnings.append("Thunderstorm active")
        if wind_kph > 60:
            warnings.append(f"Strong winds ({wind_kph:.0f} km/h)")

        # Check next-6-hour total rain
        hourly = data.get("hourly", {})
        now_h  = datetime.now().hour
        future_rain = hourly.get("precipitation", [0] * 24)[now_h: now_h + 6]
        if sum(future_rain) > 20:
            warnings.append(f"Heavy rain expected in next 6 h ({sum(future_rain):.0f} mm)")

    except Exception as exc:
        logger.warning("Weather warning parse failed: %s", exc)

    return warnings


def get_hourly_rain(lat: float, lon: float, for_date: date | None = None) -> list[float]:
    """Return list of 24 hourly precipitation values (mm) for the given date."""
    if for_date is None:
        for_date = date.today()

    params = {
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "hourly": "precipitation",
        "start_date": str(for_date),
        "end_date":   str(for_date),
        "timezone": "Asia/Kolkata",
    }
    data = _cached_get(OPEN_METEO_URL, params, ttl=3600)
    if not data:
        return [0.0] * 24
    return data.get("hourly", {}).get("precipitation", [0.0] * 24)
