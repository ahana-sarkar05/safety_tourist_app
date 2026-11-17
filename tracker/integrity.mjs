// Hashing and encryption helpers for the Digital Tourist ID.
//
//  * canonicalize(): the same data always becomes the same bytes, whatever the
//    key order, so the same record always has the same SHA-256 fingerprint.
//  * Every record carries a random SALT inside what gets hashed. Without it, a
//    low-entropy field like a phone number could be guessed, hashed and matched
//    against the public blockchain. With it, the on-chain hash reveals nothing.
//  * Record data is encrypted at rest (AES-256-GCM) and bound to its tourist ID.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------- canonical JSON + SHA-256 ----------

export function canonicalize(value) {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value.normalize("NFC"));
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new Error("Cannot hash a non-finite number");
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
      const keys = Object.keys(value).sort();
      const parts = [];
      for (const k of keys) {
        if (value[k] === undefined) continue; // absent and undefined are the same thing
        parts.push(`${JSON.stringify(k.normalize("NFC"))}:${canonicalize(value[k])}`);
      }
      return `{${parts.join(",")}}`;
    }
    default:
      throw new Error(`Cannot hash a value of type ${typeof value}`);
  }
}

export const sha256Hex = (text) => crypto.createHash("sha256").update(text, "utf8").digest("hex");
export const randomHex = (bytes = 16) => crypto.randomBytes(bytes).toString("hex");
export const hashPayload = (payload) => sha256Hex(canonicalize(payload));

// ---------- what exactly gets fingerprinted ----------

export function identityPayload(r) {
  return {
    schema: "tourist-id/identity/v1",
    touristId: r.touristId,
    fullName: r.fullName,
    nationality: r.nationality,
    phone: r.phone,
    registeredAt: r.registeredAt,
    salt: r.salt,
  };
}

export function recordPayload(rec, data) {
  return {
    schema: "tourist-id/record/v1",
    recordId: rec.recordId,
    touristId: rec.touristId,
    type: rec.type,
    createdAt: rec.createdAt,
    data,
    salt: rec.salt,
  };
}

// ---------- encryption at rest ----------

const KEY_FILE =
  process.env.KEY_FILE ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "secret.key");

function loadKey() {
  const fromEnv = process.env.DATA_KEY;
  if (fromEnv) {
    if (!/^[0-9a-fA-F]{64}$/.test(fromEnv)) {
      throw new Error("DATA_KEY must be 64 hex characters (32 bytes).");
    }
    return Buffer.from(fromEnv, "hex");
  }
  try {
    const hex = fs.readFileSync(KEY_FILE, "utf8").trim();
    if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, "hex");
    throw new Error(`${KEY_FILE} is not a valid key file.`);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const hex = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(KEY_FILE, hex, { mode: 0o600 });
  console.log(`Created a new encryption key at ${KEY_FILE}. Back it up: without it, saved records can't be read.`);
  return Buffer.from(hex, "hex");
}

let key = null;
const getKey = () => (key ??= loadKey());

// `aad` ties the ciphertext to one tourist, so a blob can't be moved to another.
export function encryptJson(obj, aad) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ct: ct.toString("base64") };
}

export function decryptJson(blob, aad) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(blob.iv, "base64"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  const pt = Buffer.concat([decipher.update(Buffer.from(blob.ct, "base64")), decipher.final()]);
  return JSON.parse(pt.toString("utf8"));
}
