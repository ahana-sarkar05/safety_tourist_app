// Verification: recompute a record's fingerprint from its CURRENT data and
// compare it with (a) the fingerprint saved in the database and (b) the one
// anchored on the blockchain.
//
//  * Someone edits a record in the database  -> recomputed hash != both -> FAILED
//  * Someone edits the record AND its stored hash too -> the chain still holds
//    the original -> FAILED. This is what the blockchain adds.
//  * The chain can't be reached -> UNVERIFIED (never "verified" by default)

import { chain } from "./chain.mjs";
import { decryptJson, hashPayload, identityPayload, recordPayload } from "./integrity.mjs";
import { db, recordsOf } from "./store.mjs";

// "Abida Khan" -> "Abida K."  (a verifier needs enough to recognise a person,
// not their full details)
export function maskName(fullName) {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${Array.from(parts[parts.length - 1])[0].toUpperCase()}.`;
}

// Returns { available, reason }. Reads happen only if available.
async function chainReadable() {
  const a = await chain.isAvailable();
  return a;
}

export async function verifyIdentity(touristId) {
  const r = db.identities[touristId];
  if (!r) {
    return { status: "not_found", message: "No tourist is registered with this ID.", touristId, checks: [], records: [] };
  }

  const computed = hashPayload(identityPayload(r));
  const dbMatches = computed === r.recordHash;

  let availability = await chainReadable();
  let onChain = null;
  if (availability.available) {
    try {
      onChain = await chain.readIdentity(touristId);
    } catch {
      availability = { available: false, reason: "Can't reach the blockchain node." };
    }
  }

  const anchored = Boolean(onChain?.exists);
  const chainMatches = anchored ? onChain.hash === computed : null;
  const revoked = r.status === "revoked" || (anchored && onChain.status === 2);

  const checks = [
    { id: "exists", label: "Tourist ID exists in the registry", ok: true },
    { id: "database", label: "Record matches its saved fingerprint", ok: dbMatches },
    {
      id: "anchored",
      label: "Fingerprint is anchored on the blockchain",
      ok: availability.available ? anchored : null,
    },
    {
      id: "blockchain",
      label: "Blockchain fingerprint matches the record",
      ok: anchored ? chainMatches : null,
    },
    { id: "active", label: "ID has not been revoked", ok: !revoked },
  ];

  let status;
  let message;
  if (!dbMatches || chainMatches === false) {
    status = "failed";
    message = "Verification failed: this record has been modified since it was registered.";
  } else if (revoked) {
    status = "revoked";
    message = "This ID has been revoked and is no longer valid.";
  } else if (availability.available && anchored && chainMatches) {
    status = "verified";
    message = "Verified: the record matches its fingerprint on the blockchain.";
  } else if (availability.available && !anchored) {
    const sameContract = r.anchor?.status === "anchored" && r.anchor.contract === chain.contractKey;
    if (sameContract) {
      status = "failed";
      message = "Verification failed: this record was anchored but is missing from the blockchain.";
    } else {
      status = "unverified";
      message = "Not verified yet: the fingerprint is still waiting to be anchored on the blockchain.";
    }
  } else {
    status = "unverified";
    message = "Could not verify: the blockchain is not reachable right now.";
  }

  // Travel records: status only, never their contents.
  const records = [];
  for (const rec of recordsOf(touristId)) {
    if (rec.type !== "travel_permit") continue;
    const s = await recordStatus(rec, availability);
    records.push({ type: rec.type, kind: s.kind ?? null, createdAt: rec.createdAt, status: s.status });
  }

  return {
    status,
    message,
    touristId,
    displayName: maskName(r.fullName),
    nationality: r.nationality,
    registeredAt: r.registeredAt,
    checks,
    chain: {
      available: availability.available,
      network: chain.networkName,
      reason: availability.available ? null : (availability.reason ?? null),
      fingerprint: r.recordHash,
      anchoredAt: r.anchor?.anchoredAt ?? null,
      txHash: r.anchor?.txHash ?? null,
    },
    records,
  };
}

// verified | tampered | pending | unconfirmed
export async function recordStatus(rec, availability) {
  let data;
  try {
    data = decryptJson(rec.enc, rec.touristId);
  } catch {
    // Encrypted data that no longer decrypts has been altered.
    return { status: "tampered", reason: "Stored data was altered." };
  }
  const kind = data?.kind ?? null;

  const computed = hashPayload(recordPayload(rec, data));
  if (computed !== rec.recordHash) return { status: "tampered", reason: "Record no longer matches its fingerprint.", kind, data };

  const av = availability ?? (await chainReadable());
  if (!av.available) {
    return { status: rec.anchor?.status === "anchored" ? "unconfirmed" : "pending", kind, data };
  }
  try {
    const onChain = await chain.readRecord(rec.touristId, rec.recordId);
    if (!onChain.exists) return { status: "pending", kind, data };
    if (onChain.hash !== computed) return { status: "tampered", reason: "Record does not match the blockchain.", kind, data };
    return { status: "verified", kind, data };
  } catch {
    return { status: rec.anchor?.status === "anchored" ? "unconfirmed" : "pending", kind, data };
  }
}
