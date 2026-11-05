"""
Build the per-area feature table for the Safety Score model from OpenStreetMap.
---------------------------------------------------------------------------
Output: cell_features.csv, one row per H3 cell with:
    cell_id, lat, lon, light_density, poi_density,
    dist_police_km, dist_hospital_km, past_incidents

Time-based features (hour, is_weekend, rain_mm) are added at prediction time.
"""
import json
import os
import sys
import time
from collections import Counter
from pathlib import Path

import h3
import numpy as np
import pandas as pd
import requests
from sklearn.neighbors import BallTree

# ------------------------------------------------------------------ CONFIG
# Load from env if available
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

PLACE       = os.getenv("REGION_NAME", "Ernakulam")
ADMIN_LEVEL = os.getenv("ADMIN_LEVEL", "5")
H3_RES      = int(os.getenv("H3_RES", "8"))

_DATA_DIR   = Path(__file__).resolve().parent
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
CACHE_FILE  = str(_DATA_DIR / "osm_cache.json")
INCIDENTS_CSV = str(_DATA_DIR / "incidents.csv")
OUT_CSV     = str(_DATA_DIR / "cell_features.csv")

QUERIES = {
    "police":   'nwr["amenity"="police"](area.a);',
    "hospital": 'nwr["amenity"="hospital"](area.a);',
    "lamps":    'node["highway"="street_lamp"](area.a);',
    "pois": (
        'nwr["shop"](area.a);'
        'nwr["amenity"~"restaurant|cafe|fast_food|bank|atm|pharmacy|marketplace"](area.a);'
        'nwr["tourism"](area.a);'
    ),
}


# ------------------------------------------------------------------ FETCH
def fetch(body: str) -> list:
    q = (
        f'[out:json][timeout:180];'
        f'area["name"="{PLACE}"]["boundary"="administrative"]["admin_level"="{ADMIN_LEVEL}"]->.a;'
        f'({body});out center;'
    )
    for attempt in range(3):
        try:
            r = requests.post(OVERPASS_URL, data={"data": q}, timeout=200)
            if r.ok:
                return r.json()["elements"]
            print(f"  Overpass HTTP {r.status_code}, retrying...")
        except Exception as exc:
            print(f"  Overpass error: {exc}, retrying...")
        time.sleep(10 * (attempt + 1))
    raise RuntimeError(
        "Overpass failed after 3 attempts. "
        "Check your internet connection or try again later."
    )


def load_osm() -> dict:
    if os.path.exists(CACHE_FILE):
        print(f"Using cached OSM data from {CACHE_FILE}")
        with open(CACHE_FILE) as f:
            return json.load(f)
    data = {}
    for name, body in QUERIES.items():
        print(f"Fetching {name} from Overpass ...")
        data[name] = fetch(body)
        print(f"  -> {len(data[name])} elements")
        time.sleep(2)
    with open(CACHE_FILE, "w") as f:
        json.dump(data, f)
    print(f"OSM data cached to {CACHE_FILE}")
    return data


def to_points(elements: list) -> list[tuple]:
    pts = []
    for e in elements:
        if "lat" in e:
            pts.append((float(e["lat"]), float(e["lon"])))
        elif "center" in e:
            pts.append((float(e["center"]["lat"]), float(e["center"]["lon"])))
    return pts


# ------------------------------------------------------------------ FEATURES
def count_per_cell(points: list[tuple]) -> Counter:
    return Counter(h3.latlng_to_cell(lat, lon, H3_RES) for lat, lon in points)


def nearest_km(points: list[tuple], centers: list[tuple]) -> np.ndarray:
    if not points:
        print("  WARNING: no points for distance feature — returning NaN")
        return np.full(len(centers), np.nan)
    tree = BallTree(np.radians(points), metric="haversine")
    d, _ = tree.query(np.radians(centers), k=1)
    return d[:, 0] * 6371.0


def build() -> pd.DataFrame:
    osm = load_osm()
    pts = {k: to_points(v) for k, v in osm.items()}
    print("Point counts:", {k: len(v) for k, v in pts.items()})

    # Study area = every cell containing at least one mapped feature
    cells: set = set()
    for p in pts.values():
        cells |= set(count_per_cell(p).keys())

    if not cells:
        raise RuntimeError(
            f"No H3 cells found for '{PLACE}'. "
            "Check PLACE / ADMIN_LEVEL in .env or the OSM cache."
        )

    df = pd.DataFrame({"cell_id": sorted(cells)})
    centers = [h3.cell_to_latlng(c) for c in df.cell_id]
    df["lat"] = [c[0] for c in centers]
    df["lon"] = [c[1] for c in centers]

    lamp_ct = count_per_cell(pts["lamps"])
    poi_ct  = count_per_cell(pts["pois"])
    df["light_density"] = df.cell_id.map(lamp_ct).fillna(0).rank(pct=True)
    df["poi_density"]   = df.cell_id.map(poi_ct).fillna(0).rank(pct=True)

    if len(pts["lamps"]) < 200:
        print(
            "WARNING: very few street lamps mapped in OSM for this area. "
            "light_density is unreliable — note this in your report."
        )

    df["dist_police_km"]   = nearest_km(pts["police"],   centers)
    df["dist_hospital_km"] = nearest_km(pts["hospital"], centers)

    # Fill NaN distances with regional max (worst-case)
    for col in ["dist_police_km", "dist_hospital_km"]:
        if df[col].isna().any():
            fill = df[col].max() if not df[col].isna().all() else 20.0
            df[col] = df[col].fillna(fill)
            print(f"  NaN in {col} filled with {fill:.2f} km")

    if os.path.exists(INCIDENTS_CSV):
        inc = pd.read_csv(INCIDENTS_CSV)
        if {"lat", "lon"}.issubset(inc.columns):
            inc_ct = count_per_cell(list(zip(inc.lat, inc.lon)))
            df["past_incidents"] = df.cell_id.map(inc_ct).fillna(0).astype(int)
            print(f"Loaded {len(inc)} past incidents from {INCIDENTS_CSV}")
        else:
            df["past_incidents"] = 0
            print(f"NOTE: {INCIDENTS_CSV} missing lat/lon columns; past_incidents = 0")
    else:
        df["past_incidents"] = 0
        print(
            f"NOTE: {INCIDENTS_CSV} not found. past_incidents set to 0. "
            "Add geocoded incidents (lat, lon) for better accuracy."
        )

    df.to_csv(OUT_CSV, index=False)
    print(f"Saved {len(df)} H3 cells -> {OUT_CSV}")
    return df


def generate_grid_features() -> pd.DataFrame:
    """Generate baseline features for the region's H3 cells without network calls."""
    south = float(os.getenv("REGION_BBOX_SOUTH", "9.8"))
    north = float(os.getenv("REGION_BBOX_NORTH", "10.2"))
    west  = float(os.getenv("REGION_BBOX_WEST", "76.1"))
    east  = float(os.getenv("REGION_BBOX_EAST", "76.5"))

    lats = np.linspace(south, north, 30)
    lons = np.linspace(west, east, 30)
    cells = set()
    for la in lats:
        for lo in lons:
            cells.add(h3.latlng_to_cell(la, lo, H3_RES))

    rng = np.random.default_rng(42)
    n = len(cells)
    df = pd.DataFrame({"cell_id": sorted(cells)})
    centers = [h3.cell_to_latlng(c) for c in df.cell_id]
    df["lat"] = [c[0] for c in centers]
    df["lon"] = [c[1] for c in centers]

    # Distance to Kochi center (9.9312, 76.2673)
    c_lat, c_lon = 9.9312, 76.2673
    dists = np.sqrt((df["lat"] - c_lat)**2 + (df["lon"] - c_lon)**2) * 111.0

    df["light_density"]    = np.clip(1.0 - (dists / 30.0) + rng.normal(0, 0.1, n), 0.05, 0.95)
    df["poi_density"]      = np.clip(1.0 - (dists / 25.0) + rng.normal(0, 0.1, n), 0.05, 0.95)
    df["dist_police_km"]   = np.clip(dists * 0.25 + rng.uniform(0.5, 3.0, n), 0.3, 12.0)
    df["dist_hospital_km"] = np.clip(dists * 0.30 + rng.uniform(0.5, 4.0, n), 0.5, 15.0)
    df["past_incidents"]   = rng.poisson(np.clip(5 - dists * 0.15, 0, 10))

    df.to_csv(OUT_CSV, index=False)
    print(f"Generated and saved baseline grid of {len(df)} H3 cells -> {OUT_CSV}")
    return df


# ------------------------------------------------------------------ LOOKUP
def load_cell_features() -> pd.DataFrame:
    """Load cell_features.csv; build or generate if it doesn't exist."""
    if not os.path.exists(OUT_CSV):
        try:
            print(f"{OUT_CSV} not found - attempting OSM build...")
            build()
        except Exception as exc:
            print(f"OSM build failed: {exc} - generating regional baseline grid...")
            generate_grid_features()
    df = pd.read_csv(OUT_CSV)
    return df


def features_for_point(
    df: pd.DataFrame,
    lat: float,
    lon: float,
    hour: int,
    is_weekend: int,
    rain_mm: float,
) -> dict | None:
    """Return the model-input dict for a GPS point, or None if outside study area."""
    cell = h3.latlng_to_cell(lat, lon, H3_RES)
    row = df[df.cell_id == cell]
    if row.empty:
        # Nearest-cell fallback: find the closest cell centre
        if df.empty:
            return None
        from sklearn.metrics.pairwise import haversine_distances
        centres = df[["lat", "lon"]].values
        q = np.radians([[lat, lon]])
        dists = haversine_distances(q, np.radians(centres))[0] * 6371
        nearest = df.iloc[dists.argmin()]
        r = nearest
        print(f"  Point ({lat:.4f},{lon:.4f}) outside study area — using nearest cell")
    else:
        r = row.iloc[0]

    return {
        "hour": hour,
        "is_weekend": is_weekend,
        "rain_mm": rain_mm,
        "light_density":    float(r.light_density),
        "poi_density":      float(r.poi_density),
        "dist_police_km":   float(r.dist_police_km),
        "dist_hospital_km": float(r.dist_hospital_km),
        "past_incidents":   int(r.past_incidents),
    }


if __name__ == "__main__":
    table = build()
    print(table.describe().round(2))
