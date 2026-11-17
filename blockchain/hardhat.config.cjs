// Hardhat is used ONLY to run a local blockchain (`npm run chain`).
// Contracts are compiled by scripts/compile.mjs, so `sources` points at an
// empty folder and Hardhat never downloads a Solidity compiler.
module.exports = {
  solidity: "0.8.28",
  paths: { sources: "./hardhat-sources" },
  networks: { hardhat: { chainId: 31337 } },
};
