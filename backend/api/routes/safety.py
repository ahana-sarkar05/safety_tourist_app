"""api/routes/safety.py — GET /safety-score, GET /places/safest, GET /cities"""
import math
import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from api.models import PlaceResponse, SafetyScoreResponse
from services.scoring import DISCLAIMER, get_live_score, label_for_score

router = APIRouter(prefix="/api")


def resolve_coordinates(
    place: Optional[str],
    lat: Optional[float],
    lon: Optional[float],
) -> tuple[float, float, Optional[str], str]:
    """
    Returns (lat, lon, display_name, city_key).
    city_key is used by the ML predictor to fetch city-specific OSM baselines.
    """
    if lat is not None and lon is not None:
        # Reverse-geocode city name for better ML features
        city_key = ""
        try:
            from services.geocoder import reverse_geocode
            info = reverse_geocode(lat, lon)
            city_key = (info.get("city") or info.get("town") or info.get("state") or "").lower()
        except Exception:
            pass
        return lat, lon, place, city_key

    if not place or not place.strip():
        raise HTTPException(
            status_code=400,
            detail="Please provide a place name (e.g. ?place=Kochi or ?place=Agra) or coordinates (lat, lon)",
        )

    p_clean = place.strip().lower()

    # 1. Try the city registry (all of India known cities + Nominatim)
    try:
        from services.city_registry import get_city_centre, KNOWN_INDIAN_CITIES
        if p_clean in KNOWN_INDIAN_CITIES:
            lat_c, lon_c, display = get_city_centre(p_clean)
            return lat_c, lon_c, display, p_clean
    except Exception:
        pass

    # 2. Try local places DB
    from api.db import get_db
    db = get_db()
    row = db.execute(
        "SELECT name, lat, lon FROM places WHERE LOWER(name) LIKE ? ORDER BY LENGTH(name) ASC LIMIT 1",
        (f"%{p_clean}%",),
    ).fetchone()
    if row:
        return float(row[1]), float(row[2]), str(row[0]), p_clean

    # 3. Nominatim geocoder (any landmark in India)
    from services.geocoder import geocode
    geo = geocode(place.strip())
    if geo:
        return float(geo["lat"]), float(geo["lon"]), str(geo.get("display_name", place)), p_clean

    # 4. Try city_registry Nominatim for unknown cities
    try:
        from services.city_registry import get_city_centre
        lat_c, lon_c, display = get_city_centre(place.strip())
        return lat_c, lon_c, display, p_clean
    except Exception:
        pass

    # 5. Fallback to India centre
    return 20.5937, 78.9629, place.strip(), ""


@router.get("/safety-score", response_model=SafetyScoreResponse)
def safety_score(
    place: Optional[str]  = Query(None, description="Any place in India: 'Fort Kochi', 'Agra', 'Taj Mahal', 'Munnar'"),
    lat:   Optional[float] = Query(None, description="Latitude"),
    lon:   Optional[float] = Query(None, description="Longitude"),
):
    resolved_lat, resolved_lon, resolved_name, city_key = resolve_coordinates(place, lat, lon)
    result = get_live_score(resolved_lat, resolved_lon, city=city_key)
    return SafetyScoreResponse(
        place_name=resolved_name,
        lat=resolved_lat,
        lon=resolved_lon,
        **{k: result[k] for k in
           ["score", "base_score", "label", "explanation",
            "weather_warnings", "data_freshness", "confidence", "disclaimer"]},
    )


@router.get("/cities", response_model=list[dict])
def list_supported_cities():
    """Returns all pre-cached Indian cities the backend knows about instantly."""
    from services.city_registry import KNOWN_INDIAN_CITIES
    return [
        {"city": k.title(), "lat": v[0], "lon": v[1]}
        for k, v in sorted(KNOWN_INDIAN_CITIES.items())
    ]


@router.get("/places/safest", response_model=list[PlaceResponse])
def safest_places(
    place:     Optional[str]   = Query(None, description="Reference city or place"),
    lat:       Optional[float] = Query(None),
    lon:       Optional[float] = Query(None),
    radius_km: float           = Query(15.0, description="Search radius in km"),
    limit:     int             = Query(20),
    city:      Optional[str]   = Query(None, description="Seed OSM places for this Indian city"),
):
    """Return the safest tourist places near a location. If 'city' is given and
    the DB is empty, places are seeded from OSM for that city on-demand."""
    ref_lat, ref_lon, _, city_key = resolve_coordinates(place, lat, lon)

    from api.db import get_db
    db = get_db()

    # On-demand OSM seeding for requested city
    if city:
        _seed_city_places(city, db)

    rows = db.execute("SELECT id,name,lat,lon,category,description FROM places").fetchall()

    def haversine(la1, lo1, la2, lo2):
        R = 6371.0
        dlat = math.radians(la2 - la1)
        dlon = math.radians(lo2 - lo1)
        a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(la1)) * math.cos(math.radians(la2)) * math.sin(dlon / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    results = []
    for row in rows:
        pid, name, plat, plon, cat, desc = row
        dist = haversine(ref_lat, ref_lon, plat, plon)
        if dist > radius_km:
            continue
        res = get_live_score(plat, plon, city=city_key)
        results.append(PlaceResponse(
            id=pid, name=name, lat=plat, lon=plon,
            category=cat or "", description=desc or "",
            score=res["score"], label=res["label"],
            top_reasons=res["explanation"][:3],
            distance_km=round(dist, 2),
        ))

    results.sort(key=lambda p: -(p.score or 0))
    return results[:limit]


def _seed_city_places(city: str, db) -> None:
    """Fetch tourist places from OSM for the given city and insert into DB."""
    from services.city_registry import get_city_centre
    import requests, logging
    logger = logging.getLogger(__name__)

    try:
        lat, lon, _ = get_city_centre(city)
        q = f"""
        [out:json][timeout:30];
        node["tourism"~"attraction|museum|viewpoint|hotel|hostel|information|artwork"](around:20000,{lat},{lon});
        out center 50;
        """
        r = requests.post("https://overpass-api.de/api/interpreter", data={"data": q}, timeout=35)
        if not r.ok:
            return
        elements = r.json().get("elements", [])
        inserted = 0
        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name") or tags.get("name:en", "")
            if not name:
                continue
            elat = el.get("lat") or el.get("center", {}).get("lat")
            elon = el.get("lon") or el.get("center", {}).get("lon")
            if not elat or not elon:
                continue
            try:
                db.execute(
                    "INSERT OR IGNORE INTO places(name,lat,lon,category,description,osm_id) VALUES(?,?,?,?,?,?)",
                    (name, elat, elon, tags.get("tourism", "attraction"),
                     tags.get("description", f"Tourist attraction in {city.title()}"),
                     str(el.get("id", ""))),
                )
                inserted += 1
            except Exception:
                pass
        db.commit()
        logger.info("Seeded %d OSM places for '%s'", inserted, city)
    except Exception as exc:
        logger.warning("On-demand OSM seeding failed for '%s': %s", city, exc)
