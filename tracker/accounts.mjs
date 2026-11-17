// Accounts. Signing up creates the person's account AND their Digital Tourist ID
// in one step; logging in (on any device) gets that same ID back.
//
//   POST /api/auth/signup   { fullName, email, password, nationality }
//   POST /api/auth/login    { email, password }
//   POST /api/auth/logout   (Bearer token)
//   GET  /api/auth/me       (Bearer token)
//
// Passwords are stored only as salted scrypt hashes. A login token is random;
// only its SHA-256 is stored.

import crypto from "node:crypto";
import { promisify } from "node:util";
import { scheduleAnchoring } from "./anchoring.mjs";
import { createIdentity, profileOf, validateRegistration } from "./identity.mjs";
import { createLimiter } from "./ratelimit.mjs";
import { SESSION_DAYS, bearer, db, purgeSessions, save, sessionOf, sha256 } from "./store.mjs";

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const MAX_SESSIONS_PER_ACCOUNT = 10;
const LOCK_AFTER_FAILURES = 5;
const LOCK_MINUTES = 10;

// ---------- passwords ----------
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function checkPassword(password, stored) {
  const [scheme, N, r, p, saltHex, keyHex] = String(stored).split("$");
  if (scheme !== "scrypt") return false;
  const expected = Buffer.from(keyHex, "hex");
  const key = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

// Unknown emails get a real (wasted) hash check, so a login takes about the
// same time whether or not the account exists.
const DUMMY_HASH = await hashPassword("not-a-real-password-1");

// ---------- validation ----------
export function normalizeEmail(raw) {
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

export function passwordProblem(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must be 8 to 128 characters and include a letter and a number.";
  }
  return null;
}

// ---------- sessions ----------
function startSession(account) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  const mine = Object.entries(db.sessions)
    .filter(([, s]) => s.accountId === account.accountId)
    .sort((a, b) => Date.parse(a[1].createdAt) - Date.parse(b[1].createdAt));
  while (mine.length >= MAX_SESSIONS_PER_ACCOUNT) delete db.sessions[mine.shift()[0]]; // oldest device signs out
  const expiresAt = new Date(now + SESSION_DAYS * 86_400_000).toISOString();
  db.sessions[sha256(token)] = {
    accountId: account.accountId,
    touristId: account.touristId,
    createdAt: new Date(now).toISOString(),
    expiresAt,
  };
  return { token, expiresAt };
}

const accountReply = (account, session) => ({
  token: session.token,
  expiresAt: session.expiresAt,
  email: account.email,
  profile: profileOf(db.identities[account.touristId]),
});

// ---------- routes ----------
export function createAuthHandler({ json, readBody, clientIp }) {
  purgeSessions();
  setInterval(purgeSessions, 3600_000).unref();

  // Sign-ups per hour from one address. Raise it (SIGNUP_LIMIT_PER_HOUR) for a
  // demo where many people share one public IP, e.g. a classroom.
  const signupLimit = createLimiter({ max: Number(process.env.SIGNUP_LIMIT_PER_HOUR) || 10, windowMs: 3600_000 });
  const loginIpLimit = createLimiter({ max: 40, windowMs: 10 * 60_000 });
  const failures = new Map(); // email -> { count, until }

  return async function handle(req, res, pathname) {
    // ---------- sign up ----------
    if (req.method === "POST" && pathname === "/api/auth/signup") {
      const body = await readBody(req);

      const email = normalizeEmail(body?.email);
      if (!email) return json(res, 400, { error: "Enter a valid email address." }), true;
      const problem = passwordProblem(body?.password);
      if (problem) return json(res, 400, { error: problem }), true;
      const details = validateRegistration({ fullName: body?.fullName, nationality: body?.nationality, phone: "" });
      if (details.error) return json(res, 400, { error: details.error }), true;
      // Malformed requests cost nothing, so only well-formed ones count against the limit.
      if (!signupLimit.take(clientIp(req))) return json(res, 429, { error: "Too many sign-ups from here. Try again later." }), true;
      if (db.accounts[email]) {
        return json(res, 409, { error: "An account with this email already exists. Try logging in." }), true;
      }

      const passwordHash = await hashPassword(body.password);
      if (db.accounts[email]) return json(res, 409, { error: "An account with this email already exists. Try logging in." }), true; // raced while hashing

      // The Tourist ID is created together with the account.
      const identity = createIdentity(details.value);
      const account = {
        accountId: crypto.randomUUID(),
        email,
        passwordHash,
        touristId: identity.touristId,
        createdAt: new Date().toISOString(),
      };
      db.accounts[email] = account;
      const session = startSession(account);
      save();
      scheduleAnchoring();

      json(res, 201, accountReply(account, session));
      return true;
    }

    // ---------- log in ----------
    if (req.method === "POST" && pathname === "/api/auth/login") {
      if (!loginIpLimit.take(clientIp(req))) return json(res, 429, { error: "Too many attempts. Try again in a few minutes." }), true;
      const body = await readBody(req);
      const email = normalizeEmail(body?.email);
      const password = typeof body?.password === "string" ? body.password.slice(0, 128) : "";

      if (email) {
        const lock = failures.get(email);
        if (lock && lock.until > Date.now()) {
          return json(res, 429, { error: `Too many wrong passwords. Try again in ${LOCK_MINUTES} minutes.` }), true;
        }
      }

      const account = email ? db.accounts[email] : null;
      const ok = account ? await checkPassword(password, account.passwordHash) : (await checkPassword(password, DUMMY_HASH), false);

      if (!ok) {
        if (email) {
          const f = failures.get(email) ?? { count: 0, until: 0 };
          f.count += 1;
          if (f.count >= LOCK_AFTER_FAILURES) {
            f.until = Date.now() + LOCK_MINUTES * 60_000;
            f.count = 0;
          }
          failures.set(email, f);
          if (failures.size > 10_000) failures.clear(); // bound memory
        }
        // Same message whether the email exists or not.
        return json(res, 401, { error: "Incorrect email or password." }), true;
      }

      failures.delete(email);
      const session = startSession(account);
      save();
      json(res, 200, accountReply(account, session));
      return true;
    }

    // ---------- log out ----------
    if (req.method === "POST" && pathname === "/api/auth/logout") {
      const token = bearer(req);
      if (token && db.sessions[sha256(token)]) {
        delete db.sessions[sha256(token)];
        save();
      }
      json(res, 200, { ok: true });
      return true;
    }

    // ---------- who am I ----------
    if (req.method === "GET" && pathname === "/api/auth/me") {
      const s = sessionOf(req);
      if (!s) return json(res, 401, { error: "Please log in again." }), true;
      const account = Object.values(db.accounts).find((a) => a.accountId === s.accountId);
      const identity = db.identities[s.touristId];
      if (!account || !identity) return json(res, 401, { error: "Please log in again." }), true;
      json(res, 200, { email: account.email, profile: profileOf(identity) });
      return true;
    }

    return false;
  };
}
