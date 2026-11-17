// Compiles contracts/TouristRegistry.sol with the solc npm package (no
// compiler download needed) and writes artifacts/TouristRegistry.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = "TouristRegistry.sol";
const source = fs.readFileSync(path.join(root, "contracts", file), "utf8");

const output = JSON.parse(
  solc.compile(
    JSON.stringify({
      language: "Solidity",
      sources: { [file]: { content: source } },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        evmVersion: "paris", // widest compatibility (local node and Polygon)
        outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      },
    })
  )
);

const problems = (output.errors ?? []).filter((e) => e.severity === "error");
for (const e of output.errors ?? []) console.log(e.formattedMessage);
if (problems.length) {
  console.error(`Compilation failed with ${problems.length} error(s).`);
  process.exit(1);
}

const c = output.contracts[file].TouristRegistry;
fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
fs.writeFileSync(
  path.join(root, "artifacts", "TouristRegistry.json"),
  JSON.stringify({ contractName: "TouristRegistry", abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` }, null, 2)
);
console.log("Compiled TouristRegistry -> artifacts/TouristRegistry.json");
