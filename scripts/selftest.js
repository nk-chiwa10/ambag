// Local-EVM self-test: proves the demo's chain behavior without tBNB.
// Run: npx ganache --wallet.deterministic --port 8546  then  npm run selftest
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import solc from "solc";
import { ethers } from "ethers";

const RPC = process.env.SELFTEST_RPC || "http://127.0.0.1:8546";
// Standard ganache deterministic accounts.
const KEYS = [
  "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
  "0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1",
  "0x6370fd033278c143179d81c5526140625662b8daa446c22ee2d73db3707e620c",
  "0x646f1ce2fdad0e6deeeb5c7e8e5543bdde65e86029e2fd9fc169899c440a7913",
  "0xadd53f9a7e588d003326d1cbf9e4a43c061aadd9bc938c843a79e7b4fd2ad743"
];

function compile() {
  const content = fs.readFileSync(path.join(process.cwd(), "build", "AmbAG.sol"), "utf8");
  const input = {
    language: "Solidity",
    sources: { "AmbAG.sol": { content } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
    }
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter((e) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
  const a = out.contracts["AmbAG.sol"]["AmbAG"];
  return { abi: a.abi, bytecode: `0x${a.evm.bytecode.object}` };
}

const ref = (s) => ethers.encodeBytes32String(s);
const eth = (s) => ethers.parseEther(s);

let iface = null;

async function expectRevert(promise, needle) {
  try {
    const tx = await promise;
    if (tx?.wait) await tx.wait();
  } catch (err) {
    const parts = [
      err?.shortMessage,
      err?.reason,
      err?.message,
      err?.info?.error?.message,
      err?.data?.message
    ];
    const data = err?.data ?? err?.info?.error?.data;
    if (typeof data === "string" && data !== "0x" && iface) {
      try {
        const parsed = iface.parseError(data);
        if (parsed) parts.push(parsed.args?.[0] ? String(parsed.args[0]) : parsed.name);
      } catch {
        // not a known custom error; fall through to the raw message
      }
    }
    const msg = parts.filter(Boolean).join(" | ");
    assert.ok(msg.toLowerCase().includes(needle.toLowerCase()), `expected "${needle}", got "${msg.slice(0, 300)}"`);
    return msg;
  }
  throw new Error(`expected revert "${needle}", but the call succeeded`);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const [org, vendor, m1, m2, m3] = KEYS.map((k) => new ethers.Wallet(k, provider));
  for (const w of [org, vendor, m1, m2, m3]) assert.ok(w?.address, "missing test signer");
  const net = await provider.getNetwork();
  assert.equal(Number(net.chainId), 1337, `expected a local dev chain, got ${net.chainId}`);

  const { abi, bytecode } = compile();
  iface = new ethers.Interface(abi);
  const contract = await new ethers.ContractFactory(abi, bytecode, org).deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const as = (signer) => new ethers.Contract(address, abi, signer);
  console.log(`contract ${address}`);

  const now = (await provider.getBlock("latest")).timestamp;
  await (await as(org).createCollection(vendor.address, eth("0.30"), now + 3600)).wait();
  const id = await contract.collectionCount();
  assert.equal(id, 1n);

  await (await as(m1).contribute(id, ref("AMB001"), { value: eth("0.10") })).wait();
  await (await as(m2).contribute(id, ref("AMB002"), { value: eth("0.10") })).wait();
  await (await as(m3).contribute(id, ref("AMB003"), { value: eth("0.08") })).wait();

  let col = await contract.collections(id);
  assert.equal(col.totalRaised, eth("0.28"), "on-chain total must be 0.28");
  assert.equal((await contract.contributionsOf(id)).length, 3);
  console.log("0.28 on-chain, 3 contributions");

  const msg = await expectRevert(as(m1).release(id), "target not met");
  console.log(`release blocked: ${msg}`);

  await (await as(m3).contribute(id, ref("AMB003"), { value: eth("0.02") })).wait();
  const before = await provider.getBalance(vendor.address);
  await (await as(m1).release(id)).wait();
  const after = await provider.getBalance(vendor.address);
  assert.equal(after - before, eth("0.30"), "vendor must receive exactly 0.30");
  console.log("release paid vendor 0.30");

  await expectRevert(as(m1).release(id), "released");
  await expectRevert(as(m1).contribute(id, ref("AMB001"), { value: eth("0.01") }), "released");

  // Failed collection: refunds are pull-based, only after the deadline, only if the target was missed.
  await (await contract.createCollection(vendor.address, eth("0.30"), now + 300)).wait();
  const id2 = await contract.collectionCount();
  await (await as(m2).contribute(id2, ref("AMB002"), { value: eth("0.10") })).wait();

  await expectRevert(as(m2).claimRefund(id2), "not ended");
  await expectRevert(as(m1).release(id2), "target not met");
  await provider.send("evm_increaseTime", [600]);
  await provider.send("evm_mine", []);

  const poolBefore = await provider.getBalance(address);
  const col2 = await contract.collections(id2);
  const paid2 = await contract.contributed(id2, m2.address);
  const blk = await provider.getBlock("latest");
  console.log(`before refund: id=${id2} total=${col2.totalRaised} paidByM2=${paid2} deadline=${col2.deadline} now=${blk.timestamp} released=${col2.released}`);
  await (await as(m2).claimRefund(id2)).wait();
  const poolAfter = await provider.getBalance(address);
  assert.equal(poolBefore - poolAfter, eth("0.10"), "refund must return exactly 0.10 to the member");
  console.log("refund returned 0.10 after deadline");

  await expectRevert(as(m2).claimRefund(id2), "nothing to refund");
  await expectRevert(as(m2).contribute(id2, ref("AMB002"), { value: eth("0.01") }), "closed");

  const c1 = await contract.collections(id);
  const c2 = await contract.collections(id2);
  assert.equal(c1.totalRaised, eth("0.30"));
  assert.equal(c2.totalRaised, eth("0.10"), "collection 2 must be untouched by collection 1's release");
  assert.equal(await provider.getBalance(address), 0n, "no funds stranded after the refund");

  console.log("\nPASS: target gate, per-collection accounting, vendor payout, pull refund, replay guards");
}

main().catch((err) => {
  console.error(`\nFAIL: ${err?.message || err}`);
  process.exit(1);
});
