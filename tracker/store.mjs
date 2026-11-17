// The database: one JSON file, written atomically.
//
//   identities : TOURIST-YYYY-NNN -> profile + fingerprint + anchor status
//   records    : recordId -> encrypted record + fingerprint + anchor status
//   grants     : grantId  -> emergency-access permission (code stored hashed)
//   audit      : who opened emergency information, and when
//   accounts   : email -> password hash + the tourist ID created at sign-up
//   sessions   : hash of a login token -> who it belongs to, and when it expires

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPayload, identityPayload, randomHex } from "./integrity.mjs";

const FILE =
  process.env.IDENTITY_FILE ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), "identities.json");

export const db = { seq: {}, identities: {}, records: {}, grants: {}, audit: [], accounts: {}, sessions: {} };

function load() {
  let loaded = null;
  try {
    loaded = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") console.error("Could not read the identities file:", e.message);
  }
  if (!loaded || typeof loaded !== "object") return;
  db.seq = loaded.seq ?? {};
  db.identities = loaded.identities ?? {};
  db.records = loaded.records ?? {};
  db.grants = loaded.grants ?? {};
  db.audit = Array.isArray(loaded.audit) ? loaded.audit : [];
  db.accounts = loaded.accounts ?? {};
  db.sessions = loaded.sessions ?? {};

  // Upgrade identities created before fingerprints existed (Stage 1).
  let upgraded = 0;
  for (const r of Object.values(db.identities)) {
    if (r.recordHash) continue;
    r.salt = randomHex();
    r.recordHash = hashPayload(identityPayload(r));
    r.anchor = { status: "pending", attempts: 0 };
    upgraded++;
  }
  if (upgraded) {
    console.log(`Upgraded ${upgraded} existing identit${upgraded === 1 ? "y" : "ies"} with fingerprints.`);
    save();
  }
}

// Write to a temp file, then rename over the real one, so a crash mid-write
// can never leave a half-written (corrupt) database behind.
export function save() {
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

load();

export const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

// ---------- who is calling? ----------
// Login hands the app a random token. Only its SHA-256 is stored here.

export const SESSION_DAYS = 30;

export const bearer = (req) => (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");

export function sessionOf(req) {
  const token = bearer(req);
  if (!token) return null;
  const s = db.sessions[sha256(token)];
  if (!s || Date.parse(s.expiresAt) <= Date.now()) return null;
  return s;
}

// Drop sessions that have expired.
export function purgeSessions() {
  let removed = 0;
  for (const [key, s] of Object.entries(db.sessions)) {
    if (Date.parse(s.expiresAt) <= Date.now()) {
      delete db.sessions[key];
      removed++;
    }
  }
  if (removed) save();
}

// For routes that belong to one tourist. Sends the error reply itself.
//   no valid login            -> 401 (the app should send the person to log in)
//   logged in as someone else -> 404, the same answer as "no such ID"
export function authorizeOwner(req, res, touristId, json) {
  const s = sessionOf(req);
  if (!s) {
    json(res, 401, { error: "Please log in again." });
    return null;
  }
  const r = db.identities[touristId];
  if (!r || s.touristId !== touristId) {
    json(res, 404, { error: "Not found" });
    return null;
  }
  return r;
}

export const ID_PATTERN = /^TOURIST-\d{4}-\d{3,}$/;

export function nextTouristId() {
  const year = String(new Date().getUTCFullYear());
  const n = (db.seq[year] ?? 0) + 1;
  db.seq[year] = n;
  return `TOURIST-${year}-${String(n).padStart(3, "0")}`;
}

export const recordsOf = (touristId) =>
  Object.values(db.records).filter((r) => r.touristId === touristId);

export const grantsOf = (touristId) =>
  Object.values(db.grants).filter((g) => g.touristId === touristId);
