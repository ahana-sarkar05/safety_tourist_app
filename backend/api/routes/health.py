"""api/routes/health.py — GET /health"""
import os
from fastapi import APIRouter
from api.models import HealthResponse

router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse)
def health():
    from api.db import get_db
    from services.scheduler import get_scheduler_status
    from ml.predictor import _model  # noqa: F401 — just check if loaded

    db = get_db()
    places_count   = db.execute("SELECT COUNT(*) FROM places").fetchone()[0]
    incidents_count = db.execute("SELECT COUNT(*) FROM incidents").fetchone()[0]
    sched = get_scheduler_status()

    from ml import predictor
    model_loaded = predictor._model is not None

    return HealthResponse(
        status="ok",
        region=os.getenv("REGION_DISPLAY", "Ernakulam / Kochi, Kerala"),
        scheduler_running=sched["running"],
        last_news_refresh=sched["last_refresh"],
        last_incident_count=sched["last_incident_count"],
        model_loaded=model_loaded,
        places_count=places_count,
        incidents_count=incidents_count,
    )
