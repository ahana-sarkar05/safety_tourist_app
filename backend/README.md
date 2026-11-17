# 🛡️ Tourist Safety App — Safety Score & Live Incident Module

> Real-time safety scores and live incident feed for tourist destinations in **Ernakulam / Kochi, Kerala, India**.
> Built with FastAPI · LightGBM · SQLite · Leaflet.

---

## Table of Contents
1. [Features](#features)
2. [Architecture](#architecture)
3. [Install & Setup (Windows + VS Code)](#install--setup-windows--vs-code)
4. [Running the App](#running-the-app)
5. [API Reference](#api-reference)
6. [Demo Walkthrough](#demo-walkthrough)
7. [Configuration](#configuration)
8. [Limitations](#limitations-for-project-report)

---

## Features

| Feature | Description |
|---------|-------------|
| 🤖 ML Safety Score | LightGBM model trained on OSM + weather features; SHAP explanations |
| 🌦 Live Weather | Rain & storm data from Open-Meteo (free, no API key) |
| 📰 Live Incidents | GDELT + Google News RSS scraped every 20 min; keyword classifier |
| 🗺 Tourist Places | OSM tourism/historic places with Wikipedia summaries in SQLite |
| 📍 Trip Planner | Ranks all destinations by safety, interest, or distance |
| 🚨 Incident Feed | Map markers + side panel; source link for every incident |
| 📝 User Reports | POST /incidents/report — tourists submit unverified reports |
| 🔴 Color-coded Map | Green (Safe ≥70) / Yellow (Caution 45-69) / Red (Avoid <45) |

---

## Architecture

```
tourist_safety_app/
├── data/          build_cell_features.py  →  cell_features.csv
├── ml/            safety_score_model.py, train.py, predictor.py
├── services/      weather, news, geocoder, classifier, scoring, scheduler
├── api/           FastAPI app + routes (safety, places, trip, incidents, health)
├── frontend/      Single-page HTML + Leaflet map
└── tests/         pytest unit tests
```

---

## Install & Setup (Windows + VS Code)

### Prerequisites
- Python 3.12+ (Windows Store / python.org)
- Git (optional)
- VS Code with Python extension

### 1. Clone / extract the project
```powershell
cd C:\Users\YourName\Downloads
# If you have git:
# git clone <repo-url> tourist_safety_app
cd tourist_safety_app
```

### 2. Create a virtual environment
```powershell
python -m venv .venv
.venv\Scripts\activate
```

### 3. Install dependencies
```powershell
pip install -r requirements.txt
```

### 4. Configure environment
```powershell
copy .env.example .env
# Edit .env with Notepad or VS Code if needed
# The defaults work out of the box for Kochi
```

### 5. Train the ML model
```powershell
python -m ml.train
# Expected output:
#   Building synthetic training dataset …
#   Training LightGBM model …
#   Unseen-area test  MAE=0.0300  RMSE=0.0400
#   Saved safety_model.joblib and shap_explainer.joblib
```

### 6. (Optional) Build OSM cell features
This downloads data from OpenStreetMap — needs internet:
```powershell
python -m data.build_cell_features
# Takes 1-3 minutes; creates data/cell_features.csv
```

---

## Running the App

### Start the API server
```powershell
cd tourist_safety_app
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

On startup the app will:
1. Initialise SQLite database and seed places from OSM (or use fallback landmarks)
2. Load (or auto-train) the ML model
3. Start the 20-minute background news refresh

### Open the frontend
Navigate to **http://localhost:8000** in your browser.

The interactive API docs are at **http://localhost:8000/docs**.

### Run tests
```powershell
pytest tests/ -v
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | API status, model loaded, incident count |
| GET | `/safety-score?lat=&lon=` | Live safety score for any coordinates |
| GET | `/places?limit=50` | List tourist places |
| GET | `/places/safest?lat=&lon=&radius_km=10` | Ranked safe places near a point |
| POST | `/trip` | Trip plan: ranked destinations |
| GET | `/incidents?lat=&lon=&radius_km=5&hours=48` | Incident feed |
| POST | `/incidents/report` | Submit a user incident report |

### POST /trip — request body
```json
{
  "city": "Kochi",
  "interests": ["historical", "beach"],
  "sort_by": "safety",
  "lat": 9.9312,
  "lon": 76.2673
}
```

### POST /incidents/report — request body
```json
{
  "incident_type": "THEFT",
  "description": "Bag snatched near ferry terminal",
  "lat": 9.9668,
  "lon": 76.2420
}
```

---

## Demo Walkthrough

1. **Open** http://localhost:8000 → see the Leaflet map centred on Kochi.
2. **Safety Check tab** → click anywhere on the map (or type coordinates) → hit "Check Safety" → see score ring, colour label, and risk factors.
3. **Plan My Trip tab** → tick interests (e.g. Beach, Historical) → click "Find Destinations" → wait ~15s while all places are scored → see ranked cards with score rings.
4. **Click a destination card** → place detail overlay shows score, SHAP reasons, best hours today, and recent incidents.
5. **Live Incidents tab** → click "Refresh Feed" → see incident cards with type badges, source links, and map markers (coloured by severity).
6. **Report an incident** → click "+ Report Incident" → fill in type + description → submit → appears in feed as "Unverified".

---

## Configuration

All settings in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `REGION_NAME` | `Ernakulam` | OSM area name |
| `REGION_LAT/LON` | `9.9312 / 76.2673` | Map centre |
| `ADMIN_LEVEL` | `5` | OSM admin level (5=district in India) |
| `H3_RES` | `8` | H3 cell resolution (~0.7 km²) |
| `NEWS_REFRESH_MINUTES` | `20` | Background refresh interval |
| `NEWS_API_KEY` | _(empty)_ | Optional NewsAPI.org key |
| `NOMINATIM_USER_AGENT` | `TouristSafetyApp/1.0` | Required by OSM policy |
| `DB_PATH` | `data/places.db` | SQLite file location |

---

## Limitations (for Project Report)

### 1. Data Sparsity
OpenStreetMap coverage of street lamps and minor amenities in Kerala is incomplete.
`light_density` and `poi_density` may be zero for many cells, making them unreliable
predictors. District-level features (e.g., `past_incidents = 0` everywhere) further
reduce model resolution. Real crime data would significantly improve accuracy.

### 2. News Noise and False Positives
GDELT and Google News return articles for the entire Kerala region, not just the
Ernakulam district. Keyword-based classification produces false positives (e.g.,
a political "attack" classified as ASSAULT). Without a fine-tuned NLP model, noise
reduction relies solely on deduplication and the requirement for explicit safety keywords.
Each article is shown with its source URL so users can verify claims themselves.

### 3. Geocoding Errors and Resolution Mismatch
Nominatim free-text geocoding sometimes returns incorrect or imprecise coordinates
(e.g., a suburb instead of a specific street). H3 cells at resolution 8 (~0.7 km²)
are coarser than the actual incident location, so a reported incident at one end of
a cell affects the score for the entire cell. Increasing H3 resolution reduces this
effect but increases data sparsity.

### 4. Semi-Synthetic Training Data
The LightGBM model is trained on programmatically generated data (see `ml/safety_score_model.py`).
The risk function is a weighted linear combination of OSM features, not actual recorded
crime. Model output should be described as a "risk estimate derived from infrastructure
and environmental proxies", not a crime prediction.

### 5. API Rate Limits and Availability
All external APIs (Overpass, Nominatim, GDELT, Open-Meteo, Google News RSS) are free
public services with rate limits and occasional outages. The application implements
caching and exponential back-off, but cannot guarantee data freshness during extended
API unavailability. Each response includes a `data_freshness` timestamp so users
know when data was last updated.

### 6. Incident Deduplication is Approximate
Jaccard similarity on tokenised headlines is a heuristic. Two articles about the same
event may not be deduplicated if the wording differs substantially; two unrelated
articles may be mistakenly merged if they share many common words.

---

## Disclaimer
Safety scores are **risk estimates** derived from public infrastructure data and news
articles — they are **not guarantees of personal safety**. Users should always exercise
personal judgement, travel with companions when exploring unfamiliar areas at night,
and consult official advisories from local police or travel authorities.
