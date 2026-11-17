// Tests the contract against a running local chain.
//   terminal 1: npm run chain       terminal 2: npm test
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const { abi, bytecode } = JSON.parse(fs.readFileSync(path.join(root, "artifacts", "TouristRegistry.json"), "utf8"));

const provider = new ethers.JsonRpcProvider(RPC_URL);
try { await provider.getNetwork(); } catch { console.error(`No chain at ${RPC_URL}. Run \`npm run chain\` first.`); process.exit(1); }

const [issuer, stranger, newIssuer] = [await provider.getSigner(0), await provider.getSigner(1), await provider.getSigner(2)];
const registry = await (await new ethers.ContractFactory(abi, bytecode, issuer).deploy()).waitForDeployment();
const as = (signer) => registry.connect(signer);

const H1 = ethers.sha256(ethers.toUtf8Bytes("record one"));
const H2 = ethers.sha256(ethers.toUtf8Bytes("record two"));
const R1 = ethers.id("record-1");
const ID = "TOURIST-2026-001";

// The node reports a custom-error revert in differently shaped error objects
// depending on the call, so search the whole error for revert data and decode
// it with the contract ABI.
function revertName(e) {
  if (e.revert?.name) return e.revert.name;
  const seen = new Set();
  const found = [];
  const walk = (v, depth = 0) => {
    if (v == null || depth > 6 || seen.has(v)) return;
    if (typeof v === "string") { for (const m of v.matchAll(/0x[0-9a-fA-F]{8,}/g)) found.push(m[0]); return; }
    if (typeof v === "object") { seen.add(v); for (const k of Object.getOwnPropertyNames(v)) { try { walk(v[k], depth + 1); } catch {} } }
  };
  walk(e);
  for (const hex of found) {
    try { const parsed = registry.interface.parseError(hex); if (parsed) return parsed.name; } catch {}
  }
  return e.shortMessage ?? e.message;
}

async function reverts(promise, errorName) {
  try { await promise; } catch (e) {
    const name = revertName(e);
    assert.equal(name, errorName, `expected revert ${errorName}, got ${name}`);
    return;
  }
  assert.fail(`expected revert ${errorName}, but it succeeded`);
}
const tx = async (p) => (await p).wait();
let passed = 0; const ok = (name) => { passed++; console.log("  ✓", name); };

assert.equal(await registry.issuer(), await issuer.getAddress()); ok("deployer is the issuer");

// --- identities
await reverts(as(stranger).registerIdentity(ID, H1), "NotIssuer"); ok("a stranger cannot register identities");
await reverts(registry.registerIdentity("", H1), "EmptyId"); ok("empty ID rejected");
await reverts(registry.registerIdentity(ID, ethers.ZeroHash), "EmptyHash"); ok("empty hash rejected");

const receipt = await tx(registry.registerIdentity(ID, H1));
const [exists, hash, ts, status] = await registry.getIdentity(ID);
assert.ok(exists); assert.equal(hash, H1); assert.equal(Number(status), 1); assert.ok(ts > 0n);
assert.equal(receipt.logs.length, 1); assert.equal(registry.interface.parseLog(receipt.logs[0]).name, "IdentityRegistered");
ok("identity registered with its hash, timestamp, Active status and an event");

await reverts(registry.registerIdentity(ID, H2), "AlreadyRegistered"); ok("an ID cannot be registered twice (no silent overwrite)");
assert.equal((await registry.getIdentity(ID))[1], H1); ok("original hash untouched after the failed overwrite");

const unknown = await registry.getIdentity("TOURIST-2026-999");
assert.equal(unknown[0], false); assert.equal(Number(unknown[3]), 0); ok("unknown ID reads as non-existent");

// --- records
await reverts(as(stranger).anchorRecord(ID, R1, H2), "NotIssuer"); ok("a stranger cannot anchor records");
await reverts(registry.anchorRecord("TOURIST-2026-999", R1, H2), "UnknownIdentity"); ok("records need an existing identity");
await reverts(registry.anchorRecord(ID, R1, ethers.ZeroHash), "EmptyHash"); ok("empty record hash rejected");
await tx(registry.anchorRecord(ID, R1, H2));
const rec = await registry.getRecord(ID, R1);
assert.ok(rec[0]); assert.equal(rec[1], H2); assert.ok(rec[2] > 0n);
assert.equal(await registry.recordCount(ID), 1n); ok("record anchored and counted");
await reverts(registry.anchorRecord(ID, R1, H1), "AlreadyAnchored"); ok("an anchored record cannot be replaced");
assert.equal((await registry.getRecord(ID, R1))[1], H2); ok("anchored hash unchanged after replacement attempt");
assert.equal((await registry.getRecord(ID, ethers.id("nope")))[0], false); ok("unknown record reads as non-existent");

// --- revocation
await reverts(as(stranger).revokeIdentity(ID), "NotIssuer"); ok("a stranger cannot revoke");
await reverts(registry.revokeIdentity("TOURIST-2026-999"), "UnknownIdentity"); ok("cannot revoke an unknown ID");
await tx(registry.revokeIdentity(ID));
const after = await registry.getIdentity(ID);
assert.equal(Number(after[3]), 2); assert.equal(after[1], H1); ok("revoked: status Revoked, hash kept for the record");
await reverts(registry.revokeIdentity(ID), "IdentityNotActive"); ok("cannot revoke twice");
await reverts(registry.anchorRecord(ID, ethers.id("r2"), H2), "IdentityNotActive"); ok("no new records for a revoked identity");

// --- issuer transfer
await reverts(as(stranger).transferIssuer(await stranger.getAddress()), "NotIssuer"); ok("a stranger cannot take over");
await reverts(registry.transferIssuer(ethers.ZeroAddress), "ZeroAddress"); ok("cannot transfer to the zero address");
await tx(registry.transferIssuer(await newIssuer.getAddress()));
await reverts(registry.registerIdentity("TOURIST-2026-002", H1), "NotIssuer"); ok("old issuer loses write access");
await tx(as(newIssuer).registerIdentity("TOURIST-2026-002", H1)); ok("new issuer can write");

// --- no personal data on chain: the only strings stored are IDs
const code = await provider.getCode(await registry.getAddress());
assert.ok(!/name|phone|passport/i.test(Buffer.from(code.slice(2), "hex").toString("latin1")));
ok("contract holds no personal-data fields");

console.log(`\nAll ${passed} contract checks passed.`);
