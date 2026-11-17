"""
api/models.py — Pydantic request/response schemas.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Safety Score ──────────────────────────────────────────────────────────────
class SafetyScoreResponse(BaseModel):
    place_name: Optional[str] = None
    lat: float
    lon: float
    score: int
    base_score: int
    label: str                       # "Safe" | "Caution" | "Avoid"
    explanation: list[str]
    weather_warnings: list[str] = []
    data_freshness: str
    confidence: str                  # "high" | "medium" | "low"
    disclaimer: str


# ── Places ────────────────────────────────────────────────────────────────────
class PlaceResponse(BaseModel):
    id: int
    name: str
    lat: float
    lon: float
    category: str
    description: str = ""
    score: Optional[int] = None
    label: Optional[str] = None
    top_reasons: list[str] = []
    distance_km: Optional[float] = None
    best_hours: list[dict] = []


# ── Trip ──────────────────────────────────────────────────────────────────────
class TripRequest(BaseModel):
    city: str = Field(default="Delhi")
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    interests: list[str] = Field(
        default=[],
        description="e.g. ['historical', 'beach', 'food', 'nature']",
    )
    location_name: Optional[str] = Field(None, description="User's current location name, e.g. 'Fort Kochi'")
    lat: Optional[float] = Field(None, description="User's current latitude")
    lon: Optional[float] = Field(None, description="User's current longitude")
    sort_by: str = Field(
        default="safety",
        description="Sort order: 'safety' | 'distance' | 'interest'",
    )


class TripDestination(BaseModel):
    id: int
    name: str
    category: str
    lat: float
    lon: float
    score: int
    label: str
    top_reasons: list[str]
    live_incidents: list[dict] = []
    best_hours_today: list[dict] = []
    distance_km: Optional[float] = None
    description: str = ""


class TripResponse(BaseModel):
    query_city: str
    destinations: list[TripDestination]
    total: int
    sorted_by: str
    generated_at: str
    disclaimer: str


# ── Incidents ─────────────────────────────────────────────────────────────────
class IncidentResponse(BaseModel):
    id: int
    headline: str
    incident_type: str
    severity: int
    lat: Optional[float]
    lon: Optional[float]
    location_name: str = ""
    source_url: str = ""
    source: str = ""
    timestamp: str
    verified: bool
    place_id: Optional[int] = None


class IncidentReportRequest(BaseModel):
    incident_type: str = Field(description="THEFT | ASSAULT | HARASSMENT | ACCIDENT | FLOOD | FIRE | SCAM | OTHER")
    description: str = Field(max_length=500)
    lat: float
    lon: float

    class Config:
        # No personal data stored
        json_schema_extra = {
            "example": {
                "incident_type": "THEFT",
                "description": "Bag snatched near ferry terminal",
                "lat": 9.9668,
                "lon": 76.2420,
            }
        }


# ── Health ────────────────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    region: str
    scheduler_running: bool
    last_news_refresh: Optional[str]
    last_incident_count: int
    model_loaded: bool
    places_count: int
    incidents_count: int
