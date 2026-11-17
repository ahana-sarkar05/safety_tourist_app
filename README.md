# 🌍 Trevora — Smart Tourist Safety & Travel Intelligence System

> **A comprehensive AI and Web3 powered tourist safety, navigation, and emergency management ecosystem for Pan-India travel.**
> Integrates **React Native (Expo)**, **FastAPI**, **LightGBM Machine Learning with SHAP Explainability**, **W3C Decentralized Identity (DID)**, and **Consortium Blockchain Ledger Verification**.

---

## 📑 Table of Contents
1. [Overview & Refined System Architecture](#-overview--refined-system-architecture)
2. [Integrated Core Features](#-integrated-core-features)
3. [User Experience & 5-Tab Navigation](#-user-experience--5-tab-navigation)
4. [AI & Machine Learning Engine](#-ai--machine-learning-engine)
5. [Blockchain Tourist Identity & Cryptographic Records](#-blockchain-tourist-identity--cryptographic-records)
6. [Emergency Management & Live SOS](#-emergency-management--live-sos)
7. [Quick Start & Running the Project](#-quick-start--running-the-project)
8. [Step-by-Step Evaluator & Submission Walkthrough](#-step-by-step-evaluator--submission-walkthrough)
9. [Project Directory Structure](#-project-directory-structure)

---

## 💡 Overview & Refined System Architecture

**Trevora** provides tourists with end-to-end security, navigation, emergency preparedness, and decentralized identity management across all of India. All previously disconnected modules have been unified into a single, cohesive, production-ready system:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   EXPO MOBILE CLIENT (React Native)                    │
│      Home  •  Live Map  •  Safety Radar  •  Assistant  •  Tourist ID    │
└───────────────────▲──────────────────────────────▲─────────────────────┘
                    │ REST API / JSON              │ WebSocket / HTTP
                    ▼                              ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       FASTAPI BACKEND SERVICE        │  │     BLOCKCHAIN & TRACKER     │
│  • ML Safety Score (LightGBM + SHAP) │  │  • W3C DID & SHA-256 Anchors │
│  • SafeTrip Buddy AI Assistant       │  │  • Tamper-Proof Record Ledger │
│  • 70+ Pan-India City Registry       │  │  • Emergency Medical Directives│
│  • Live Incidents & Weather Hazards  │  │  • In-App Consortium Explorer │
│  • Dynamic Safe Itinerary Engine     │  │  • Live SOS Location Sharing │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

---

## 🎯 Integrated Core Features

| # | Feature | Technical Implementation | Tourist Benefit |
|---|---------|--------------------------|-----------------|
| 1 | **Live Safety Score & Radar** | LightGBM regression model with SHAP explanations | Know real-time safety scores (0–100) and why before visiting |
| 2 | **SafeTrip Buddy AI Assistant** | Unified FastAPI AI assistant with Gemini + local expert engine | 24/7 intelligent advice for attractions, scams, and itineraries |
| 3 | **Interactive Map & Safe Routes** | Turn-by-turn navigation, geofenced caution zones, OSM safe points | Avoid hazardous areas; find nearby police, hospitals, and pharmacies |
| 4 | **Digital Tourist ID & W3C DID** | Holographic passport card with 25x25 QR Matrix pass | Immutable, non-forgeable tourist credential for checkpoints & hotels |
| 5 | **Cryptographic Tamper Simulator** | SHA-256 hash avalanche stress-test | Instant demonstration of cryptographic ledger security |
| 6 | **Travel Permits Ledger** | On-chain permit anchoring and block mining | Verified permits for eco-zones, heritage sites, and travel insurance |
| 7 | **Emergency Medical Directive** | Cryptographically sealed medical profile (blood group, allergies) | Gives rescue workers and paramedics verified medical facts |
| 8 | **One-Tap SOS & Live Location** | Multi-channel distress dispatch + SMS coordinate sharing | Broadcasts real-time breadcrumbs to trusted contacts and police (112) |
| 9 | **Smart Dynamic Itinerary** | Budget, duration, and safety-optimized trip planning | Generates day-by-day schedules sorted by safety or interest |
| 10| **1-Click Demo Sign-In** | Instant authenticated session initialization | Effortless zero-friction evaluation for project review |

---

## 📱 User Experience & 5-Tab Navigation

The mobile application features an intuitive, floating tab bar providing instant access to all core sections:

1. 🏠 **Home**: Greeting, real-time safety status badge, India Safety Radar banner, SOS dispatch card, live location sharing pill, and itinerary progress overview.
2. 🗺️ **Map**: GPS positioning, restricted zone geofences, hospital/police/pharmacy filters, save safe point, and turn-by-turn safe navigation.
3. 🛡️ **Safety**: Live safety scores for 70+ Indian cities and major monuments (Taj Mahal, Fort Kochi, India Gate, Gateway of India, Jaipur, Hampi), SHAP feature contributions ("Why this score?"), live weather alerts, recent incidents feed, and crowdsourced incident reporting.
4. 🤖 **Assistant**: SafeTrip Buddy conversational assistant answering queries about places, night safety, transport, scams, and emergency numbers with GPS location context.
5. 🪪 **Tourist ID**: Complete Web3 & blockchain identity hub containing the holographic card, real-time SHA-256 verification panel, tamper test simulator, travel records & permits ledger, emergency medical directive, and consortium block explorer.

---

## 🧠 AI & Machine Learning Engine

* **Model**: Gradient-boosted regression trained on OpenStreetMap infrastructure density, road lighting, and real-time environmental factors.
* **Explainability (SHAP)**: Every score provides positive and negative feature attributions (e.g. `+14 pts: Tourist Police Booth within 250m`, `-8 pts: High coastal swell advisory`).
* **Pan-India Coverage**: Pre-configured registry for 70+ Indian cities and tourist destinations with on-demand Nominatim geocoding and caching.
* **Hazard Alerts**: Open-Meteo weather integration for rain, storm, and wind alerts.

---

## ⛓️ Blockchain Tourist Identity & Cryptographic Records

* **Zero-Knowledge Privacy Architecture**:
  * Off-chain personal data (passport number, contact details, medical history) resides strictly on the tourist's device.
  * Only deterministic SHA-256 commitments and issuance metadata are anchored on the blockchain.
* **Interactive Tamper Stress-Test Simulator**:
  * Tap **"Test Tamper Alert"** in the Tourist ID tab: modifies 1 character of off-chain data.
  * Real-time verification immediately flips to **`🚨 TAMPER DETECTED`**, demonstrating how ledger verification prevents credential forgery.
  * Tap **"Restore Clean ID"** to reset back to authentic status.
* **Permit Anchoring & Mining**:
  * Tap **"+ Anchor New"** to sign and mine new travel permits into newly mined blocks on the consortium ledger.
* **In-App Block Explorer**:
  * Inspect Genesis Block `#0`, Block `#1041`, block hashes, Merkle roots, and verified transactions (`IDENTITY_MINT`, `RECORD_ANCHOR`, `EMERGENCY_DIRECTIVE`).

---

## 🚀 Quick Start & Running the Project

### Prerequisites
* **Node.js** (v18 or later)
* **Python** (v3.10 or later)
* **npm**

### Option A: One-Click Launch (Recommended)
Double-click `run-app.bat` or run the PowerShell launcher:
```powershell
.\run-app.ps1
```
This automatically launches:
1. The **FastAPI Safety & AI Assistant Backend** on `http://localhost:8000`
2. The **Expo Mobile Client** on `http://localhost:8081`

### Option B: Manual Launch

#### 1. Start the Backend:
```bash
cd backend
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```
Backend API docs available at: `http://localhost:8000/docs`

#### 2. Start the Mobile App:
```bash
cd mobile
npm run web
```
App opens in browser at: `http://localhost:8081`

---

## 🧪 Step-by-Step Evaluator & Submission Walkthrough

Follow these steps for a complete evaluation demonstration:

1. **Launch the Application**: Open `http://localhost:8081` in your browser.
2. **Instant Demo Access**: On the welcome screen, click **"⚡ Quick Demo Sign-In (1-Click)"** to immediately enter the authenticated tourist dashboard.
3. **Explore the Home Dashboard**:
   * Observe the personalized greeting, active safety status badge ("All Good!"), and live location card.
   * Review the Emergency SOS card and the India Safety Radar banner.
4. **Inspect the Map & Safe Navigation**:
   * Click the **Map** tab in the bottom bar.
   * View live positioning, danger/caution geofences, and tap the quick filters (**Hospitals**, **Police**, **Pharmacies**) to locate emergency amenities.
5. **Check Safety Scores & AI Predictions**:
   * Click the **Safety** tab.
   * Select preset destinations (e.g. *Taj Mahal, Agra*, *Fort Kochi*, *India Gate, Delhi*) or type any Indian city.
   * Review the score (0–100), safety category badge (Safe / Caution / Avoid), and the SHAP explanation breakdown ("Why this score?").
   * Review active live incident alerts and test the **"Report Incident"** modal.
6. **Chat with Trevora AI**:
   * Click the **Assistant** tab.
   * Ask: *"What is the emergency helpline in India?"* or *"Give me a safe 2-day itinerary for Delhi"*.
   * Trevora AI provides concise, verified advice with emergency numbers (112, 108, 1091).
7. **Verify Blockchain Tourist Identity**:
   * Click the **Tourist ID** tab.
   * Inspect the Holographic Passport Card with W3C DID (`did:tourist:0x742d...f44e`).
   * Tap **"QR Pass"** to display the 25x25 verifiable QR Matrix.
   * In the verification panel, verify the SHA-256 hash integrity match.
   * Tap **"Test Tamper Alert"** &rarr; see the screen immediately flag **`🚨 TAMPER DETECTED`**.
   * Tap **"Restore Clean ID"** &rarr; see status return to **Authentic (100% Untampered)**.
   * Scroll down to Travel Records &rarr; tap **"+ Anchor New"** to sign and mine a new permit into the blockchain.
   * Tap **"Block Explorer"** to inspect blocks, Merkle roots, and raw transactions.

---

## 📁 Project Directory Structure

```
safety_tourist_app/
├── backend/                              # FastAPI Python Backend
│   ├── api/
│   │   ├── routes/
│   │   │   ├── chatbot.py                # SafeTrip Buddy AI Assistant router
│   │   │   ├── safety.py                 # Safety score & city queries
│   │   │   ├── places.py                 # Tourist attractions & amenities
│   │   │   ├── incidents.py              # Live news & crowdsourced reports
│   │   │   └── trip.py                   # Custom trip ranking & itinerary
│   │   ├── db.py                         # SQLite schema & database connection
│   │   ├── models.py                     # Pydantic data schemas
│   │   └── main.py                       # FastAPI application entry point
│   ├── ml/
│   │   ├── predictor.py                  # LightGBM + SHAP inference engine
│   │   └── safety_model.joblib           # Pre-trained gradient boosted model
│   ├── services/                         # Weather, News, Geocoder, Scoring
│   ├── run.bat / run.ps1                 # Backend launch scripts
│   └── requirements.txt
├── mobile/                               # React Native / Expo Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx             # Home screen & status dashboard
│   │   │   │   ├── map.tsx               # Safe navigation & geofencing
│   │   │   │   ├── safety.tsx            # Safety radar & ML explanations
│   │   │   │   ├── assistant.tsx         # SafeTrip Buddy AI chat interface
│   │   │   │   └── profile.tsx           # Blockchain Tourist ID hub
│   │   │   ├── trip.tsx                  # Dynamic smart itinerary planner
│   │   │   ├── emergency.tsx             # Emergency SOS & contact directives
│   │   │   ├── verify.tsx                # Checkpoint QR scanner & verifier
│   │   │   ├── tourist-id.tsx            # Digital tourist passport view
│   │   │   ├── welcome.tsx               # Welcome screen with 1-click demo
│   │   │   ├── login.tsx / signup.tsx    # Auth screens
│   │   │   └── _layout.tsx               # Root routing & Auth provider
│   │   ├── components/                   # UI, Blockchain, and Map components
│   │   ├── context/                      # Auth, Location, and Live-Share context
│   │   └── utils/                        # Crypto, Blockchain, Trust, Routes, Safety API
│   └── package.json
├── tracker/                              # Node.js SOS Live-Location & Identity Server
├── blockchain/                           # Solidity TouristRegistry Smart Contract
├── PROJECT_REPORT.html                   # Formal academic & technical report
├── run-app.bat / run-app.ps1             # One-click project launchers
└── README.md                             # Project documentation
```

---

## 🏁 Submission Ready

This project is completely refined, integrated, and verified. Evaluators and presentation panels can run the system effortlessly using `run-app.bat` or `run-app.ps1` and test all 10 core features directly.
