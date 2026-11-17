// Talks to the TouristRegistry smart contract (see ../blockchain).
//
// Everything here is designed so that a missing, stopped or reset blockchain
// never breaks the app: callers get a clear "unavailable" answer and records
// simply stay "pending" until the chain is back (see anchoring.mjs).
//
// deployment.json is re-read whenever it changes, so redeploying the contract
// (which you do after restarting the local test chain) needs no backend restart.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEPLOYMENT_FILE =
  process.env.DEPLOYMENT_FILE ?? path.join(here, "..", "blockchain", "deployment.json");

// First account of every local Hardhat node: public knowledge, fake coins only.
// Used ONLY when the RPC address is local. Real networks need ISSUER_PRIVATE_KEY.
const LOCAL_TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const ABI = [
  "function registerIdentity(string touristId, bytes32 hash)",
  "function revokeIdentity(string touristId)",
  "function anchorRecord(string touristId, bytes32 recordId, bytes32 hash)",
  "function getIdentity(string touristId) view returns (bool exists, bytes32 hash, uint64 timestamp, uint8 status)",
  "function getRecord(string touristId, bytes32 recordId) view returns (bool exists, bytes32 hash, uint64 timestamp)",
  "error NotIssuer()",
  "error AlreadyRegistered()",
  "error UnknownIdentity()",
  "error IdentityNotActive()",
  "error AlreadyAnchored()",
  "error EmptyHash()",
  "error EmptyId()",
  "error ZeroAddress()",
];

let ethers = null;
try {
  ethers = await import("ethers");
} catch {
  /* handled in resolveConfig: chain stays "not configured" with a helpful reason */
}

const isLocalUrl = (u) => /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])/.test(u ?? "");

function readDeployment() {
  try {
    return JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8"));
  } catch {
    return null;
  }
}

function fileStamp() {
  try {
    const s = fs.statSync(DEPLOYMENT_FILE);
    return `${s.mtimeMs}:${s.size}`;
  } catch {
    return "none";
  }
}

function resolveConfig() {
  if (!ethers) return { reason: "The ethers package is not installed. Run `npm install` in tracker/." };
  const dep = readDeployment();
  const rpcUrl = process.env.CHAIN_RPC_URL ?? dep?.rpcUrl;
  const address = process.env.CONTRACT_ADDRESS ?? dep?.address;
  const chainId = Number(process.env.CHAIN_ID ?? dep?.chainId) || undefined;
  // A redeployed local chain reuses the same address, so the deploy time is
  // part of what identifies "this" deployment.
  const deployedAt = process.env.CONTRACT_ADDRESS ? undefined : dep?.deployedAt;
  const privateKey = process.env.ISSUER_PRIVATE_KEY ?? (isLocalUrl(rpcUrl) ? LOCAL_TEST_KEY : undefined);

  if (!rpcUrl || !address) {
    return { reason: "No deployed contract found. Run `npm run chain` then `npm run deploy` in blockchain/." };
  }
  if (!ethers.isAddress(address)) return { reason: `CONTRACT_ADDRESS is not a valid address: ${address}` };
  if (!privateKey) return { reason: "Set ISSUER_PRIVATE_KEY to write to a non-local network." };
  return { rpcUrl, address, chainId, privateKey, deployedAt };
}

// ---------- connection state, rebuilt when deployment.json changes ----------
let state = null;
let stateStamp = null;
let lastCheck = { at: 0, result: { available: false, reason: "not checked" } };

function build() {
  const config = resolveConfig();
  if (config.reason) return { configured: false, reason: config.reason };
  const network = config.chainId ? ethers.Network.from(config.chainId) : undefined;
  // staticNetwork stops ethers retrying network detection forever (and spamming
  // the console) while the node is down.
  // cacheTimeout: -1 turns off ethers' 250 ms request cache. With it on, two
  // transactions sent close together read the SAME cached nonce and the second
  // one is rejected ("nonce has already been used").
  const provider = new ethers.JsonRpcProvider(config.rpcUrl, network, {
    cacheTimeout: -1,
    ...(network ? { staticNetwork: network } : {}),
  });
  const wallet = new ethers.Wallet(config.privateKey, provider);
  const contract = new ethers.Contract(config.address, ABI, wallet);
  return { configured: true, config, provider, contract };
}

function current() {
  const stamp = fileStamp();
  if (!state || stamp !== stateStamp) {
    try {
      state?.provider?.destroy?.();
    } catch {
      /* already gone */
    }
    state = build();
    stateStamp = stamp;
    lastCheck = { at: 0, result: { available: false, reason: "not checked" } };
  }
  return state;
}

const withTimeout = (promise, ms, what) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms)),
  ]);

// ---------- availability (cached for a moment) ----------
async function isAvailable() {
  const s = current();
  if (!s.configured) return { available: false, reason: s.reason };
  if (Date.now() - lastCheck.at < 3000) return lastCheck.result;
  let result;
  try {
    await withTimeout(s.provider.getBlockNumber(), 4000, "Blockchain node");
    const code = await withTimeout(s.provider.getCode(s.config.address), 4000, "Blockchain node");
    result =
      code === "0x"
        ? { available: false, reason: "No contract at the saved address (the local chain was probably restarted). Run `npm run deploy` again." }
        : { available: true };
  } catch {
    result = { available: false, reason: "Can't reach the blockchain node." };
  }
  lastCheck = { at: Date.now(), result };
  return result;
}

// ---------- helpers ----------
const toBytes32 = (hex) => `0x${hex}`;
const fromBytes32 = (b) => b.replace(/^0x/, "").toLowerCase();
export const chainRecordId = (recordId) => (ethers ? ethers.id(recordId) : "");

function errorName(e) {
  const s = current();
  if (e?.revert?.name) return e.revert.name;
  if (!s.configured) return null;
  const seen = new Set();
  const found = [];
  const walk = (v, depth = 0) => {
    if (v == null || depth > 6 || seen.has(v)) return;
    if (typeof v === "string") {
      for (const m of v.matchAll(/0x[0-9a-fA-F]{8,}/g)) found.push(m[0]);
      return;
    }
    if (typeof v === "object") {
      seen.add(v);
      for (const k of Object.getOwnPropertyNames(v)) {
        try {
          walk(v[k], depth + 1);
        } catch {
          /* ignore unreadable fields */
        }
      }
    }
  };
  walk(e);
  for (const hex of found) {
    try {
      const parsed = s.contract.interface.parseError(hex);
      if (parsed) return parsed.name;
    } catch {
      /* not one of ours */
    }
  }
  return null;
}

// Transactions go out one at a time so their nonces never collide.
let queue = Promise.resolve();
function serialize(fn) {
  const run = queue.then(() => fn());
  queue = run.catch(() => {});
  return run;
}

const isNonceError = (e) => e?.code === "NONCE_EXPIRED" || /nonce/i.test(String(e?.message ?? ""));

async function send(makeTx) {
  // One retry on a nonce error: the next attempt re-reads the account's nonce.
  for (let attempt = 0; ; attempt++) {
    try {
      const tx = await withTimeout(makeTx(), 20_000, "Sending the transaction");
      const receipt = await withTimeout(tx.wait(), 60_000, "Waiting for confirmation");
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (e) {
      if (attempt === 0 && isNonceError(e)) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      throw e;
    }
  }
}

function contractOrThrow() {
  const s = current();
  if (!s.configured) throw new Error(s.reason);
  return s.contract;
}

// ---------- reads ----------
async function readIdentity(touristId) {
  const [exists, hash, timestamp, status] = await withTimeout(contractOrThrow().getIdentity(touristId), 6000, "Blockchain read");
  return { exists, hash: fromBytes32(hash), timestamp: Number(timestamp), status: Number(status) }; // 1 active, 2 revoked
}

async function readRecord(touristId, recordId) {
  const [exists, hash, timestamp] = await withTimeout(
    contractOrThrow().getRecord(touristId, chainRecordId(recordId)),
    6000,
    "Blockchain read"
  );
  return { exists, hash: fromBytes32(hash), timestamp: Number(timestamp) };
}

// ---------- writes ----------
// If the chain says "already there" (e.g. we crashed after sending), that is
// fine as long as the stored fingerprint is exactly ours.
function anchorIdentity(touristId, hashHex) {
  return serialize(async () => {
    const c = contractOrThrow();
    try {
      return await send(() => c.registerIdentity(touristId, toBytes32(hashHex)));
    } catch (e) {
      if (errorName(e) === "AlreadyRegistered") {
        const onChain = await readIdentity(touristId);
        if (onChain.hash === hashHex) return { txHash: null, blockNumber: null };
        throw Object.assign(new Error("A different fingerprint is already anchored for this ID."), { code: "CONFLICT" });
      }
      throw e;
    }
  });
}

function anchorRecord(touristId, recordId, hashHex) {
  return serialize(async () => {
    const c = contractOrThrow();
    try {
      return await send(() => c.anchorRecord(touristId, chainRecordId(recordId), toBytes32(hashHex)));
    } catch (e) {
      if (errorName(e) === "AlreadyAnchored") {
        const onChain = await readRecord(touristId, recordId);
        if (onChain.hash === hashHex) return { txHash: null, blockNumber: null };
        throw Object.assign(new Error("A different fingerprint is already anchored for this record."), { code: "CONFLICT" });
      }
      throw e;
    }
  });
}

function revokeIdentity(touristId) {
  return serialize(async () => {
    const c = contractOrThrow();
    try {
      return await send(() => c.revokeIdentity(touristId));
    } catch (e) {
      if (errorName(e) === "IdentityNotActive") return { txHash: null, blockNumber: null };
      throw e;
    }
  });
}

const NETWORKS = {
  31337: "Local test network",
  1337: "Local test network",
  80002: "Polygon Amoy testnet",
  137: "Polygon",
  11155111: "Ethereum Sepolia testnet",
  1: "Ethereum",
};

export const chain = {
  get networkName() {
    const id = current().configured ? current().config.chainId : null;
    return id ? (NETWORKS[id] ?? `Chain ${id}`) : "Blockchain";
  },
  get configured() {
    return current().configured;
  },
  get reason() {
    const s = current();
    return s.configured ? null : s.reason;
  },
  get contractAddress() {
    const s = current();
    return s.configured ? s.config.address : null;
  },
  // Identifies one specific deployment: anchors made against a different key
  // are re-anchored (see anchoring.mjs).
  get contractKey() {
    const s = current();
    return s.configured ? `${s.config.address}${s.config.deployedAt ? `@${s.config.deployedAt}` : ""}` : null;
  },
  get chainId() {
    const s = current();
    return s.configured ? (s.config.chainId ?? null) : null;
  },
  isAvailable,
  readIdentity,
  readRecord,
  anchorIdentity,
  anchorRecord,
  revokeIdentity,
  errorName,
};
