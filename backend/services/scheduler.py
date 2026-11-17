"""
services/scheduler.py — Background news refresh using APScheduler.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_scheduler = None
_last_refresh: datetime | None = None
_last_count: int = 0


def _refresh_news():
    global _last_refresh, _last_count
    logger.info("Scheduler: refreshing news …")
    try:
        from services.news import fetch_and_classify_news
        from api.db import save_incidents
        incidents = fetch_and_classify_news()
        if incidents:
            save_incidents(incidents)
            _last_count = len(incidents)
            logger.info("Scheduler: saved %d incidents", len(incidents))
        else:
            logger.info("Scheduler: no new incidents found")
        _last_refresh = datetime.now(timezone.utc)
    except Exception as exc:
        logger.error("Scheduler refresh failed: %s", exc)
        _last_refresh = datetime.now(timezone.utc)


def start_scheduler(interval_minutes: int = 20):
    global _scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        _scheduler = BackgroundScheduler(daemon=True)
        _scheduler.add_job(
            _refresh_news, "interval", minutes=interval_minutes,
            id="news_refresh", replace_existing=True,
        )
        _scheduler.start()
        logger.info("News scheduler started (every %d min)", interval_minutes)
        # Run once immediately in a separate thread to not block startup
        import threading
        threading.Thread(target=_refresh_news, daemon=True).start()
    except Exception as exc:
        logger.error("Scheduler start failed: %s", exc)


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def get_scheduler_status() -> dict:
    return {
        "running": _scheduler.running if _scheduler else False,
        "last_refresh": _last_refresh.isoformat() if _last_refresh else None,
        "last_incident_count": _last_count,
    }
