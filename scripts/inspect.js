// Read-only chain inspector. No private key needed.
// Usage: npm run inspect            (uses CONTRACT_ADDRESS + RPC_URL)
//        npm run inspect -- --address 0x.. --rpc http://127.0.0.1:8546
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const RPC = flag("--rpc") || process.env.RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const ADDRESS = flag("--address") || process.env.CONTRACT_ADDRESS;

const ABI = [
  "function collections(uint256) view returns (address organizer, address vendor, uint256 target, uint256 deadline, uint256 totalRaised, bool released)",
  "function contributionsOf(uint256 id) view returns (tuple(address contributor, bytes32 ref, uint256 amount)[])",
  "function collectionCount() view returns (uint256)"
];

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmt = (v) => {
  const s = ethers.formatEther(v);
  return Number(s).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
};

async function main() {
  if (!ADDRESS || !ethers.isAddress(ADDRESS)) {
    console.error("No contract address. Set CONTRACT_ADDRESS in .env or pass --address 0x...");
    process.exit(2);
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const net = await provider.getNetwork();
  const contract = new ethers.Contract(ADDRESS, ABI, provider);
  const count = Number(await contract.collectionCount());

  const now = (await provider.getBlock("latest")).timestamp;
  console.log(`chain ${net.chainId} · contract ${ADDRESS} · ${count} collection(s)\n`);

  const vendors = new Map();
  for (let id = 1; id <= count; id++) {
    const c = await contract.collections(id);
    const contributions = await contract.contributionsOf(id);
    const pct = c.target > 0n ? Number((c.totalRaised * 10000n) / c.target) / 100 : 0;
    const ended = Number(c.deadline) <= Number(now);
    const state = c.released
      ? "released"
      : c.totalRaised >= c.target
        ? "releasable"
        : ended
          ? "refundable"
          : "open";

    console.log(`#${id}  ${fmt(c.totalRaised)} / ${fmt(c.target)} tBNB  (${pct}%)  ${state}`);
    console.log(`    organizer ${short(c.organizer)}`);
    console.log(`    vendor    ${short(c.vendor)}   deadline ${new Date(Number(c.deadline) * 1000).toISOString()}`);

    if (!contributions.length) {
      console.log("    no contributions");
    }
    for (const row of contributions) {
      let ref = "??";
      try {
        ref = ethers.decodeBytes32String(row.ref);
      } catch {
        ref = ethers.hexlify(row.ref).slice(0, 10);
      }
      console.log(`    ${ref}  ${fmt(row.amount).padStart(6)} tBNB  from ${short(row.contributor)}`);
    }
    vendors.set(c.vendor, true);
    console.log("");
  }

  for (const vendor of vendors.keys()) {
    console.log(`vendor balance ${short(vendor)}: ${fmt(await provider.getBalance(vendor))} tBNB`);
  }
}

main().catch((err) => {
  console.error(`inspect failed: ${err?.shortMessage || err?.message || err}`);
  process.exit(1);
});
