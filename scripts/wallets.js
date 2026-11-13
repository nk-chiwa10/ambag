import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const ENV = path.join(process.cwd(), ".env");
const RPC_URL = process.env.RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const FUND_EACH = ethers.parseEther(process.env.FUND_EACH || "0.12");

function setEnv(key, value) {
  const line = `${key}=${value}`;
  let text = fs.existsSync(ENV) ? fs.readFileSync(ENV, "utf8") : "";
  const pattern = new RegExp(`^${key}=.*$`, "m");
  text = pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\s*$/, "")}\n${line}\n`;
  fs.writeFileSync(ENV, text);
}

async function main() {
  const deployerKey = (process.env.DEPLOYER_KEY || "").trim();
  if (!deployerKey) throw new Error("No DEPLOYER_KEY in .env. Run npm run deploy first or paste a funded key.");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(deployerKey, provider);

  let keys = (process.env.MEMBER_KEYS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (keys.length > 0) {
    console.log(`Using existing MEMBER_KEYS (${keys.length}).`);
    keys = keys.slice(0, 3);
  } else {
    keys = Array.from({ length: 3 }, () => ethers.Wallet.createRandom().privateKey);
    setEnv("MEMBER_KEYS", keys.join(","));
    console.log("Generated 3 member wallets and saved them to MEMBER_KEYS.");
  }

  const vendor = process.env.VENDOR_ADDRESS && ethers.isAddress(process.env.VENDOR_ADDRESS)
    ? process.env.VENDOR_ADDRESS
    : ethers.Wallet.createRandom().address;
  if (!process.env.VENDOR_ADDRESS) {
    setEnv("VENDOR_ADDRESS", vendor);
    console.log(`Generated vendor address and saved it to VENDOR_ADDRESS.`);
  }

  const members = keys.map((k) => new ethers.Wallet(k));
  const balance = await provider.getBalance(deployer.address);
  const needed = FUND_EACH * BigInt(members.length);
  console.log(`\nDeployer ${deployer.address}`);
  console.log(`Balance  ${ethers.formatEther(balance)} tBNB, need ${ethers.formatEther(needed)} to fund members`);

  if (balance < needed) {
    console.error(`\nBLOCKED: fund the deployer with at least ${ethers.formatEther(needed + ethers.parseEther("0.01"))} tBNB.`);
    console.error(`https://testnet.bscscan.com/address/${deployer.address}`);
    process.exit(2);
  }

  for (const m of members) {
    const current = await provider.getBalance(m.address);
    if (current >= FUND_EACH) {
      console.log(`${m.address} already has ${ethers.formatEther(current)} tBNB, skipping`);
      continue;
    }
    const tx = await deployer.sendTransaction({ to: m.address, value: FUND_EACH - current });
    await tx.wait();
    console.log(`funded ${m.address} with ${ethers.formatEther(FUND_EACH)} tBNB`);
  }

  console.log(`\nVendor: ${vendor} (receives the release, needs no gas)`);
  console.log("\nMember private keys for MetaMask import (TESTNET ONLY):");
  members.forEach((m, i) => console.log(`  member ${i + 1}  ${m.address}  ${m.privateKey}`));
  console.log("\nNext: npm run seed");
}

main().catch((err) => {
  console.error(`\n${err?.shortMessage || err?.message || err}`);
  process.exit(1);
});
