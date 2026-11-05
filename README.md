# 🛡️ Tourist Safety App

A full-stack tourist safety platform featuring real-time ML-driven safety scores, live incident ingestion, safe point navigation, and trip destination rankings.

---

## 🏗️ Repository Architecture

This repository is structured as a monorepo containing both the mobile client and the safety intelligence backend:

```
safety_tourist_app/
│
├── mobile/                   # React Native & Expo Mobile Application
│   ├── src/
│   │   ├── app/              # Expo Router screens (Tabs: Map, Safety, Assistant, Profile)
│   │   ├── components/       # UI components (SOS card, Navigation panel, Safety cards)
│   │   └── utils/
│   │       ├── safety-api.ts # API client connecting mobile to backend service
│   │       └── ...
│   ├── package.json
│   └── app.json
│
├── backend/                  # FastAPI & LightGBM Safety Score & Live Incident Service
│   ├── api/                  # FastAPI routes (safety-score, places, trip, incidents, health)
│   ├── ml/                   # LightGBM & HistGB model + SHAP explanations
│   ├── services/             # Live weather (Open-Meteo), news scraper (GDELT, RSS), geocoder
│   ├── data/                 # H3 resolution-8 cell features & SQLite places/incidents database
│   ├── frontend/             # Leaflet web dashboard
│   ├── tests/                # pytest unit tests (22 test cases)
│   ├── requirements.txt
│   ├── .env.example
│   └── run.bat               # Windows quick-launch runner script
│
└── README.md
```

---

## 🚀 Getting Started

### 1. Running the Backend Service

#### Prerequisites:
- Python 3.12+ (or 3.13)

#### Setup & Launch:
```powershell
cd backend

# Create virtual environment
python -m venv .venv
.\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the API server
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```
*(Or simply double-click `backend\run.bat` on Windows)*.

- **Web Dashboard**: [http://localhost:8000](http://localhost:8000)
- **Interactive OpenAPI Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

### 2. Running the Mobile Application

#### Prerequisites:
- Node.js 18+
- Expo Go on physical device or Android/iOS Emulator

#### Setup & Launch:
```bash
cd mobile

# Install dependencies
npm install

# Start the Expo development server
npx expo start
```

#### Connecting Mobile App to Local Backend:
Set `EXPO_PUBLIC_API_URL` in `mobile/.env`:
- **Android Emulator**: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000`
- **Physical Device (LAN)**: `EXPO_PUBLIC_API_URL=http://<YOUR_PC_LAN_IP>:8000`
- **iOS Simulator / Web**: `EXPO_PUBLIC_API_URL=http://localhost:8000`

---

## 🧪 Testing the Backend

From the `backend/` directory:
```powershell
pytest tests/ -v
```
All 22 unit tests test:
- ML base score features (lighting density, police distance, hospital distance)
- Time-of-day penalty (night risk vs. daytime)
- 36-hour half-life incident decay weighting
- Weather warning deductions
- Destination name geocoding and search resolution
