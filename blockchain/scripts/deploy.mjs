// Deploys TouristRegistry and writes deployment.json for the backend.
//
// Local:   npm run chain   (terminal 1)   then   npm run deploy   (terminal 2)
// Testnet: RPC_URL=<rpc> PRIVATE_KEY=<funded test wallet key> npm run deploy
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";

// The well-known first account of every local Hardhat node. Public knowledge,
// holds only fake coins, and must NEVER be used on a real network.
const LOCAL_TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const isLocal = /^(https?:\/\/)?(localhost|127\.0\.0\.1)/.test(RPC_URL);
const PRIVATE_KEY = process.env.PRIVATE_KEY ?? (isLocal ? LOCAL_TEST_KEY : "");

if (!PRIVATE_KEY) {
  console.error("Set PRIVATE_KEY (a funded TEST wallet) when deploying to a non-local network.");
  process.exit(1);
}

const artifactPath = path.join(root, "artifacts", "TouristRegistry.json");
if (!fs.existsSync(artifactPath)) {
  console.error("No artifact found. Run `npm run compile` first.");
  process.exit(1);
}
const { abi, bytecode } = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const provider = new ethers.JsonRpcProvider(RPC_URL);
try {
  await provider.getNetwork();
} catch {
  console.error(`Cannot reach a blockchain node at ${RPC_URL}. Is \`npm run chain\` running?`);
  process.exit(1);
}

const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const factory = new ethers.ContractFactory(abi, bytecode, wallet);
const contract = await factory.deploy();
await contract.waitForDeployment();

const network = await provider.getNetwork();
const deployment = {
  address: await contract.getAddress(),
  chainId: Number(network.chainId),
  rpcUrl: RPC_URL,
  issuer: wallet.address,
  deployedAt: new Date().toISOString(),
};
const outFile = process.env.DEPLOYMENT_FILE ?? path.join(root, "deployment.json");
fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));

console.log("Deployed TouristRegistry");
console.log(`  address : ${deployment.address}`);
console.log(`  chainId : ${deployment.chainId}`);
console.log(`  issuer  : ${deployment.issuer}`);
console.log(`Wrote ${path.basename(outFile)}. The running backend notices the new contract by itself.`);
