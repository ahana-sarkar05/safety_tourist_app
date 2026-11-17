// End-to-end test of the whole Digital Tourist ID backend against a REAL local
// blockchain. Start the chain first (in another terminal):
//
//     cd blockchain && npm run chain
//
// then:   cd tracker && npm test
//
// It starts its own backend on port 8120 with temporary data files, deploys a
// fresh contract, and never touches your real data.

import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import { hashPayload, identityPayload } from "../integrity.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const PORT = 8120;
const B = `http://127.0.0.1:${PORT}`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tourist-e2e-"));
const files = {
  DATA_FILE: path.join(tmp, "sessions.json"),
  IDENTITY_FILE: path.join(tmp, "identities.json"),
  KEY_FILE: path.join(tmp, "secret.key"),
  DEPLOYMENT_FILE: path.join(tmp, "deployment.json"),
};

// ---------- make sure a chain is running, deploy a fresh contract ----------
const provider = new ethers.JsonRpcProvider(RPC);
try {
  await provider.getNetwork();
} catch {
  console.error(`No blockchain at ${RPC}. Start it first:  cd blockchain && npm run chain`);
  process.exit(1);
}
const deploy = spawnSync("node", [path.join(here, "..", "..", "blockchain", "scripts", "deploy.mjs")], {
  env: { ...process.env, RPC_URL: RPC, DEPLOYMENT_FILE: files.DEPLOYMENT_FILE },
  encoding: "utf8",
});
if (deploy.status !== 0) {
  console.error(deploy.stdout, deploy.stderr);
  process.exit(1);
}
const deployment = JSON.parse(fs.readFileSync(files.DEPLOYMENT_FILE, "utf8"));
const registry = new ethers.Contract(
  deployment.address,
  [
    "function getIdentity(string) view returns (bool exists, bytes32 hash, uint64 timestamp, uint8 status)",
    "function getRecord(string, bytes32) view returns (bool exists, bytes32 hash, uint64 timestamp)",
  ],
  provider
);

// ---------- backend process ----------
let server = null;
function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn("node", [path.join(here, "..", "server.mjs")], {
      env: { ...process.env, PORT: String(PORT), DEMO_MODE: "1", ...files },
    });
    let out = "";
    server.stdout.on("data", (d) => {
      out += d;
      if (out.includes("Blockchain:") && out.includes("\n")) resolve(out);
    });
    server.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));
    server.on("exit", (c) => c && reject(new Error(`server exited with ${c}`)));
  });
}
const stopServer = () =>
  new Promise((resolve) => {
    if (!server) return resolve();
    server.once("exit", () => resolve());
    server.kill();
    server = null;
  });

// ---------- tiny helpers ----------
const api = async (method, p, { token, body } = {}) => {
  const res = await fetch(B + p, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};
const until = async (fn, what, ms = 20_000) => {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 400));
  }
  assert.fail(`Timed out waiting for: ${what}`);
};
let passed = 0;
const ok = (name) => {
  passed++;
  console.log("  ✓", name);
};
const readDb = () => JSON.parse(fs.readFileSync(files.IDENTITY_FILE, "utf8"));
const verify = async (id) => (await api("GET", `/api/verify/${id}`)).json;
const PASSWORD = "Passw0rd-test";
let emailCounter = 0;
// Signing up creates the account AND the Tourist ID. `ownerToken` is the login token.
const signup = async (fullName, nationality, email = `user${++emailCounter}@example.com`) => {
  const r = await api("POST", "/api/auth/signup", { body: { fullName, email, password: PASSWORD, nationality } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return { touristId: r.json.profile.touristId, ownerToken: r.json.token, profile: r.json.profile, email };
};

try {
  const banner = await startServer();
  assert.match(banner, /Blockchain: connected/);
  ok("backend started and connected to the blockchain");

  const chainInfo = (await api("GET", "/api/chain")).json;
  assert.equal(chainInfo.available, true);
  assert.equal(chainInfo.contract, deployment.address);
  ok("/api/chain reports the deployed contract");

  // ===== sign up (creates the ID), fingerprint, anchor on chain =====
  const abida = await signup("Abida Khan", "Indian", "abida@example.com");
  const id = abida.touristId;
  assert.match(id, /^TOURIST-\d{4}-001$/);
  assert.match(abida.profile.fingerprint, /^[0-9a-f]{64}$/);
  ok("signed up: the account and a unique Tourist ID with a SHA-256 fingerprint are created together");

  // ===== Accounts: validation, hashed passwords, login on any device, logout =====
  const body = (o = {}) => ({ fullName: "Test Person", email: "test@example.com", password: PASSWORD, nationality: "Indian", ...o });
  const badSignup = async (o, label) => {
    const r = await api("POST", "/api/auth/signup", { body: body(o) });
    assert.equal(r.status, 400, label);
    assert.ok(r.json.error, label);
  };
  await badSignup({ email: "not-an-email" }, "bad email");
  await badSignup({ email: "" }, "no email");
  await badSignup({ password: "short1" }, "short password");
  await badSignup({ password: "onlyletters" }, "no digit");
  await badSignup({ password: "12345678" }, "no letter");
  await badSignup({ password: `${"x".repeat(129)}1` }, "too long");
  await badSignup({ fullName: "" }, "no name");
  await badSignup({ nationality: "" }, "no nationality");
  assert.equal((await api("POST", "/api/identity/register", { body: { fullName: "Old Way", nationality: "Xx" } })).status, 404);
  ok("sign-up validates email, password strength, name and nationality; open registration no longer exists");

  const dup = await api("POST", "/api/auth/signup", { body: body({ email: "ABIDA@Example.com", fullName: "Copycat" }) });
  assert.equal(dup.status, 409);
  ok("an email can only sign up once (case-insensitive)");

  const onDisk = fs.readFileSync(files.IDENTITY_FILE, "utf8");
  assert.ok(onDisk.includes("scrypt$") && !onDisk.includes(PASSWORD), "password stored only as a scrypt hash");
  assert.ok(!onDisk.includes(abida.ownerToken), "login token itself is never stored");
  ok("passwords are stored only as salted scrypt hashes; login tokens only as hashes");

  const wrong = await api("POST", "/api/auth/login", { body: { email: "abida@example.com", password: "Wrong-pass1" } });
  const nobody = await api("POST", "/api/auth/login", { body: { email: "nobody@example.com", password: "Wrong-pass1" } });
  assert.equal(wrong.status, 401);
  assert.equal(nobody.status, 401);
  assert.equal(wrong.json.error, nobody.json.error);
  ok("wrong password and unknown email give the same answer (no account probing)");

  const device2 = await api("POST", "/api/auth/login", { body: { email: "ABIDA@EXAMPLE.COM", password: PASSWORD } });
  assert.equal(device2.status, 200);
  assert.equal(device2.json.profile.touristId, id);
  assert.notEqual(device2.json.token, abida.ownerToken);
  assert.equal((await api("GET", `/api/identity/${id}`, { token: device2.json.token })).status, 200);
  assert.equal((await api("GET", `/api/identity/${id}`, { token: abida.ownerToken })).status, 200);
  assert.equal((await api("GET", "/api/auth/me", { token: device2.json.token })).json.email, "abida@example.com");
  ok("logging in on a second device brings back the same Tourist ID; both devices work");

  await api("POST", "/api/auth/logout", { token: device2.json.token });
  assert.equal((await api("GET", "/api/auth/me", { token: device2.json.token })).status, 401);
  assert.equal((await api("GET", `/api/identity/${id}`, { token: device2.json.token })).status, 401);
  assert.equal((await api("GET", "/api/auth/me", { token: abida.ownerToken })).status, 200);
  ok("logging out ends only that device's session");

  assert.equal((await api("GET", `/api/identity/${id}`)).status, 401);
  assert.equal((await api("GET", `/api/identity/${id}`, { token: "garbage" })).status, 401);
  ok("owner routes answer 401 without a valid login");

  const v1 = await until(async () => {
    const v = await verify(id);
    return v.status === "verified" ? v : null;
  }, "identity to be anchored and verified");
  assert.deepEqual(v1.checks.map((c) => c.ok), [true, true, true, true, true]);
  ok("anchored on the blockchain and verified (all 5 checks pass)");

  // Independent proof: read the contract directly and recompute the hash ourselves.
  const stored = readDb().identities[id];
  const recomputed = hashPayload(identityPayload(stored));
  const [exists, onChainHash, ts, status] = await registry.getIdentity(id);
  assert.ok(exists);
  assert.equal(onChainHash.slice(2), recomputed);
  assert.equal(Number(status), 1);
  assert.ok(ts > 0n);
  ok("independent check: recomputed SHA-256 equals the hash stored in the smart contract");

  // Privacy: nothing personal on chain or in the public verify response.
  const publicText = JSON.stringify(v1);
  for (const secret of ["Khan", "abida@example.com", "passwordHash", stored.salt]) {
    assert.ok(!publicText.includes(secret), `public verify must not leak ${secret}`);
  }
  assert.equal(v1.displayName, "Abida K.");
  const txs = await provider.getBlockNumber();
  for (let b = 1; b <= txs; b++) {
    const block = await provider.getBlock(b, true);
    for (const tx of block.prefetchedTransactions ?? []) {
      const data = Buffer.from(tx.data.slice(2), "hex").toString("latin1");
      assert.ok(!/Khan|Abida|abida@|Indian/.test(data), "no personal data in any transaction");
    }
  }
  ok("privacy: no name, email or nationality on the blockchain or in the public response");

  // ===== Stage 4: tamper detection =====
  // (a) someone edits the record in the database
  assert.equal((await api("POST", `/api/demo/tamper/${id}`)).status, 200);
  const failed = await verify(id);
  assert.equal(failed.status, "failed");
  assert.equal(failed.checks.find((c) => c.id === "database").ok, false);
  assert.equal(failed.checks.find((c) => c.id === "blockchain").ok, false);
  ok("tamper demo: editing the record makes verification FAIL");
  await api("POST", `/api/demo/restore/${id}`);
  assert.equal((await verify(id)).status, "verified");
  ok("restoring the record makes it verify again");

  // (b) a smarter attacker edits the name AND the stored hash so the database is self-consistent
  const john = await signup("John Smith", "British");
  await until(async () => (await verify(john.touristId)).status === "verified", "john verified");
  await stopServer();
  const db = readDb();
  const victim = db.identities[john.touristId];
  victim.fullName = "Jon Forged";
  victim.recordHash = hashPayload(identityPayload(victim)); // attacker "fixes" the stored hash too
  fs.writeFileSync(files.IDENTITY_FILE, JSON.stringify(db, null, 2));
  await startServer();
  const forged = await verify(john.touristId);
  assert.equal(forged.checks.find((c) => c.id === "database").ok, true, "database is self-consistent");
  assert.equal(forged.checks.find((c) => c.id === "blockchain").ok, false, "but the blockchain disagrees");
  assert.equal(forged.status, "failed");
  ok("a forger who also rewrites the database hash is STILL caught, by the blockchain");

  // ===== not found / garbage =====
  assert.equal((await verify("TOURIST-2026-999")).status, "not_found");
  assert.equal((await verify("not-an-id")).status, "not_found");
  ok("unknown or malformed IDs report not_found");

  // ===== Travel records =====
  const token = abida.ownerToken;
  const bad = async (data, label) => {
    const r = await api("POST", `/api/identity/${id}/records`, { token, body: { type: "travel_permit", data } });
    assert.equal(r.status, 400, label);
  };
  await bad({ kind: "visa", title: "x", reference: "y" }, "bad kind");
  await bad({ kind: "permit", title: "", reference: "R-1" }, "empty title");
  await bad({ kind: "permit", title: "Park permit", reference: "" }, "empty reference");
  await bad({ kind: "permit", title: "Park permit", reference: "R-1", validFrom: "31-12-2026" }, "bad date format");
  await bad({ kind: "permit", title: "Park permit", reference: "R-1", validFrom: "2026-02-30" }, "impossible date");
  await bad({ kind: "permit", title: "Park permit", reference: "R-1", validFrom: "2026-12-31", validTo: "2026-12-01" }, "end before start");
  assert.equal((await api("POST", `/api/identity/${id}/records`, { token, body: { type: "emergency_update", data: {} } })).status, 400);
  ok("travel record validation rejects bad input (and system-only types)");

  const created = await api("POST", `/api/identity/${id}/records`, {
    token,
    body: { type: "travel_permit", data: { kind: "permit", title: "Chilika lake permit", reference: "CL-2026-77", validFrom: "2026-11-05", validTo: "2026-11-12" } },
  });
  assert.equal(created.status, 201);
  const recId = created.json.recordId;
  const listed = await until(async () => {
    const l = (await api("GET", `/api/identity/${id}/records`, { token })).json.records;
    return l.find((r) => r.recordId === recId && r.status === "verified") ? l : null;
  }, "record verified");
  const item = listed.find((r) => r.recordId === recId);
  assert.equal(item.summary, "Travel permit: Chilika lake permit");
  assert.equal(item.details.reference, "CL-2026-77");
  const [rExists, rHash] = await registry.getRecord(id, ethers.id(recId));
  assert.ok(rExists);
  assert.equal(rHash.slice(2), item.fingerprint);
  ok("travel record saved, anchored, and its on-chain hash matches");

  for (const [kind, title, label] of [["flight", "Flight to Delhi", "Flight booking"], ["hotel", "Taj Hotel stay", "Hotel reservation"]]) {
    const r = await api("POST", `/api/identity/${id}/records`, { token, body: { type: "travel_permit", data: { kind, title, reference: "REF-1", validFrom: "2026-11-10" } } });
    assert.equal(r.status, 201, kind);
    const rows = await until(async () => {
      const l = (await api("GET", `/api/identity/${id}/records`, { token })).json.records;
      const row = l.find((x) => x.recordId === r.json.recordId);
      return row?.status === "verified" ? row : null;
    }, `${kind} verified`);
    assert.equal(rows.summary, `${label}: ${title}`);
  }
  ok("flight and hotel records are saved, anchored and labelled");

  assert.equal((await api("GET", `/api/identity/${id}/records`, { token: john.ownerToken })).status, 404);
  assert.equal((await api("GET", `/api/identity/${id}/records`)).status, 401);
  ok("records are private: someone else's login gets 404, no login gets 401");

  const pubRecords = (await verify(id)).records;
  assert.equal(pubRecords.length, 3);
  assert.deepEqual(Object.keys(pubRecords[0]).sort(), ["createdAt", "kind", "status", "type"]);
  assert.ok(!JSON.stringify(pubRecords).includes("Chilika"));
  ok("public verification shows record status only, never contents");

  await api("POST", `/api/demo/tamper/${id}`, { body: { recordId: recId } });
  assert.equal((await api("GET", `/api/identity/${id}/records`, { token })).json.records.find((r) => r.recordId === recId).status, "tampered");
  assert.ok((await verify(id)).records.some((r) => r.status === "tampered"));
  await api("POST", `/api/demo/restore/${id}`);
  assert.equal((await api("GET", `/api/identity/${id}/records`, { token })).json.records.find((r) => r.recordId === recId).status, "verified");
  ok("a tampered travel record is flagged, and verifies again once restored");

  // the stored file never contains record contents in plain text
  const fileText = fs.readFileSync(files.IDENTITY_FILE, "utf8");
  assert.ok(!fileText.includes("Chilika") && !fileText.includes("CL-2026-77"));
  ok("record contents are encrypted at rest");

  // ===== Stage 5: emergency information & permission-based sharing =====
  const emergencyBad = await api("PUT", `/api/identity/${id}/emergency`, { token, body: { contactName: "A", contactPhone: "123" } });
  assert.equal(emergencyBad.status, 400);
  const put = await api("PUT", `/api/identity/${id}/emergency`, {
    token,
    body: { contactName: "Rahim Khan", contactPhone: "+91 91234 56789", notes: "Allergic to penicillin" },
  });
  assert.equal(put.status, 200);
  const got = (await api("GET", `/api/identity/${id}/emergency`, { token })).json;
  assert.equal(got.info.contactName, "Rahim Khan");
  assert.equal(got.info.contactPhone, "+919123456789");
  assert.ok(!fs.readFileSync(files.IDENTITY_FILE, "utf8").includes("penicillin"));
  ok("emergency information saved (validated, normalised, encrypted at rest)");

  const noAccess = await api("POST", "/api/emergency/access", { body: { touristId: id, code: "ABCD-EFGH" } });
  assert.equal(noAccess.status, 403);
  assert.ok(!JSON.stringify(noAccess.json).includes("Rahim"));
  ok("without a code, emergency information stays closed");

  const grant = await api("POST", `/api/identity/${id}/grants`, { token, body: { label: "Dr. Mehta", hours: 6 } });
  assert.equal(grant.status, 201);
  assert.match(grant.json.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.ok(!fs.readFileSync(files.IDENTITY_FILE, "utf8").includes(grant.json.code.replace("-", "")));
  ok("access code created; only its hash is stored");

  const opened = await api("POST", "/api/emergency/access", { body: { touristId: id, code: grant.json.code.toLowerCase().replace("-", " ") } });
  assert.equal(opened.status, 200);
  assert.equal(opened.json.emergency.contactName, "Rahim Khan");
  assert.equal(opened.json.emergency.notes, "Allergic to penicillin");
  assert.equal(opened.json.fullName, "Abida Khan");
  ok("a trusted person with the code can open the emergency information");

  const grants = (await api("GET", `/api/identity/${id}/grants`, { token })).json.grants;
  assert.equal(grants[0].uses, 1);
  assert.ok(grants[0].lastUsedAt);
  assert.equal(grants[0].active, true);
  ok("the owner can see that the code was used");

  const consent = await until(async () => {
    const l = (await api("GET", `/api/identity/${id}/records`, { token })).json.records;
    const c = l.find((r) => r.type === "consent_grant");
    return c && c.status === "verified" ? c : null;
  }, "consent anchored");
  assert.equal(consent.summary, "Access granted: Dr. Mehta");
  ok("the permission itself is anchored on the blockchain as proof");

  const audit = await until(async () => {
    const l = (await api("GET", `/api/identity/${id}/records`, { token })).json.records;
    return l.find((r) => r.type === "emergency_access" && r.status === "verified") ?? null;
  }, "access audit record anchored");
  assert.equal(audit.summary, "Emergency information opened: Dr. Mehta");
  const [aExists, aHash] = await registry.getRecord(id, ethers.id(audit.recordId));
  assert.ok(aExists);
  assert.equal(aHash.slice(2), audit.fingerprint);
  ok("audit trail: opening emergency information is itself anchored on the blockchain");

  const revoked = await api("DELETE", `/api/identity/${id}/grants/${grant.json.grantId}`, { token });
  assert.equal(revoked.status, 200);
  assert.equal((await api("POST", "/api/emergency/access", { body: { touristId: id, code: grant.json.code } })).status, 403);
  await until(async () => {
    const l = (await api("GET", `/api/identity/${id}/records`, { token })).json.records;
    return l.find((r) => r.type === "consent_revoke" && r.status === "verified");
  }, "revocation anchored");
  ok("revoking cuts off access immediately, and the revocation is anchored too");

  // sessions expire (set up before the restart below)
  const eve = await signup("Eve Adams", "Canadian", "eve@example.com");
  // an expired code stops working (edit the clock in the stored grant, then restart)
  const g2 = await api("POST", `/api/identity/${id}/grants`, { token, body: { label: "Short", hours: 1 } });
  await stopServer();
  const db2 = readDb();
  db2.grants[g2.json.grantId].expiresAt = new Date(Date.now() - 60_000).toISOString();
  for (const sess of Object.values(db2.sessions)) {
    if (sess.touristId === eve.touristId) sess.expiresAt = new Date(Date.now() - 60_000).toISOString(); // Eve's session ran out
  }
  fs.writeFileSync(files.IDENTITY_FILE, JSON.stringify(db2, null, 2));
  await startServer();
  assert.equal((await api("POST", "/api/emergency/access", { body: { touristId: id, code: g2.json.code } })).status, 403);
  ok("an expired code is refused");
  assert.equal((await api("GET", `/api/identity/${eve.touristId}`, { token: eve.ownerToken })).status, 401);
  const eveAgain = await api("POST", "/api/auth/login", { body: { email: "eve@example.com", password: PASSWORD } });
  assert.equal(eveAgain.status, 200);
  assert.equal((await api("GET", `/api/identity/${eve.touristId}`, { token: eveAgain.json.token })).status, 200);
  ok("an expired login session is refused (401), and logging in again restores access");

  assert.equal((await api("POST", `/api/identity/${id}/grants`, { token, body: { hours: 500 } })).status, 400);
  assert.equal((await api("POST", `/api/identity/${id}/grants`, { token, body: { hours: 0 } })).status, 400);
  ok("grant duration is limited to 1 hour .. 7 days");

  // brute force protection (uses a separate tourist so the lockout can't affect the tests above)
  const carol = await signup("Carol Diaz", "Spanish");
  await api("PUT", `/api/identity/${carol.touristId}/emergency`, { token: carol.ownerToken, body: { contactName: "Luis Diaz", contactPhone: "+34600111222" } });
  const carolGrant = await api("POST", `/api/identity/${carol.touristId}/grants`, { token: carol.ownerToken, body: { hours: 2 } });
  for (let i = 0; i < 5; i++) {
    assert.equal((await api("POST", "/api/emergency/access", { body: { touristId: carol.touristId, code: `AAAA-BBB${i + 2}` } })).status, 403);
  }
  const locked = await api("POST", "/api/emergency/access", { body: { touristId: carol.touristId, code: carolGrant.json.code } });
  assert.equal(locked.status, 429, "even the right code is refused during lockout");
  ok("5 wrong codes lock emergency access (brute-force protection)");

  // password guessing is throttled
  await signup("Lock Test", "French", "lock@example.com");
  for (let i = 0; i < 5; i++) {
    assert.equal((await api("POST", "/api/auth/login", { body: { email: "lock@example.com", password: `Wrong-guess${i}` } })).status, 401);
  }
  assert.equal((await api("POST", "/api/auth/login", { body: { email: "lock@example.com", password: PASSWORD } })).status, 429, "even the right password is refused during lockout");
  ok("5 wrong passwords lock that account's login for a while (brute-force protection)");

  // ===== revocation of an identity =====
  const dave = await signup("Dave Okoye", "Nigerian");
  await until(async () => (await verify(dave.touristId)).status === "verified", "dave verified");
  assert.equal((await api("POST", `/api/identity/${dave.touristId}/revoke`, { token: dave.ownerToken })).status, 200);
  assert.equal((await verify(dave.touristId)).status, "revoked");
  await until(async () => (await registry.getIdentity(dave.touristId))[3] === 2n, "revocation on chain");
  assert.equal((await api("POST", `/api/identity/${dave.touristId}/records`, { token: dave.ownerToken, body: { type: "travel_permit", data: { kind: "permit", title: "Nope", reference: "X-1" } } })).status, 403);
  ok("a revoked ID shows as revoked, is revoked on-chain, and can't add records");

  // ===== ID is owner-only =====
  assert.equal((await api("GET", `/api/identity/${id}`, { token: john.ownerToken })).status, 404);
  assert.equal((await api("GET", `/api/identity/${id}`, { token })).status, 200);
  ok("profile is owner-only");

  // ===== demo tools are off unless DEMO_MODE=1 =====
  await stopServer();
  await new Promise((resolve) => {
    const s = spawn("node", [path.join(here, "..", "server.mjs")], { env: { ...process.env, PORT: String(PORT), ...files, DEMO_MODE: "" } });
    server = s;
    s.stdout.on("data", async (d) => {
      if (!String(d).includes("Blockchain:")) return;
      const r = await api("POST", `/api/demo/tamper/${id}`);
      assert.equal(r.status, 404);
      assert.equal((await verify(id)).demoMode, false);
      resolve();
    });
  });
  ok("tamper tools do not exist unless DEMO_MODE is on");

  console.log(`\nAll ${passed} end-to-end checks passed.`);
} catch (e) {
  console.error("\nFAILED:", e.message ?? e);
  // Show anything the anchoring service couldn't put on the chain: usually the clue.
  try {
    const d = readDb();
    const stuck = [
      ...Object.values(d.identities).flatMap((r) => [["identity " + r.touristId, r.anchor], ["revoke " + r.touristId, r.revokeAnchor]]),
      ...Object.values(d.records).map((r) => [`${r.type} ${r.recordId.slice(0, 8)} (${r.touristId})`, r.anchor]),
    ].filter(([, a]) => a && a.status !== "anchored");
    if (stuck.length) console.error("Items not anchored:", JSON.stringify(stuck, null, 1));
  } catch {
    /* no database to inspect */
  }
  process.exitCode = 1;
} finally {
  await stopServer();
  fs.rmSync(tmp, { recursive: true, force: true });
}
