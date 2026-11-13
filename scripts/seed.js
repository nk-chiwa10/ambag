import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const ABI = [
  "function createCollection(address payable vendor, uint256 target, uint256 deadline) returns (uint256)",
  "function contribute(uint256 id, bytes32 ref) payable",
  "function collectionCount() view returns (uint256)",
  "function collections(uint256) view returns (address organizer, address vendor, uint256 target, uint256 deadline, uint256 totalRaised, bool released)"
];

const RPC_URL = process.env.RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const DEPLOYER_KEY = process.env.DEPLOYER_KEY;
const VENDOR_ADDRESS = process.env.VENDOR_ADDRESS;
const MEMBER_KEYS = (process.env.MEMBER_KEYS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ROSTER = [
  { ref: "AMB001", name: "Maria Santos", amount: "0.10" },
  { ref: "AMB002", name: "Jose Dela Cruz", amount: "0.10" },
  { ref: "AMB003", name: "Ella Garcia", amount: "0.08" }
];

async function main() {
  if (!CONTRACT_ADDRESS || !ethers.isAddress(CONTRACT_ADDRESS)) {
    throw new Error("Set CONTRACT_ADDRESS in .env");
  }
  if (!DEPLOYER_KEY) throw new Error("Set DEPLOYER_KEY in .env");
  if (MEMBER_KEYS.length < 3) throw new Error("Set at least 3 comma-separated MEMBER_KEYS in .env");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const organizer = new ethers.Wallet(DEPLOYER_KEY, provider);
  const vendor = VENDOR_ADDRESS && ethers.isAddress(VENDOR_ADDRESS) ? VENDOR_ADDRESS : organizer.address;
  if (!VENDOR_ADDRESS) console.warn("VENDOR_ADDRESS not set; using the organizer address as vendor.");

  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, organizer);
  const target = ethers.parseEther("0.30");
  const now = Math.floor(Date.now() / 1000);
  const happyDeadline = now + 2 * 60 * 60;
  const failedDeadline = now + 2 * 60;

  console.log("Organizer:", organizer.address);
  console.log("Vendor:", vendor);

  console.log("Creating happy collection...");
  const tx1 = await contract.createCollection(vendor, target, happyDeadline);
  await tx1.wait();
  const happyId = await contract.collectionCount();
  console.log(`Happy collection: ${happyId} (deadline ${new Date(happyDeadline * 1000).toLocaleString()})`);

  console.log("Creating failed collection...");
  const tx2 = await contract.createCollection(vendor, target, failedDeadline);
  await tx2.wait();
  const failedId = await contract.collectionCount();
  console.log(`Failed collection: ${failedId} (deadline ${new Date(failedDeadline * 1000).toLocaleString()})`);

  const members = MEMBER_KEYS.slice(0, 3).map((key) => new ethers.Wallet(key, provider));

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const row = ROSTER[i];
    const value = ethers.parseEther(row.amount);
    const balance = await provider.getBalance(member.address);
    console.log(`${row.name} (${member.address}) balance ${ethers.formatEther(balance)} tBNB`);
    if (balance < value) throw new Error(`${row.name} needs at least ${row.amount} tBNB plus gas`);
    const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, member);
    const tx = await c.contribute(happyId, ethers.encodeBytes32String(row.ref), { value });
    await tx.wait();
    console.log(`  paid ${row.amount} tBNB with ref ${row.ref}`);
  }

  console.log("Seeding the failed collection with 0.02 tBNB...");
  const failedMember = new ethers.Contract(CONTRACT_ADDRESS, ABI, members[0]);
  const tx3 = await failedMember.contribute(
    failedId,
    ethers.encodeBytes32String(ROSTER[0].ref),
    { value: ethers.parseEther("0.02") }
  );
  await tx3.wait();

  const happy = await contract.collections(happyId);
  const failed = await contract.collections(failedId);
  console.log("\nDone.");
  console.log(`Happy collection ${happyId}: ${ethers.formatEther(happy.totalRaised)} / ${ethers.formatEther(happy.target)} tBNB`);
  console.log(`Failed collection ${failedId}: ${ethers.formatEther(failed.totalRaised)} / ${ethers.formatEther(failed.target)} tBNB`);
  console.log(`\nOpen the app, use contract ${CONTRACT_ADDRESS}, collection ${happyId} for the happy path and ${failedId} for the refund path.`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
