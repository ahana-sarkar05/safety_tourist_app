"""
api/main.py — FastAPI application entry point.

Start with:
    cd tourist_safety_app
    uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Load .env before anything else
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from api.routes import auth, chatbot, health, incidents, places, safety, trip

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ───────────────────────────────────────────────────────────────
    logger.info("=== Trevora starting up ===")

    # 1. Ensure DB schema + places
    from api.db import init_db
    init_db()

    # 2. Pre-load ML model (auto-trains if missing)
    try:
        from ml.predictor import _get_model_and_explainer
        _get_model_and_explainer()
        logger.info("ML model loaded")
    except Exception as exc:
        logger.error("ML model load failed: %s", exc)

    # 3. Start background news scheduler
    try:
        from services.scheduler import start_scheduler
        interval = int(os.getenv("NEWS_REFRESH_MINUTES", "20"))
        start_scheduler(interval_minutes=interval)
    except Exception as exc:
        logger.error("Scheduler start failed: %s", exc)

    logger.info("=== Startup complete — visit http://localhost:8000 ===")
    yield

    # ── SHUTDOWN ──────────────────────────────────────────────────────────────
    from services.scheduler import stop_scheduler
    stop_scheduler()
    from api.db import close_db
    close_db()
    logger.info("=== Trevora shut down ===")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Trevora API",
    description=(
        "Real-time safety scores and live incident feed for tourist destinations. "
        "Scores are risk estimates from public data — not guarantees of safety."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "*")],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,      tags=["auth"])
app.include_router(health.router,    tags=["health"])
app.include_router(safety.router,    tags=["safety"])
app.include_router(places.router,    tags=["places"])
app.include_router(trip.router,      tags=["trip"])
app.include_router(incidents.router, tags=["incidents"])
app.include_router(chatbot.router,   tags=["chatbot"])

# ── Serve frontend ────────────────────────────────────────────────────────────
_FRONTEND = Path(__file__).resolve().parents[1] / "frontend"

if _FRONTEND.exists():
    app.mount("/static", StaticFiles(directory=str(_FRONTEND)), name="static")

    @app.get("/", include_in_schema=False)
    def serve_frontend():
        return FileResponse(str(_FRONTEND / "index.html"))
