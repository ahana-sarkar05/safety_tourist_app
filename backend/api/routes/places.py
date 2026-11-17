"""api/routes/places.py — GET /places"""
import math
from typing import Optional

from fastapi import APIRouter, Query

from api.models import PlaceResponse

router = APIRouter(prefix="/api")


@router.get("/places", response_model=list[PlaceResponse])
def list_places(
    category: Optional[str] = Query(None),
    limit: int = Query(50),
):
    from api.db import get_db
    db = get_db()

    if category:
        rows = db.execute(
            "SELECT id,name,lat,lon,category,description FROM places WHERE category=? LIMIT ?",
            (category, limit),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT id,name,lat,lon,category,description FROM places LIMIT ?",
            (limit,),
        ).fetchall()

    return [
        PlaceResponse(id=r[0], name=r[1], lat=r[2], lon=r[3],
                      category=r[4] or "", description=r[5] or "")
        for r in rows
    ]
