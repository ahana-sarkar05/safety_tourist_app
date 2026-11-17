# Tourist Safety App — "Safety Score & Live Incident" Module
## Build Plan

> **Region:** Ernakulam / Kochi, Kerala, India (configurable via `.env`)
> **Stack:** Python 3.12 · FastAPI · LightGBM · SQLite · Plain HTML/JS · Leaflet

---

## Phase Overview

| # | Phase | Key Deliverable | Status |
|---|-------|----------------|--------|
| 1 | Project scaffold & dependencies | Folder structure, `requirements.txt`, `.env.example` | ⬜ |
| 2 | ML pipeline (base score) | Trained model + SHAP explainer saved to `ml/` | ⬜ |
| 3 | Tourist places database | `places.db` — SQLite with OSM + Wikipedia | ⬜ |
| 4 | News / incident ingestion | Scheduler pulling GDELT + Google News RSS | ⬜ |
| 5 | Live safety score engine | `services/scoring.py` — composite final score | ⬜ |
| 6 | FastAPI backend | All 6 endpoints + `/docs` | ⬜ |
| 7 | Frontend | Leaflet map + trip planner UI | ⬜ |
| 8 | Tests | `pytest` test suite for scoring logic | ⬜ |
| 9 | README + Limitations | Setup guide (Windows/VSCode) + report section | ⬜ |

---

## File & Folder Structure

```
tourist_safety_app/
│
├── .env.example                  # Template: NEWS_API_KEY, REGION, etc.
├── .env                          # Real secrets (git-ignored)
├── README.md
├── PLAN.md                       # This file
├── requirements.txt
│
├── data/
│   ├── build_cell_features.py    # (REUSED – adapted from original)
│   ├── cell_features.csv         # Output of above (H3 cells × OSM features)
│   ├── places.db                 # SQLite: places + incidents tables
│   └── osm_cache.json            # Raw OSM cache (speeds re-runs)
│
├── ml/
│   ├── safety_score_model.py     # (REUSED – adapted from original)
│   ├── train.py                  # CLI runner: trains & saves model
│   ├── safety_model.joblib       # Trained LightGBM model
│   ├── shap_explainer.joblib     # SHAP TreeExplainer (serialised)
│   └── predictor.py              # get_base_score(lat, lon, dt) -> score, reasons
│
├── services/
│   ├── weather.py                # Open-Meteo: rain_mm + warnings (cached)
│   ├── news.py                   # GDELT + Google News RSS + optional NewsAPI
│   ├── geocoder.py               # Nominatim wrapper (cached, rate-limited)
│   ├── classifier.py             # Keyword -> incident_type + severity (1-5)
│   ├── scoring.py                # final_score = base + live modifiers
│   └── scheduler.py              # APScheduler: refresh news every 20 min
│
├── api/
│   ├── main.py                   # FastAPI app, startup events, router mounts
│   ├── routes/
│   │   ├── safety.py             # GET /safety-score, GET /places/safest
│   │   ├── places.py             # GET /places (list / filter)
│   │   ├── trip.py               # POST /trip
│   │   ├── incidents.py          # GET /incidents, POST /incidents/report
│   │   └── health.py             # GET /health
│   ├── models.py                 # Pydantic request/response schemas
│   └── db.py                     # SQLite connection + init_db()
│
├── frontend/
│   ├── index.html                # Single-page app (plain HTML/JS + Leaflet)
│   ├── app.js                    # Map init, API calls, UI logic
│   └── style.css
│
└── tests/
    ├── test_scoring.py           # Unit tests: score adjustments
    ├── test_classifier.py        # Incident keyword classification
    └── conftest.py               # Fixtures
```

---

## Detailed Steps

### Step 1 — Project Scaffold
- Create all directories
- Write `requirements.txt` (fastapi, uvicorn, lightgbm, shap, h3, requests, httpx,
  apscheduler, feedparser, python-dotenv, geopy, wikipedia-api, pytest, etc.)
- Write `.env.example`
- Copy/adapt existing `safety_score_model.py` and `build_cell_features.py` into the new structure

### Step 2 — ML Pipeline
- `ml/train.py`: import existing `safety_score_model.py`, run `build_dataset()` → `train()`,
  save `safety_model.joblib` and `shap_explainer.joblib`
- `ml/predictor.py`: `get_base_score(lat, lon, dt)` that:
  1. Calls `features_for_point()` from `build_cell_features.py`
  2. Fetches live `rain_mm` from `services/weather.py`
  3. Runs the LightGBM model
  4. Returns `(score: int, reasons: list[str])`
- Run the training pipeline; verify `.joblib` files exist

### Step 3 — Tourist Places Database
- `api/db.py` creates SQLite tables:
  ```sql
  CREATE TABLE places (id, name, lat, lon, category, description, h3_cell, wikidata_id)
  CREATE TABLE incidents (id, place_id, headline, incident_type, severity, lat, lon,
                          source_url, timestamp, source, verified, raw_text)
  ```
- Overpass query (tourism, historic) → insert places rows with H3 cell
- Wikipedia-API fetch for `description`
- Join to `cell_features.csv` via `h3_cell`

### Step 4 — News / Incident Ingestion
- `services/news.py`:
  - GDELT DOC API (free, no key)
  - Google News RSS
  - Optional: NewsAPI (`NEWS_API_KEY` from `.env`)
  - Search terms: theft, robbery, assault, hartal, flood, landslide, fire, etc.
- `services/classifier.py`:
  - Keyword rules → `incident_type`
  - Severity heuristic (1–5)
  - Deduplication by headline similarity
- `services/geocoder.py`:
  - Nominatim with SQLite cache + rate limiting
- `services/scheduler.py`: APScheduler, every 20 min refresh

### Step 5 — Live Safety Score Engine
- `services/scoring.py` — `get_live_score(lat, lon, dt)`:
  - base_score from ML predictor
  - Deductions from recent incidents (recency decay, half-life 36h)
  - Weather penalty (heavy rain, storm)
  - Event penalty (protests, strikes, curfews)
  - Clamp to [0, 100]; return label + explanation list

### Step 6 — FastAPI Backend
| Method | Path | Description |
|--------|------|-------------|
| GET | `/safety-score` | `?lat=&lon=` → score, label, reasons, freshness |
| GET | `/places/safest` | `?lat=&lon=&radius_km=` → ranked places |
| POST | `/trip` | body: city, dates, interests, location → ranked destinations |
| GET | `/incidents` | `?place_id=` or `?lat=&lon=&radius_km=&hours=48` |
| POST | `/incidents/report` | User-reported incident (unverified flag) |
| GET | `/health` | Status, last refresh time |

### Step 7 — Frontend
Single-page `frontend/index.html`:
- Leaflet map centered on Kochi
- Color-coded markers (green/yellow/red) by safety label
- Sidebar: Safety Check, Plan My Trip, Live Incidents
- Place popup: score, reasons, incidents
- Disclaimer banner

### Step 8 — Tests
- `test_severe_recent_incident_lowers_score()`
- `test_old_incident_has_little_impact()`
- `test_night_lower_than_day()`
- `test_heavy_rain_lowers_score()`
- `test_clamp_0_100()`
- `test_label_boundaries()`

### Step 9 — README + Limitations
- Windows/VSCode install steps
- How to run training, API, and open frontend
- Demo walkthrough
- Limitations section for project report

---

## Data Flow

```
User (browser)
    │
    ▼
Frontend (Leaflet map + forms)
    │  REST calls
    ▼
FastAPI backend
    ├── GET /safety-score ──► scoring.py
    │                           ├── ml/predictor.py
    │                           │     ├── cell_features.csv
    │                           │     └── safety_model.joblib
    │                           ├── services/weather.py (Open-Meteo)
    │                           └── services/incidents DB (places.db)
    │
    ├── POST /trip ──────────► all places → score each
    ├── GET /incidents ──────► places.db incidents table
    └── POST /incidents/report► write to DB (unverified)

Background Scheduler (every 20 min)
    └── services/news.py
          ├── GDELT DOC API
          ├── Google News RSS
          └── NewsAPI (optional)
              │
              ▼
          classifier.py → geocoder.py → places.db
```

---

## Acceptance Criteria

- [ ] `uvicorn api.main:app` starts without errors
- [ ] `GET /health` returns `200 OK`
- [ ] `GET /safety-score?lat=9.9312&lon=76.2673` returns a valid score
- [ ] `POST /trip` returns at least one destination with score + label
- [ ] `GET /incidents` returns incident list
- [ ] Frontend opens in browser, shows map with colored markers
- [ ] `pytest tests/` — all tests pass
- [ ] No hardcoded API keys anywhere in source files

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Overpass API timeout | Cache to `osm_cache.json`; retry 3× with backoff |
| GDELT / Google News no results | Fall back to base score; log warning |
| Nominatim rate limit | SQLite geocoding cache + `time.sleep(1)` |
| Wikipedia fetch fails | `try/except`; store empty string |
| Model not trained yet | Auto-train on startup if `.joblib` missing |
| `cell_features.csv` not built | Auto-run `build_cell_features.py` or warn clearly |
