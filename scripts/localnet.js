// Local BSC-compatible node for the demo fallback.
// The public faucet needs mainnet BNB, so the organizer recommends simulating the RPC locally.
// Chain ID is deliberately not 97: MetaMask identifies networks by chain ID, and a second
// network with 97 is ambiguous. 31337 keeps the local node unmistakably separate.
import fs from "node:fs";
import path from "node:path";
import ganache from "ganache";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const ROOT = process.cwd();
const ENV = path.join(ROOT, ".env");
const PORT = Number(process.env.LOCAL_PORT || 8545);
const CHAIN_ID = Number(process.env.CHAIN_ID || 31337);
const START_BALANCE = 1000n * 10n ** 18n;

function setEnv(key, value) {
  const line = `${key}=${value}`;
  let text = fs.existsSync(ENV) ? fs.readFileSync(ENV, "utf8") : "";
  const pattern = new RegExp(`^${key}=.*$`, "m");
  text = pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\s*$/, "")}\n${line}\n`;
  fs.writeFileSync(ENV, text);
}

let deployerKey = (process.env.DEPLOYER_KEY || "").trim();
if (!deployerKey) {
  deployerKey = ethers.Wallet.createRandom().privateKey;
  setEnv("DEPLOYER_KEY", deployerKey);
  console.log("No DEPLOYER_KEY in .env; generated a throwaway one and saved it.");
}

const deployer = new ethers.Wallet(deployerKey);

const server = ganache.server({
  chain: { chainId: CHAIN_ID },
  wallet: {
    accounts: [{ secretKey: deployerKey, balance: "0x" + START_BALANCE.toString(16) }]
  },
  logging: { quiet: true },
  miner: { blockGasLimit: 30_000_000 }
});

await server.listen(PORT, "127.0.0.1");

console.log(`
Local BSC-compatible node
  RPC        http://127.0.0.1:${PORT}
  Chain ID   ${CHAIN_ID}
  Deployer   ${deployer.address}
  Balance    ${ethers.formatEther(START_BALANCE)} tBNB

Point .env at it:
  RPC_URL=http://127.0.0.1:${PORT}
  CHAIN_ID=${CHAIN_ID}

MetaMask -> Add network manually:
  Name       BSC Local (demo)
  RPC URL    http://127.0.0.1:${PORT}
  Chain ID   ${CHAIN_ID}
  Symbol     tBNB

Keep this window open while demoing. State resets when it stops.
`);

async function shutdown() {
  console.log("\nStopping local node...");
  await server.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
