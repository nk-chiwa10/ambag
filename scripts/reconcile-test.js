// Deterministic reconciliation tests. Run: npm run test:reconcile
import assert from "node:assert/strict";
import { ethers } from "ethers";
import { reconcileRows } from "../public/reconcile.js";

const parseEther = ethers.parseEther;
const ref = (s) => ethers.encodeBytes32String(s);

const ROSTER = [
  { ref: "AMB001", name: "Maria Santos", expected: "0.10" },
  { ref: "AMB002", name: "Jose Dela Cruz", expected: "0.10" },
  { ref: "AMB003", name: "Ella Garcia", expected: "0.10" }
];

const contribution = (refId, amount, wallet) => ({
  contributor: wallet,
  ref: ref(refId),
  amount: parseEther(amount)
});

const run = (rows, contributions, onchainTotal) =>
  reconcileRows({
    rows,
    contributions,
    roster: ROSTER,
    parseEther,
    decodeRef: ethers.decodeBytes32String,
    onchainTotal
  });

// 1. The demo scene: the list says 0.38, the chain says 0.28.
const demo = run(
  [
    { name: "Maria Santos", amount_tbnb: "0.10", note: "" },
    { name: "Jose Dela Cruz", amount_tbnb: "0.10", note: "" },
    { name: "Jose Dela Cruz", amount_tbnb: "0.10", note: "duplicate row" },
    { name: "Ella Garcia", amount_tbnb: "0.08", note: "short" }
  ],
  [contribution("AMB001", "0.10", "0xa"), contribution("AMB002", "0.10", "0xb"), contribution("AMB003", "0.08", "0xc")],
  parseEther("0.28")
);

assert.deepEqual(demo.rows.map((r) => r.status), ["matched", "matched", "duplicate", "short"]);
assert.equal(demo.listTotal, parseEther("0.38"));
assert.equal(demo.expectedTotal, parseEther("0.30"));
assert.equal(demo.onchainTotal, parseEther("0.28"));
assert.equal(demo.gap, parseEther("0.02"));
assert.equal(demo.flags, 2);
assert.equal(demo.rows[3].missing, parseEther("0.02"));
console.log("demo scene: 2 flags, gap 0.02");

// 2. Fully paid and fully listed: no flags.
const clean = run(
  [
    { name: "Maria Santos", amount_tbnb: "0.10" },
    { name: "Jose Dela Cruz", amount_tbnb: "0.10" },
    { name: "Ella Garcia", amount_tbnb: "0.10" }
  ],
  [contribution("AMB001", "0.10", "0xa"), contribution("AMB002", "0.10", "0xb"), contribution("AMB003", "0.10", "0xc")],
  parseEther("0.30")
);
assert.equal(clean.flags, 0);
assert.equal(clean.gap, 0n);
console.log("clean run: 0 flags");

// 3. A name that is not on the roster is unknown, not silently matched.
const unknown = run([{ name: "Kuya Bogs", amount_tbnb: "0.10" }], [], 0n);
assert.equal(unknown.rows[0].status, "unknown");
assert.ok(unknown.flags >= 1);
console.log("unknown name: flagged");

// 4. A roster member missing from the treasurer's list is surfaced.
const omitted = run(
  [{ name: "Maria Santos", amount_tbnb: "0.10" }],
  [contribution("AMB001", "0.10", "0xa")],
  parseEther("0.10")
);
const byRef = Object.fromEntries(omitted.rows.map((r) => [r.ref, r.status]));
assert.equal(byRef.AMB001, "matched");
assert.equal(byRef.AMB002, "missing");
assert.equal(byRef.AMB003, "missing");
assert.equal(omitted.flags, 2);
console.log("omitted members: surfaced as missing");

console.log("\nPASS: duplicate, short, unknown, missing, totals");
