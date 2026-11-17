// Digital Tourist ID routes.
//
//   GET  /api/identity/:id              owner only (needs a login token)
//   POST /api/identity/:id/revoke       owner only
//   GET  /api/verify/:id                PUBLIC: is this ID genuine?
//   POST /api/demo/tamper/:id           demo mode only
//   POST /api/demo/restore/:id          demo mode only
//
// A Tourist ID is created when someone signs up (see accounts.mjs).
// Personal details live here, off-chain. Only a salted SHA-256 fingerprint of
// each record is ever sent to the blockchain.

import { scheduleAnchoring } from "./anchoring.mjs";
import { decryptJson, encryptJson, hashPayload, identityPayload, randomHex } from "./integrity.mjs";
import { createLimiter } from "./ratelimit.mjs";
import { ID_PATTERN, authorizeOwner, db, nextTouristId, recordsOf, save } from "./store.mjs";
import { verifyIdentity } from "./verify.mjs";

// Demo tools (tamper/restore) exist only when started with `npm run demo`
// (or DEMO_MODE=1). Using a flag keeps it working on Windows PowerShell too.
export const DEMO_MODE = process.env.DEMO_MODE === "1" || process.argv.includes("--demo");

const hasControlChars = (s) => /[\u0000-\u001f\u007f]/.test(s);

// Returns { value } or { error }.
export function validateRegistration(body) {
  const clean = (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

  const fullName = clean(body?.fullName);
  if (fullName.length < 2 || fullName.length > 80 || !/\p{L}/u.test(fullName) || hasControlChars(fullName)) {
    return { error: "Enter your full name (2 to 80 characters)." };
  }

  const nationality = clean(body?.nationality);
  if (nationality.length < 2 || nationality.length > 60 || !/\p{L}/u.test(nationality) || hasControlChars(nationality)) {
    return { error: "Enter your nationality." };
  }

  let phone = "";
  if (body?.phone !== undefined && body.phone !== null && String(body.phone).trim() !== "") {
    let p = String(body.phone).trim().replace(/[^\d+]/g, "");
    if (p.startsWith("00")) p = `+${p.slice(2)}`;
    p = (p.startsWith("+") ? "+" : "") + p.replace(/\+/g, "");
    if (!/^\+?\d{7,15}$/.test(p)) return { error: "Phone number looks invalid." };
    phone = p;
  }

  return { value: { fullName, nationality, phone } };
}

export function profileOf(r) {
  return {
    touristId: r.touristId,
    fullName: r.fullName,
    nationality: r.nationality,
    phone: r.phone,
    registeredAt: r.registeredAt,
    status: r.status,
    fingerprint: r.recordHash,
    anchor: {
      status: r.anchor?.status ?? "pending",
      txHash: r.anchor?.txHash ?? null,
      anchoredAt: r.anchor?.anchoredAt ?? null,
    },
  };
}

// Makes the identity record (with its fingerprint) in memory. The caller saves
// the database and schedules anchoring.
export function createIdentity({ fullName, nationality, phone }) {
  const record = {
    touristId: nextTouristId(),
    fullName,
    nationality,
    phone,
    registeredAt: new Date().toISOString(),
    status: "active",
    salt: randomHex(),
  };
  record.recordHash = hashPayload(identityPayload(record));
  record.anchor = { status: "pending", attempts: 0 };
  db.identities[record.touristId] = record;
  return record;
}

export function createIdentityHandler({ json, readBody, clientIp }) {
  const verifyLimit = createLimiter({ max: 60, windowMs: 60_000 });

  return async function handle(req, res, pathname) {
    // ---------- public verification ----------
    const v = pathname.match(/^\/api\/verify\/([^/]+)$/);
    if (v && req.method === "GET") {
      if (!verifyLimit.take(clientIp(req))) {
        json(res, 429, { error: "Too many checks. Slow down." });
        return true;
      }
      if (!ID_PATTERN.test(v[1])) {
        json(res, 200, { status: "not_found", message: "That is not a valid Tourist ID.", checks: [], records: [], demoMode: DEMO_MODE });
        return true;
      }
      const result = await verifyIdentity(v[1]);
      json(res, 200, { ...result, demoMode: DEMO_MODE });
      return true;
    }

    // ---------- owner ----------
    const m = pathname.match(/^\/api\/identity\/(TOURIST-\d{4}-\d{3,})(\/revoke)?$/);
    if (m && req.method === "GET" && !m[2]) {
      const r = authorizeOwner(req, res, m[1], json);
      if (r) json(res, 200, profileOf(r));
      return true;
    }

    if (m && req.method === "POST" && m[2]) {
      const r = authorizeOwner(req, res, m[1], json);
      if (!r) return true;
      if (r.status !== "revoked") {
        r.status = "revoked";
        r.revokedAt = new Date().toISOString();
        r.revokeAnchor = { status: "pending", attempts: 0 };
        save();
        scheduleAnchoring();
      }
      json(res, 200, profileOf(r));
      return true;
    }

    // ---------- demo tools: simulate someone editing the database ----------
    const d = pathname.match(/^\/api\/demo\/(tamper|restore)\/(TOURIST-\d{4}-\d{3,})$/);
    if (d) {
      if (!DEMO_MODE || req.method !== "POST") {
        json(res, 404, { error: "Not found" });
        return true;
      }
      const r = db.identities[d[2]];
      if (!r) {
        json(res, 404, { error: "Not found" });
        return true;
      }
      const body = await readBody(req).catch(() => ({}));

      if (d[1] === "tamper") {
        if (typeof body?.recordId === "string") {
          // Alter a saved record's contents WITHOUT updating its fingerprint.
          const rec = db.records[body.recordId];
          if (!rec || rec.touristId !== r.touristId) {
            json(res, 404, { error: "Record not found" });
            return true;
          }
          rec.demoBackup ??= { enc: rec.enc };
          const data = decryptJson(rec.enc, rec.touristId);
          if (typeof data.title === "string") data.title += " (altered)";
          else if (typeof data.contactName === "string") data.contactName += " (altered)";
          else data.altered = true;
          rec.enc = encryptJson(data, rec.touristId);
        } else {
          r.demoBackup ??= { fullName: r.fullName };
          r.fullName += " (altered)";
        }
      } else {
        if (r.demoBackup) {
          r.fullName = r.demoBackup.fullName ?? r.fullName;
          delete r.demoBackup;
        }
        for (const rec of recordsOf(r.touristId)) {
          if (rec.demoBackup) {
            rec.enc = rec.demoBackup.enc;
            delete rec.demoBackup;
          }
        }
      }
      save();
      json(res, 200, { ok: true });
      return true;
    }

    return false;
  };
}
