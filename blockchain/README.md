# Blockchain part

* `contracts/TouristRegistry.sol`: the smart contract. Stores only tourist IDs,
  32-byte hashes and timestamps. Only the issuer (the backend's wallet) can write.
* `scripts/compile.mjs`: compiles it with the `solc` npm package (no compiler download).
* `scripts/deploy.mjs`: deploys it and writes `deployment.json` for the backend.
* `scripts/test-contract.mjs`: 25 checks of the contract's rules.
* `hardhat.config.cjs`: Hardhat is used only to run a local chain (`npm run chain`).

```
npm install
npm run compile
npm run chain        # terminal 1: local blockchain on http://127.0.0.1:8545
npm run deploy       # terminal 2: deploys the contract
npm test             # needs the chain running
```

After restarting `npm run chain` the chain is empty: run `npm run deploy` again.
The running backend detects the new contract and re-anchors everything.

See ../DEMO_GUIDE.md for the whole demo.
