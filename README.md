<<<<<<< HEAD
# 🌍 Smart Tourist Safety & Travel Assistant

An AI-powered mobile application designed to protect tourists, assist with navigation, provide real-time alerts, and secure traveler credentials using **Decentralized Blockchain Identity and Cryptographic Verification**.

---

## 💡 Overview & Core Features

1. 🤖 **AI Travel Assistant**: Conversational AI for local guidance, attraction recommendations, and intelligent itinerary planning.
2. 📍 **GPS Smart Tracking & Navigation**: Real-time positioning, safe route guidance, and restricted zone geofencing.
3. 🚨 **Real-Time Safety Alerts**: Location-based alerts, geofence warnings, and emergency SOS broadcast.
4. ⛓️ **Blockchain Tourist Identity & Records**: Decentralized digital tourist passport, zero-knowledge privacy, tamper-resistant travel permits, emergency medical seals, and in-app block explorer.
5. 🧠 **AI Safety Prediction**: Area safety scoring based on time, location, and environment metrics.
6. 📸 **AI Landmark Recognition**: Image recognition for heritage monuments and historic landmarks.
7. 🗺️ **Smart Dynamic Itinerary**: Budget-aware and time-aware adaptive travel schedule.
8. 👥 **Emergency Contact System**: Instant SOS location sharing with trusted contacts.

---

## ⛓️ Blockchain Tourist Identity & Records System (In Detail)

The blockchain subsystem addresses security, identity verification, and medical emergency readiness while strictly preserving traveler privacy.

### 1. Zero-Knowledge Privacy Architecture
* **Off-Chain Personal Data**: Sensitive personal information (passport number, national ID, birth date, detailed medical history, emergency contacts) is stored **strictly off-chain** on the user's local device (`AsyncStorage`).
* **On-Chain Cryptographic Commitments**: Only the deterministic **SHA-256 mathematical fingerprint** (`0x...`), the tourist's Decentralized Identifier (**DID**), and issuance metadata are anchored on the blockchain.
* **Privacy Compliance**: No private identity data is ever exposed publicly on the ledger, preventing identity theft and complying with global data privacy regulations (GDPR, DPDP).

### 2. Digital Tourist ID & Holographic Passport Card
* **W3C Decentralized Identifier (DID)**: Every traveler receives an immutable identity string (e.g. `did:tourist:0x742d35Cc6634C0532925a3b844Bc454e4438f44e`).
* **Interactive Passport Card**: Features a modern card design with smart-chip graphic, network status (`Polygon Sepolia / Consortium Network`), traveler name, nationality, and validity period.
* **Verifiable QR Matrix Pass**: Tapping the mini-QR on the card opens a full-screen 25x25 QR Matrix pass that checkpoint guards, police, or rescue personnel can scan for instant verification.

### 3. Real-Time Cryptographic Verification Engine
* Dynamically calculates the SHA-256 digest of the traveler's local off-chain credentials.
* Compares the computed digest against the on-chain anchor on Block `#1041`.
* Displays real-time integrity status: **`Ledger Verification: Authentic (100% Untampered)`**.

### 4. Interactive Tamper Stress-Test Simulator
* A built-in testing feature for evaluators and demonstrations:
  1. Click **"Test Tamper Alert"** in the app.
  2. The system modifies just **1 character** of the off-chain passport number.
  3. The local SHA-256 hash immediately changes (due to the cryptographic avalanche effect) and mismatches the on-chain anchor.
  4. The screen flips to **`🚨 TAMPER DETECTED`**, proving how the blockchain detects unauthorized credential alterations.
  5. Click **"Restore Clean ID"** to reset back to authentic status.

### 5. Tamper-Resistant Travel Records & Permits Ledger
* Pre-seeded with verified on-chain permits:
  * 🏔️ **High-Altitude Eco-Zone Trekking Permit** (Rohtang Pass &bull; Block `#1042`)
  * 🏛️ **National Heritage Digital Access Pass** (Archaeological Survey &bull; Block `#1043`)
  * 🛡️ **International Rapid Rescue & SOS Insurance** (Global Travel Guard &bull; Block `#1044`)
* **Real-Time Permit Minting**: Tap **"+ Anchor New"** to enter any permit details. The app computes its SHA-256 hash and immediately mines a new block into the ledger.

### 6. Emergency Medical & Contact Directive
* Cryptographically seals the traveler's critical life-saving information:
  * **Blood Group** (`O+`)
  * **Critical Allergies** (`Penicillin`)
  * **Primary SOS Contact Phone**
* Search & rescue teams or hospital paramedics can verify that emergency directives have not been manipulated or forged.

### 7. In-App Consortium Block Explorer
* Tap **"Block Explorer"** to inspect the live blockchain ledger:
  * **Block Height & Metrics**: Total confirmed blocks and transactions.
  * **Blocks Tab**: Inspect Genesis Block `#0`, Block `#1041`, Block `#1042`, etc., including Block Hash, Merkle Root, and Validator Address.
  * **Transactions Tab**: Inspect confirmed transactions (`IDENTITY_MINT`, `RECORD_ANCHOR`, `EMERGENCY_DIRECTIVE`) with gas metrics.

### 8. Authentication: Dedicated Login & Logout System
* **Dual-Mode Auth (Log In vs. Sign Up)**:
  * **Log In Mode**: Returning travelers can immediately log in with **Google** or enter their registered email & PIN to verify their existing on-chain identity and access the app directly.
  * **Sign Up / Registration Mode**: New travelers register with Google or email, then complete their identity setup to mint a new W3C DID on the blockchain.
* **Google OAuth 2.0 Integration**: Sign in with official Google credentials using Google Identity Services (Client ID: `350849533351-7n53u551sk94lclc8jp512q5ev2nhrdm.apps.googleusercontent.com`).
* **Pre-Access Identity Registration**: New travelers are asked to fill their travel details (Name, Nationality, Passport ID, Blood Group, Allergies, Emergency Contact) before gaining access to the app.
* **Instant Block Mining**: Submitting the registration form automatically derives the tourist's DID, computes SHA-256 commitments, and anchors the identity into a newly mined block on the consortium ledger.
* **Multiple Logout Options**:
  * **Home Screen**: Instant Logout button in the top-right hero header next to notifications with a safety confirmation prompt.
  * **Tourist ID Screen**: Quick **Logout** pill in the top action bar.
  * **Full Sign Out Card**: Dedicated **"Sign Out / Switch Account"** button at the bottom of the Tourist ID tab.

---

## 📁 Blockchain Codebase Structure

```
mobile/src/
├── app/(tabs)/
│   ├── index.tsx                         # Home screen with personalized greeting & Tourist ID tile
│   └── profile.tsx                       # Main Tourist Identity & Blockchain Hub
├── components/blockchain/
│   ├── blockchain-id-card.tsx            # Holographic Digital Passport card & QR modal
│   ├── blockchain-verification-panel.tsx # Live SHA-256 verification & tamper test simulator
│   ├── emergency-directive-card.tsx      # Sealed emergency medical & contact directive
│   ├── travel-records-list.tsx           # Permits ledger with live block-mining modal
│   ├── block-explorer-modal.tsx          # Consortium blockchain block & tx explorer
│   ├── edit-profile-modal.tsx            # Off-chain profile editor with on-chain re-anchoring
│   └── qr-code.tsx                       # Dependency-free 25x25 QR Matrix renderer
└── utils/
    ├── crypto.ts                         # Pure TypeScript RFC 6234 standard SHA-256 engine
    └── blockchain.ts                     # Consortium chain state, DID, blocks, and verification
```

---

## 🚀 Getting Started

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v18 or later)
* npm or yarn

### 2. Installation
```bash
cd mobile
npm install
```

### 3. Run Development Server
```bash
# Start web version
npm run web

# Or start interactive Expo runner (iOS / Android / Web)
npm run start
```

Open [http://localhost:8081](http://localhost:8081) in your browser or scan the QR code via **Expo Go** on your physical device.

---

## 🧪 How to Verify the Blockchain Features

1. **View Digital ID**: Navigate to the **Tourist ID** tab. Review your DID (`did:tourist:0x742d...f44e`) and tap **QR Pass** to see the full verifiable pass.
2. **Verify Integrity**: In the verification panel, verify that the Local SHA-256 hash matches the On-Chain Anchor hash.
3. **Simulate Tampering**: Tap **"Test Tamper Alert"** and watch the system flag the discrepancy. Tap **"Restore Clean ID"** to reset.
4. **Anchor a New Permit**: Scroll down to Travel Records, tap **"+ Anchor New"**, fill out a title, and tap **"Sign & Mine into Blockchain"** to see a new block mined live.
5. **Open Block Explorer**: Tap **"Block Explorer"** at the top right to inspect raw blocks, Merkle roots, and transactions.
=======
# safety_tourist_app
>>>>>>> 4faa973dcc763ccbb09c2060ae2b6f38cb7a3a20
