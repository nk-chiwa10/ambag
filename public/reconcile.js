// Deterministic reconciliation, shared by the browser UI and the tests.
// No ethers import: callers pass parseEther / decodeRef so this stays dependency-free.

export function normalizeName(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

export function reconcileRows({ rows, contributions, roster, parseEther, decodeRef, onchainTotal }) {
  const onChainByRef = {};
  for (const c of contributions) {
    let ref = "\u2014";
    try {
      ref = decodeRef(c.ref);
    } catch {
      // leave as unknown
    }
    onChainByRef[ref] = (onChainByRef[ref] || 0n) + c.amount;
  }

  const seen = new Set();
  const matchedRefs = new Set();
  const result = rows.map((r) => {
    const member = roster.find((x) => normalizeName(x.name) === normalizeName(r.name));
    const amount = parseEther(r.amount_tbnb);
    const key = `${normalizeName(r.name)}|${r.amount_tbnb}`;
    let status = "unknown";
    let ref = member?.ref || "\u2014";
    let actual = 0n;
    let missing = 0n;

    if (member) {
      matchedRefs.add(member.ref);
      const expected = parseEther(member.expected);
      actual = onChainByRef[member.ref] || 0n;
      if (seen.has(key)) {
        status = "duplicate";
      } else if (actual >= expected) {
        status = "matched";
      } else if (actual > 0n) {
        status = "short";
        missing = expected - actual;
      } else {
        status = "missing";
      }
    }
    seen.add(key);
    return { ...r, amount, ref, actual, missing, status };
  });

  // A roster member the treasurer forgot to list is still a gap the organizer must see.
  for (const member of roster) {
    if (matchedRefs.has(member.ref)) continue;
    const expected = parseEther(member.expected);
    const actual = onChainByRef[member.ref] || 0n;
    result.push({
      name: member.name,
      amount_tbnb: "0",
      note: "not in the treasurer's list",
      amount: 0n,
      ref: member.ref,
      actual,
      missing: expected > actual ? expected - actual : 0n,
      status: actual >= expected ? "matched" : "missing"
    });
  }

  const listTotal = rows.reduce((s, r) => s + parseEther(r.amount_tbnb), 0n);
  const expectedTotal = roster.reduce((s, r) => s + parseEther(r.expected), 0n);
  const total = onchainTotal ?? contributions.reduce((s, c) => s + c.amount, 0n);
  const gap = expectedTotal > total ? expectedTotal - total : 0n;
  const flags = result.filter((r) => r.status !== "matched").length;

  return { rows: result, listTotal, expectedTotal, onchainTotal: total, gap, flags };
}
