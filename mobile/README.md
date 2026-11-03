# 📱 Mobile Application - Smart Tourist Safety & Travel Assistant

This is the Expo / React Native mobile application for the **Smart Tourist Safety & Travel Assistant**, featuring AI travel assistance, live GPS tracking, and **Blockchain-based Tourist Identity & Records**.

---

## ⛓️ Blockchain Tourist Identity & Records

The application implements a decentralized trust layer for tourist safety:

* **Decentralized Tourist ID (DID)**: W3C standard identity string (`did:tourist:0x...`) with holographic card and QR pass.
* **Zero-Knowledge Privacy**: Passport numbers, medical specifics, and contact details remain **strictly off-chain** on the user's device. Only deterministic SHA-256 hashes are anchored on the blockchain.
* **Real-Time Verification**: Live cryptographic comparison between local credentials and the on-chain block receipt.
* **Tamper Stress-Test Simulator**: Interactive button that simulates off-chain credential alteration and triggers real-time hash mismatch alerts (`🚨 TAMPER DETECTED`).
* **Travel Records & Permits Ledger**: Pre-seeded with Rohtang Pass, Heritage Pass, and SOS Insurance, plus interactive live permit minting into new blocks.
* **Emergency Medical Directive**: Sealed blood group, allergies, and emergency phone for first responders.
* **Consortium Block Explorer**: In-app inspector for blocks, transactions, Merkle roots, and validator signatures.

For complete technical specifications, see the root [README.md](../README.md) and the technical PDF report: `Blockchain_Tourist_Identity_Architecture.pdf`.

---

## 🚀 Running the App

```bash
# Install dependencies
npm install

# Run with Expo Go (scan QR code with phone)
npm start

# Run web version
npm run web

# Run on Android emulator / device
npm run android

# Run on iOS simulator
npm run ios
```

---

## 🔐 Google Sign-In (Web & Expo Go)

* **Web**: Uses browser OAuth 2.0 popup centered on the screen with `prompt=select_account` to trigger the Google Account Chooser.
* **Expo Go**: Uses `expo-web-browser` with `WebBrowser.openAuthSessionAsync` to display the in-app Google Account Chooser sheet, automatically intercepting the redirect and logging the user in.
* **OAuth Credentials**: Configured with Google Client ID `350849533351-7n53u551sk94lclc8jp512q5ev2nhrdm.apps.googleusercontent.com` and redirect URI `http://localhost:8081`.

Development server runs on: [http://localhost:8081](http://localhost:8081)
