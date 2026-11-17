// Puts fingerprints on the blockchain, in the background.
//
// Registering a tourist or saving a record never waits for (or fails because
// of) the blockchain. The item is saved as "pending" and this service anchors
// it as soon as the chain is reachable, retrying every few seconds. Pending
// state lives in the database, so it survives restarts.
//
// If the contract is redeployed (e.g. the local test chain was restarted and
// wiped), anchors made against the old contract go back to "pending" and are
// re-anchored to the new one.

import { chain } from "./chain.mjs";
import { db, save } from "./store.mjs";

let running = false;

function markAnchored(anchor, result) {
  anchor.status = "anchored";
  anchor.txHash = result.txHash ?? anchor.txHash ?? null;
  anchor.blockNumber = result.blockNumber ?? anchor.blockNumber ?? null;
  anchor.anchoredAt = new Date().toISOString();
  anchor.contract = chain.contractKey;
  delete anchor.lastError;
}

function markFailed(anchor, e) {
  anchor.attempts = (anchor.attempts ?? 0) + 1;
  anchor.lastError = String(e?.message ?? e).slice(0, 200);
  if (e?.code === "CONFLICT") anchor.status = "failed"; // retrying can't fix a conflict
}

function resetForNewContract() {
  let reset = 0;
  const anchors = [];
  for (const r of Object.values(db.identities)) {
    anchors.push(r.anchor);
    if (r.revokeAnchor) anchors.push(r.revokeAnchor);
  }
  for (const rec of Object.values(db.records)) anchors.push(rec.anchor);
  for (const a of anchors) {
    if (a?.status === "anchored" && a.contract && a.contract !== chain.contractKey) {
      a.previousContract = a.contract;
      a.status = "pending";
      reset++;
    }
  }
  if (reset) {
    console.log(`New contract detected: re-anchoring ${reset} item(s).`);
    save();
  }
}

// Order matters: an identity must exist on-chain before its records, and a
// revocation goes last (the contract refuses new records for a revoked ID).
function collectWork() {
  const work = [];
  const identities = Object.values(db.identities);

  for (const r of identities) {
    if (r.anchor?.status === "pending") {
      work.push({ anchor: r.anchor, run: () => chain.anchorIdentity(r.touristId, r.recordHash) });
    }
  }
  for (const rec of Object.values(db.records)) {
    const owner = db.identities[rec.touristId];
    if (rec.anchor?.status === "pending" && owner?.anchor?.status === "anchored") {
      work.push({ anchor: rec.anchor, run: () => chain.anchorRecord(rec.touristId, rec.recordId, rec.recordHash) });
    }
  }
  for (const r of identities) {
    if (r.status === "revoked" && r.revokeAnchor?.status === "pending" && r.anchor?.status === "anchored") {
      work.push({ anchor: r.revokeAnchor, run: () => chain.revokeIdentity(r.touristId) });
    }
  }
  return work;
}

export async function processPending() {
  if (running) return;
  running = true;
  try {
    const availability = await chain.isAvailable();
    if (!availability.available) return;
    resetForNewContract();

    // Newly anchored identities unlock their records, so loop until a pass
    // makes no progress.
    for (let pass = 0; pass < 3; pass++) {
      const work = collectWork();
      if (work.length === 0) break;
      let progressed = false;
      for (const item of work) {
        try {
          markAnchored(item.anchor, await item.run());
          progressed = true;
        } catch (e) {
          markFailed(item.anchor, e);
          if (e?.code !== "CONFLICT") {
            save();
            return; // chain probably down or misconfigured: try again later
          }
        }
        save();
      }
      if (!progressed) break;
    }
  } finally {
    running = false;
  }
}

export function scheduleAnchoring() {
  setImmediate(() => void processPending().catch((e) => console.error("Anchoring error:", e.message)));
}

export function startAnchoring(everyMs = 15_000) {
  const timer = setInterval(scheduleAnchoring, everyMs);
  timer.unref();
  setTimeout(scheduleAnchoring, 1000).unref();
}
