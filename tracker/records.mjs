// Travel records, emergency information and permission-based sharing.
//
// Owner (Authorization: Bearer <ownerToken>):
//   GET/POST   /api/identity/:id/records       travel permit / booking records
//   GET/PUT    /api/identity/:id/emergency     emergency information
//   GET/POST   /api/identity/:id/grants        who may open it (access codes)
//   DELETE     /api/identity/:id/grants/:gid   revoke one
// Trusted person (needs a code the tourist created):
//   POST       /api/emergency/access           { touristId, code }
//
// All record data is encrypted at rest. The blockchain gets only fingerprints:
// of each record, of every permission granted or revoked, and of every time
// emergency information is opened. That last one is the audit trail: a record
// of who looked, and when, that nobody can quietly erase afterwards.

import crypto from "node:crypto";
import { scheduleAnchoring } from "./anchoring.mjs";
import { decryptJson, encryptJson, hashPayload, randomHex, recordPayload } from "./integrity.mjs";
import { createLimiter } from "./ratelimit.mjs";
import { ID_PATTERN, authorizeOwner, db, grantsOf, recordsOf, save, sha256 } from "./store.mjs";
import { recordStatus } from "./verify.mjs";

const MAX_RECORDS = 50;
const MAX_ACTIVE_GRANTS = 10;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L: easy to read out loud
const hasControlChars = (s) => /[\u0000-\u001f\u007f]/.test(s);
const tidy = (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

// ---------- validation ----------
function isoDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const TRAVEL_KINDS = {
  flight: "Flight booking",
  hotel: "Hotel reservation",
  permit: "Travel permit",
  booking: "Other booking",
};

export function validateTravelRecord(data) {
  const kind = data?.kind;
  if (typeof kind !== "string" || !Object.hasOwn(TRAVEL_KINDS, kind)) {
    return { error: "Choose a flight, hotel, permit or other booking." };
  }

  const title = tidy(data?.title);
  if (title.length < 2 || title.length > 80 || hasControlChars(title)) return { error: "Enter a title (2 to 80 characters)." };

  const reference = tidy(data?.reference);
  if (reference.length < 2 || reference.length > 60 || hasControlChars(reference)) {
    return { error: "Enter a reference number (2 to 60 characters)." };
  }

  const value = { kind, title, reference };
  for (const field of ["validFrom", "validTo"]) {
    const raw = tidy(data?.[field]);
    if (raw === "") continue;
    if (!isoDate(raw)) return { error: `${field === "validFrom" ? "Valid from" : "Valid to"} must be a date like 2026-12-31.` };
    value[field] = raw;
  }
  if (value.validFrom && value.validTo && value.validTo < value.validFrom) {
    return { error: "The end date can't be before the start date." };
  }
  return { value };
}

export function validateEmergency(data) {
  const contactName = tidy(data?.contactName);
  if (contactName.length < 2 || contactName.length > 80 || !/\p{L}/u.test(contactName) || hasControlChars(contactName)) {
    return { error: "Enter your emergency contact's name." };
  }
  let p = String(data?.contactPhone ?? "").trim().replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  p = (p.startsWith("+") ? "+" : "") + p.replace(/\+/g, "");
  if (!/^\+?\d{7,15}$/.test(p)) return { error: "Enter a valid phone number for your emergency contact." };

  const notes = typeof data?.notes === "string" ? data.notes.trim() : "";
  if (notes.length > 300 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(notes)) {
    return { error: "Notes can be up to 300 characters." };
  }
  return { value: { contactName, contactPhone: p, notes } };
}

// ---------- records ----------
export function createRecord(touristId, type, data) {
  const rec = {
    recordId: crypto.randomUUID(),
    touristId,
    type,
    createdAt: new Date().toISOString(),
    salt: randomHex(),
  };
  rec.enc = encryptJson(data, touristId);
  rec.recordHash = hashPayload(recordPayload(rec, data));
  rec.anchor = { status: "pending", attempts: 0 };
  db.records[rec.recordId] = rec;
  return rec;
}

function summaryOf(rec, data) {
  switch (rec.type) {
    case "travel_permit":
      return `${TRAVEL_KINDS[data.kind] ?? "Record"}: ${data.title}`;
    case "emergency_update":
      return "Emergency information updated";
    case "consent_grant":
      return `Access granted: ${data.label}`;
    case "consent_revoke":
      return "Access revoked";
    case "emergency_access":
      return `Emergency information opened: ${data.label}`;
    default:
      return rec.type;
  }
}

const latestEmergency = (touristId) => recordsOf(touristId).filter((r) => r.type === "emergency_update").at(-1) ?? null;

function readEmergency(touristId) {
  const rec = latestEmergency(touristId);
  if (!rec) return null;
  try {
    return { rec, info: decryptJson(rec.enc, touristId) };
  } catch {
    return null;
  }
}

// ---------- grants ----------
const grantHash = (grantId, code) => sha256(`${grantId}:${code}`);
const normalizeCode = (c) => String(c ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function newCode() {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

const isActive = (g, now = Date.now()) => !g.revokedAt && now < Date.parse(g.expiresAt);

const grantView = (g) => ({
  grantId: g.grantId,
  label: g.label,
  createdAt: g.createdAt,
  expiresAt: g.expiresAt,
  revokedAt: g.revokedAt ?? null,
  uses: g.uses,
  lastUsedAt: g.lastUsedAt ?? null,
  active: isActive(g),
});

// ---------- routes ----------
export function createRecordsHandler({ json, readBody, clientIp }) {
  const accessIpLimit = createLimiter({ max: 30, windowMs: 10 * 60_000 });
  const failures = new Map(); // touristId -> { count, until }

  const notRevoked = (res, r) => {
    if (r.status === "revoked") {
      json(res, 403, { error: "This ID has been revoked." });
      return false;
    }
    return true;
  };

  return async function handle(req, res, pathname) {
    // ---------- a trusted person opens emergency information ----------
    if (req.method === "POST" && pathname === "/api/emergency/access") {
      const deny = (status = 403) => json(res, status, { error: "Invalid or expired access code." });
      if (!accessIpLimit.take(clientIp(req))) return json(res, 429, { error: "Too many attempts. Try again later." }), true;

      const body = await readBody(req);
      const touristId = typeof body?.touristId === "string" ? body.touristId.trim() : "";
      const code = normalizeCode(body?.code);
      if (!ID_PATTERN.test(touristId) || code.length !== 8) return deny(), true;

      const lock = failures.get(touristId);
      if (lock && lock.until > Date.now()) return json(res, 429, { error: "Too many wrong codes. Try again in a few minutes." }), true;

      const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
      const owner = db.identities[touristId];
      const grant = grantsOf(touristId).find((g) => {
        const a = Buffer.from(g.codeHash);
        const b = Buffer.from(grantHash(g.grantId, formatted));
        return a.length === b.length && crypto.timingSafeEqual(a, b);
      });

      if (!owner || owner.status === "revoked" || !grant || !isActive(grant)) {
        const f = failures.get(touristId) ?? { count: 0, until: 0 };
        f.count += 1;
        if (f.count >= 5) {
          f.until = Date.now() + 15 * 60_000;
          f.count = 0;
        }
        failures.set(touristId, f);
        return deny(), true;
      }

      failures.delete(touristId);
      grant.uses += 1;
      grant.lastUsedAt = new Date().toISOString();
      db.audit.push({ at: grant.lastUsedAt, touristId, grantId: grant.grantId });
      if (db.audit.length > 1000) db.audit.splice(0, db.audit.length - 1000);
      // Audit trail: fingerprint this access on the blockchain.
      createRecord(touristId, "emergency_access", { action: "access", grantId: grant.grantId, label: grant.label, at: grant.lastUsedAt });
      save();
      scheduleAnchoring();

      const current = readEmergency(touristId);
      json(res, 200, {
        touristId,
        fullName: owner.fullName,
        nationality: owner.nationality,
        grantLabel: grant.label,
        expiresAt: grant.expiresAt,
        emergency: current ? current.info : null,
        emergencyUpdatedAt: current ? current.rec.createdAt : null,
      });
      return true;
    }

    // ---------- owner routes ----------
    const m = pathname.match(/^\/api\/identity\/(TOURIST-\d{4}-\d{3,})\/(records|emergency|grants)(?:\/([\w-]+))?$/);
    if (!m) return false;
    const [, id, section, sub] = m;
    const owner = authorizeOwner(req, res, id, json);
    if (!owner) return true;

    // --- records
    if (section === "records" && !sub) {
      if (req.method === "GET") {
        const items = [];
        for (const rec of recordsOf(id)) {
          const s = await recordStatus(rec);
          const data = s.data ?? null;
          items.push({
            recordId: rec.recordId,
            type: rec.type,
            createdAt: rec.createdAt,
            summary: data ? summaryOf(rec, data) : "Unreadable record",
            details: rec.type === "travel_permit" && data ? data : null,
            status: s.status,
            reason: s.reason ?? null,
            fingerprint: rec.recordHash,
            anchor: { status: rec.anchor?.status ?? "pending", txHash: rec.anchor?.txHash ?? null, anchoredAt: rec.anchor?.anchoredAt ?? null },
          });
        }
        json(res, 200, { records: items.reverse() });
        return true;
      }
      if (req.method === "POST") {
        if (!notRevoked(res, owner)) return true;
        const body = await readBody(req);
        if (body?.type !== "travel_permit") return json(res, 400, { error: "Unsupported record type." }), true;
        const result = validateTravelRecord(body.data);
        if (result.error) return json(res, 400, { error: result.error }), true;
        if (recordsOf(id).filter((r) => r.type === "travel_permit").length >= MAX_RECORDS) {
          return json(res, 400, { error: `You can keep up to ${MAX_RECORDS} travel records.` }), true;
        }
        const rec = createRecord(id, "travel_permit", result.value);
        save();
        scheduleAnchoring();
        json(res, 201, { recordId: rec.recordId, fingerprint: rec.recordHash, createdAt: rec.createdAt });
        return true;
      }
    }

    // --- emergency information
    if (section === "emergency" && !sub) {
      if (req.method === "GET") {
        const cur = readEmergency(id);
        json(res, 200, {
          info: cur ? cur.info : null,
          updatedAt: cur ? cur.rec.createdAt : null,
          anchor: cur ? { status: cur.rec.anchor?.status ?? "pending", txHash: cur.rec.anchor?.txHash ?? null } : null,
        });
        return true;
      }
      if (req.method === "PUT") {
        if (!notRevoked(res, owner)) return true;
        const result = validateEmergency(await readBody(req));
        if (result.error) return json(res, 400, { error: result.error }), true;
        const rec = createRecord(id, "emergency_update", result.value);
        save();
        scheduleAnchoring();
        json(res, 200, { updatedAt: rec.createdAt, fingerprint: rec.recordHash });
        return true;
      }
    }

    // --- grants
    if (section === "grants") {
      if (!sub && req.method === "GET") {
        json(res, 200, { grants: grantsOf(id).map(grantView).reverse() });
        return true;
      }
      if (!sub && req.method === "POST") {
        if (!notRevoked(res, owner)) return true;
        const body = await readBody(req);
        const label = tidy(body?.label) || "Trusted contact";
        if (label.length > 40 || hasControlChars(label)) return json(res, 400, { error: "Label can be up to 40 characters." }), true;
        const hours = body?.hours === undefined ? 24 : Number(body.hours);
        if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
          return json(res, 400, { error: "Choose between 1 hour and 7 days." }), true;
        }
        if (grantsOf(id).filter((g) => isActive(g)).length >= MAX_ACTIVE_GRANTS) {
          return json(res, 400, { error: `You can have up to ${MAX_ACTIVE_GRANTS} active access codes. Revoke one first.` }), true;
        }

        const now = Date.now();
        const grantId = crypto.randomUUID();
        const code = newCode();
        const grant = {
          grantId,
          touristId: id,
          label,
          codeHash: grantHash(grantId, code), // the code itself is never stored
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + hours * 3600_000).toISOString(),
          revokedAt: null,
          uses: 0,
          lastUsedAt: null,
        };
        db.grants[grantId] = grant;
        // Proof of the authorisation, fingerprinted on the blockchain.
        createRecord(id, "consent_grant", { action: "grant", grantId, label, expiresAt: grant.expiresAt });
        save();
        scheduleAnchoring();
        json(res, 201, { ...grantView(grant), code }); // the only time the code is ever shown
        return true;
      }
      if (sub && req.method === "DELETE") {
        const grant = db.grants[sub];
        if (!grant || grant.touristId !== id) return json(res, 404, { error: "Not found" }), true;
        if (!grant.revokedAt) {
          grant.revokedAt = new Date().toISOString();
          createRecord(id, "consent_revoke", { action: "revoke", grantId: grant.grantId, label: grant.label });
          save();
          scheduleAnchoring();
        }
        json(res, 200, grantView(grant));
        return true;
      }
    }

    json(res, 404, { error: "Not found" });
    return true;
  };
}
