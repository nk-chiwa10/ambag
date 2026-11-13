import { reconcileRows } from "/reconcile.js";

const { ethers } = window;

// Chain config comes from the server so the browser signs and reads on the same chain.
const CONFIG = await fetch("/api/config")
  .then((res) => (res.ok ? res.json() : null))
  .catch(() => null);

const CHAIN_ID = CONFIG?.chainId ?? 97;
const CHAIN_HEX = CONFIG?.chainHex ?? "0x61";
const CHAIN_NAME = CONFIG?.chainName ?? "BNB Smart Chain Testnet";
const CHAIN_PARAMS = {
  chainId: CHAIN_HEX,
  chainName: CHAIN_NAME,
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: [CONFIG?.rpcUrl ?? "https://data-seed-prebsc-1-s1.bnbchain.org:8545"]
};
if (CONFIG?.explorer) CHAIN_PARAMS.blockExplorerUrls = [CONFIG.explorer];

const ABI = [
  "function collections(uint256) view returns (address organizer, address vendor, uint256 target, uint256 deadline, uint256 totalRaised, bool released)",
  "function contribute(uint256 id, bytes32 ref) payable",
  "function release(uint256 id)",
  "function claimRefund(uint256 id)",
  "function contributionsOf(uint256 id) view returns (tuple(address contributor, bytes32 ref, uint256 amount)[])",
  "function contributed(uint256 id, address) view returns (uint256)",
  "function collectionCount() view returns (uint256)"
];

const ROSTER = [
  { ref: "AMB001", name: "Maria Santos", expected: "0.10" },
  { ref: "AMB002", name: "Jose Dela Cruz", expected: "0.10" },
  { ref: "AMB003", name: "Ella Garcia", expected: "0.10" }
];

const DEMO_TEXT = `Maria Santos - 0.10
Jose Dela Cruz - 0.10
Jose Dela Cruz - 0.10
Ella Garcia - 0.08`;

const STATUS_LABEL = {
  matched: "Matched",
  short: "Short",
  duplicate: "Duplicate",
  missing: "Missing",
  unknown: "Unknown"
};

const REVERT_HINTS = {
  "closed": "This collection is closed. Payments are no longer accepted.",
  "released": "Funds were already released. This collection is closed.",
  "no collection": "Collection not found on this contract.",
  "target not met": "The target isn't met yet, so release is locked.",
  "not ended": "The deadline hasn't passed yet, so refunds are locked.",
  "target met": "The target was met, so refunds are closed.",
  "nothing to refund": "This wallet has no contribution to refund.",
  "zero value": "Enter an amount greater than 0."
};

const state = {
  provider: null,
  signer: null,
  contract: null,
  address: "",
  collectionId: 1,
  collection: null,
  contributions: [],
  vendorBalance: null,
  extraction: null,
  reconciliation: null
};

const $ = (id) => document.getElementById(id);

function init() {
  $("contract").value = localStorage.getItem("ambag.contract") || CONFIG?.contractAddress || "";
  $("collectionId").value = localStorage.getItem("ambag.collectionId") || "1";
  $("memberName").innerHTML = ROSTER.map(
    (r) => `<option value="${r.ref}">${r.name} — ${r.expected} tBNB</option>`
  ).join("");
  updateMemberFields();
  renderEmptyTable();
  setWalletUI("");
  $("chainEyebrow").textContent = `${CHAIN_NAME} · chain ${CHAIN_ID}`;

  $("loadForm").addEventListener("submit", (event) => {
    event.preventDefault();
    loadCollection();
  });
  $("connect").addEventListener("click", connectWallet);
  $("pay").addEventListener("click", () => {
    if (!state.signer) {
      setPayStatus("Connect a wallet to pay.", "warn");
      connectWallet();
      return;
    }
    pay();
  });
  $("release").addEventListener("click", () => {
    if (!state.signer) {
      setActionStatus("Connect a wallet first.", "warn");
      connectWallet();
      return;
    }
    release();
  });
  $("refund").addEventListener("click", () => {
    if (!state.signer) {
      setActionStatus("Connect a wallet first.", "warn");
      connectWallet();
      return;
    }
    claimRefund();
  });
  $("demoList").addEventListener("click", () => {
    $("listText").value = DEMO_TEXT;
    setAiStatus("Demo list loaded. Ready to extract.", "info");
  });
  $("extract").addEventListener("click", extract);
  $("copyContract").addEventListener("click", () => {
    copyText(state.address || $("contract").value.trim(), $("copyContract"));
  });
  $("memberName").addEventListener("change", updateMemberFields);
  $("contract").addEventListener("input", () => $("contract").removeAttribute("aria-invalid"));
  $("contract").addEventListener("change", () => localStorage.setItem("ambag.contract", $("contract").value.trim()));
  $("collectionId").addEventListener("change", () => localStorage.setItem("ambag.collectionId", $("collectionId").value));

  window.ethereum?.on?.("accountsChanged", async () => {
    if (!state.provider || !state.signer) return;
    try {
      state.signer = await state.provider.getSigner();
      const addr = await state.signer.getAddress();
      setWalletUI(addr);
      if (state.address) state.contract = new ethers.Contract(state.address, ABI, state.signer);
      if (state.collection) renderCollection();
    } catch {
      state.signer = null;
      setWalletUI("");
      if (state.address) state.contract = new ethers.Contract(state.address, ABI, state.provider);
      if (state.collection) renderCollection();
      setStatus("Wallet disconnected. Browsing read-only.", "warn");
    }
  });

  fetch("/api/health")
    .then((res) => res.json())
    .then((health) => {
      if (health.mock) $("aiMode").textContent = "AI assist · mock";
    })
    .catch(() => {});
}

async function connectWallet() {
  if (!window.ethereum) {
    setStatus("No wallet found. Install MetaMask or Trust Wallet to pay.", "error");
    return;
  }

  setBusy($("connect"), true);
  setStatus("Waiting for your wallet…", "info");
  try {
    state.provider = new ethers.BrowserProvider(window.ethereum);
    await state.provider.send("eth_requestAccounts", []);

    let network = await state.provider.getNetwork();
    if (Number(network.chainId) !== CHAIN_ID) {
      try {
        await state.provider.send("wallet_switchEthereumChain", [{ chainId: CHAIN_HEX }]);
      } catch (err) {
        if (err?.code === 4902 || err?.data?.originalError?.code === 4902) {
          await state.provider.send("wallet_addEthereumChain", [CHAIN_PARAMS]);
        } else {
          throw new Error("Switch to BSC Testnet (chain 97) in your wallet.");
        }
      }
      state.provider = new ethers.BrowserProvider(window.ethereum);
      network = await state.provider.getNetwork();
      if (Number(network.chainId) !== CHAIN_ID) throw new Error(`Wrong network. Switch your wallet to ${CHAIN_NAME} (chain ${CHAIN_ID}).`);
    }

    state.signer = await state.provider.getSigner();
    const addr = await state.signer.getAddress();
    setWalletUI(addr);
    setStatus("Wallet connected. You can pay, release, or claim.", "success");
    if ($("contract").value.trim()) await loadCollection();
  } catch (err) {
    const code = rpcCode(err);
    if (code === -32002) {
      setStatus("MetaMask already has a request open. Click the MetaMask icon, approve or reject it, then try again.", "error");
    } else {
      setStatus(`Wallet error: ${shortError(err)}`, "error");
    }
  } finally {
    setBusy($("connect"), false);
  }
}

async function loadCollection() {
  const address = $("contract").value.trim();
  const id = Number($("collectionId").value);

  if (!ethers.isAddress(address)) {
    $("contract").setAttribute("aria-invalid", "true");
    $("contract").focus();
    setStatus("Enter a valid contract address.", "error");
    return;
  }
  if (!Number.isInteger(id) || id < 1) {
    setStatus("Collection ID must be a whole number of 1 or more.", "error");
    $("collectionId").focus();
    return;
  }
  $("contract").removeAttribute("aria-invalid");

  if (!state.provider) state.provider = new ethers.JsonRpcProvider(CHAIN_PARAMS.rpcUrls[0]);
  state.address = ethers.getAddress(address);
  state.collectionId = id;
  state.contract = new ethers.Contract(state.address, ABI, state.signer || state.provider);
  localStorage.setItem("ambag.contract", state.address);
  localStorage.setItem("ambag.collectionId", String(id));

  setBusy($("load"), true);
  setActionStatus("");
  setPayStatus("");
  setStatus(`Reading the collection from ${CHAIN_NAME}…`, "info");
  try {
    await refresh();
    setStatus(`Collection #${id} loaded from ${shortAddr(state.address)}.`, "success");
    reveal($("collectionPanel"));
  } catch (err) {
    state.collection = null;
    state.contributions = [];
    $("collectionPanel").hidden = true;
    $("memberPanel").hidden = true;
    $("treasurerPanel").hidden = true;
    const message = shortError(err);
    setStatus(
      /decode|bad_data/i.test(message)
        ? "That address doesn't look like an AmbAG contract on BSC Testnet."
        : `Load failed: ${message}`,
      "error"
    );
  } finally {
    setBusy($("load"), false);
  }
}

async function refresh() {
  if (!state.contract) return;
  const c = await state.contract.collections(state.collectionId);
  if (c.organizer === ethers.ZeroAddress) {
    throw new Error(`Collection #${state.collectionId} was not found on this contract.`);
  }
  state.collection = {
    organizer: c.organizer,
    vendor: c.vendor,
    target: c.target,
    deadline: c.deadline,
    totalRaised: c.totalRaised,
    released: c.released
  };
  state.contributions = await state.contract.contributionsOf(state.collectionId);

  state.vendorBalance = null;
  try {
    state.vendorBalance = state.provider ? await state.provider.getBalance(c.vendor) : null;
  } catch {
    // balance is a nice-to-have; never block the ledger on it
  }

  renderCollection();
  renderReconciliation();
  $("collectionPanel").hidden = false;
  $("memberPanel").hidden = false;
  $("treasurerPanel").hidden = false;
}

function renderCollection() {
  const c = state.collection;
  if (!c) return;

  const now = Math.floor(Date.now() / 1000);
  const ended = now >= Number(c.deadline);
  const targetMet = c.target > 0n && c.totalRaised >= c.target;
  const pct = c.target > 0n ? Number((c.totalRaised * 10000n) / c.target) / 100 : 0;
  const barPct = Math.min(100, Math.max(0, pct));

  $("collectionTitle").textContent = `Collection #${state.collectionId}`;
  $("target").textContent = fmt(c.target);
  $("onchain").textContent = fmt(c.totalRaised);
  $("deadline").textContent = formatDeadline(c.deadline);
  $("vendor").textContent = c.vendor;
  $("vendor").title = c.vendor;
  $("vendorBal").textContent = state.vendorBalance === null ? "—" : `${fmt(state.vendorBalance)} tBNB`;

  $("bar").style.width = `${barPct}%`;
  $("bar").classList.toggle("done", targetMet);
  $("progressWrap").setAttribute("aria-valuenow", String(Math.round(barPct)));
  $("progressWrap").setAttribute(
    "aria-valuetext",
    `${fmt(c.totalRaised)} of ${fmt(c.target)} tBNB raised (${pct}%)`
  );
  $("progressText").textContent = `${pct}% of target${c.released ? " · released" : ""}`;

  let label = "Open";
  let tone = "gold";
  if (c.released) {
    label = "Released";
    tone = "success";
  } else if (targetMet) {
    label = "Target met";
    tone = "success";
  } else if (ended) {
    label = "Ended";
    tone = "danger";
  }
  $("collectionStatus").textContent = label;
  $("collectionStatus").dataset.tone = tone;

  $("release").disabled = c.released || !targetMet;
  $("release").textContent = c.released ? "Released to vendor" : "Release to vendor";
  $("refund").disabled = c.released || !ended || targetMet;
  $("pay").disabled = c.released || ended;

  let hint = "Release unlocks when the target is met; refunds unlock after the deadline if it isn't.";
  if (c.released) hint = "Funds were released to the vendor. This collection is closed.";
  else if (targetMet) hint = "Target met. Release sends the full raised amount to the vendor.";
  else if (ended) hint = "Deadline passed and the target was missed. Contributors can claim refunds.";
  $("actionHint").textContent = hint;

  const explorer = CHAIN_PARAMS.blockExplorerUrls?.[0];
  const link = $("explorerLink");
  if (explorer) {
    link.hidden = false;
    link.href = `${explorer}/address/${state.address}`;
    link.title = "Open in the block explorer";
  } else {
    link.hidden = true;
    link.removeAttribute("href");
  }
}

function updateMemberFields() {
  const ref = $("memberName").value;
  const row = ROSTER.find((r) => r.ref === ref);
  $("memberRef").value = ref;
  $("memberAmount").value = row ? row.expected : "";
  setPayStatus("");
}

async function pay() {
  if (!state.contract || !state.signer) {
    setPayStatus("Connect a wallet and load a collection first.", "warn");
    return;
  }

  const ref = $("memberRef").value.trim();
  const amount = $("memberAmount").value.trim();
  if (!ref) {
    setPayStatus("Pick a member first.", "warn");
    return;
  }

  let value;
  try {
    value = ethers.parseEther(amount);
  } catch {
    setPayStatus("Enter a valid tBNB amount, like 0.10.", "error");
    $("memberAmount").focus();
    return;
  }
  if (value <= 0n) {
    setPayStatus("Amount must be greater than 0.", "error");
    $("memberAmount").focus();
    return;
  }

  const c = state.collection;
  if (c && (c.released || Date.now() / 1000 >= Number(c.deadline))) {
    setPayStatus("This collection is closed. Payments are no longer accepted.", "error");
    return;
  }

  setBusy($("pay"), true);
  try {
    setPayStatus("Confirm the payment in your wallet…", "info");
    const tx = await state.contract.contribute(
      state.collectionId,
      ethers.encodeBytes32String(ref),
      { value }
    );
    setPayStatus(`Sent ${tx.hash.slice(0, 10)}… waiting for confirmation…`, "info");
    await tx.wait();
    await refresh();
    setPayStatus(`Paid ${fmt(value)} tBNB for ${ref}. The ledger is updated.`, "success");
  } catch (err) {
    setPayStatus(`Payment failed: ${await readableError(err, () => state.contract.contribute.staticCall(state.collectionId, ethers.encodeBytes32String(ref), { value }))}`, "error");
  } finally {
    setBusy($("pay"), false);
    if (state.collection) renderCollection();
  }
}

async function extract() {
  const text = $("listText").value.trim();
  if (!text) {
    setAiStatus("Paste a payment list first.", "warn");
    $("listText").focus();
    return;
  }

  setBusy($("extract"), true);
  setAiStatus("Reading the list…", "info");
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    state.extraction = data;
    const count = data.rows?.length ?? 0;
    const mock = data.mock ? " (mock AI)" : "";
    if (state.collection) {
      setAiStatus(`Extracted ${count} row${count === 1 ? "" : "s"}${mock}. Check the flags below.`, "success");
    } else {
      setAiStatus(`Extracted ${count} row${count === 1 ? "" : "s"}${mock}. Load a collection to reconcile.`, "warn");
    }
    renderReconciliation();
  } catch (err) {
    setAiStatus(`Extraction failed: ${shortError(err)}`, "error");
  } finally {
    setBusy($("extract"), false);
  }
}

function reconcile() {
  if (!state.extraction || !state.collection) return null;
  return reconcileRows({
    rows: state.extraction.rows,
    contributions: state.contributions,
    roster: ROSTER,
    parseEther: ethers.parseEther,
    decodeRef: ethers.decodeBytes32String,
    onchainTotal: state.collection.totalRaised
  });
}

function renderReconciliation() {
  const rec = reconcile();
  state.reconciliation = rec;
  const table = $("reconTable");
  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";

  if (!rec) {
    renderEmptyTable(
      state.extraction ? "Collection not loaded" : "No rows yet",
      state.extraction
        ? "Load a collection so the list can be matched against the chain."
        : "Paste the payment list and extract with AI."
    );
    $("reconStatus").textContent = state.extraction ? "Load a collection to reconcile." : "No extraction yet.";
    delete $("reconStatus").dataset.tone;
    return;
  }

  table.hidden = false;
  const empty = $("reconEmpty");
  if (empty) empty.hidden = true;

  for (const r of rec.rows) {
    const tr = document.createElement("tr");
    tr.className = `row-${r.status}`;

    const topUp =
      (r.status === "short" || r.status === "missing") && r.missing > 0n
        ? `<button class="btn btn-mini" type="button" data-ref="${escapeHtml(r.ref)}" data-amount="${fmt(r.missing)}" aria-label="Top up ${escapeHtml(r.name)}">Top up</button>`
        : "";

    tr.innerHTML = `
      <td>${escapeHtml(r.name)}</td>
      <td class="num">${escapeHtml(r.amount_tbnb)}</td>
      <td class="mono">${escapeHtml(r.ref)}</td>
      <td class="num">${fmt(r.actual)}</td>
      <td><span class="badge ${r.status}">${STATUS_LABEL[r.status] || r.status}</span></td>
      <td>${noteFor(r)}</td>
      <td class="num">${topUp}</td>
    `;
    tbody.appendChild(tr);
  }

  $("listTotal").textContent = `${fmt(rec.listTotal)} tBNB`;
  $("expectedTotal").textContent = `${fmt(rec.expectedTotal)} tBNB`;
  $("onchainTotal").textContent = `${fmt(rec.onchainTotal)} tBNB`;
  $("gapTotal").textContent = `${fmt(rec.gap)} tBNB`;
  $("flagCount").textContent = String(rec.flags);

  if (rec.flags) {
    setMessage(
      $("reconStatus"),
      `${rec.flags} flag${rec.flags === 1 ? "" : "s"} · list says ${fmt(rec.listTotal)} tBNB, chain says ${fmt(rec.onchainTotal)} tBNB.`,
      "warn"
    );
  } else {
    setMessage($("reconStatus"), "All rows matched. The list agrees with the chain.", "success");
  }

  tbody.querySelectorAll("button[data-ref]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $("memberName").value = btn.dataset.ref;
      updateMemberFields();
      $("memberAmount").value = btn.dataset.amount;
      reveal($("memberPanel"), "center");
      $("pay").focus();
      setPayStatus(`Top up ${btn.dataset.amount} tBNB with the member's wallet.`, "warn");
    });
  });
}

function renderEmptyTable(title = "No rows yet", text = "Paste the payment list and extract with AI.") {
  const table = $("reconTable");
  table.hidden = true;
  let empty = $("reconEmpty");
  if (!empty) {
    empty = document.createElement("div");
    empty.id = "reconEmpty";
    empty.className = "empty-state";
    table.after(empty);
  }
  empty.hidden = false;
  empty.innerHTML = `
    <span class="empty-icon"><svg class="icon" aria-hidden="true"><use href="#i-document" /></svg></span>
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(text)}</span>
  `;
}

function noteFor(r) {
  if (r.status === "short") return `short ${fmt(r.missing)} tBNB`;
  if (r.status === "duplicate") return "duplicate row in the list";
  if (r.status === "missing") return r.note ? escapeHtml(r.note) : "no payment found";
  if (r.status === "matched") return r.note ? escapeHtml(r.note) : "paid in full";
  return r.note ? escapeHtml(r.note) : "not on the roster";
}

async function release() {
  if (!state.contract || !state.signer) {
    setActionStatus("Connect a wallet and load a collection first.", "warn");
    return;
  }

  setBusy($("release"), true);
  try {
    setActionStatus("Confirm the release in your wallet…", "info");
    const tx = await state.contract.release(state.collectionId);
    setActionStatus(`Release sent ${tx.hash.slice(0, 10)}… waiting for confirmation…`, "info");
    await tx.wait();
    await refresh();
    setActionStatus("Released. The vendor has been paid.", "success");
  } catch (err) {
    setActionStatus(`Release failed: ${await readableError(err, () => state.contract.release.staticCall(state.collectionId))}`, "error");
  } finally {
    setBusy($("release"), false);
    if (state.collection) renderCollection();
  }
}

async function claimRefund() {
  if (!state.contract || !state.signer) {
    setActionStatus("Connect a wallet and load a collection first.", "warn");
    return;
  }

  setBusy($("refund"), true);
  try {
    setActionStatus("Confirm the refund claim in your wallet…", "info");
    const tx = await state.contract.claimRefund(state.collectionId);
    setActionStatus(`Refund sent ${tx.hash.slice(0, 10)}… waiting for confirmation…`, "info");
    await tx.wait();
    await refresh();
    setActionStatus("Refund claimed. The tBNB is back in your wallet.", "success");
  } catch (err) {
    setActionStatus(`Refund failed: ${await readableError(err, () => state.contract.claimRefund.staticCall(state.collectionId))}`, "error");
  } finally {
    setBusy($("refund"), false);
    if (state.collection) renderCollection();
  }
}

function setStatus(message, tone = "info") {
  setMessage($("status"), message, tone);
}

function setPayStatus(message, tone = "info") {
  setMessage($("payStatus"), message, tone);
}

function setAiStatus(message, tone = "info") {
  setMessage($("aiStatus"), message, tone);
}

function setActionStatus(message, tone = "info") {
  setMessage($("actionStatus"), message, tone);
}

function setMessage(el, message, tone) {
  el.textContent = message;
  if (message) el.dataset.tone = tone;
  else delete el.dataset.tone;
}

function setBusy(btn, busy) {
  btn.classList.toggle("is-busy", busy);
  btn.disabled = busy;
  btn.setAttribute("aria-busy", busy ? "true" : "false");
}

function setWalletUI(addr) {
  const chip = $("networkChip");
  const button = $("connect");
  if (addr) {
    $("network").textContent = `${CHAIN_NAME} · connected`;
    $("connectLabel").textContent = shortAddr(addr);
    button.title = addr;
    button.setAttribute("aria-label", `Wallet connected: ${addr}`);
    chip.dataset.state = "connected";
  } else {
    $("network").textContent = `${CHAIN_NAME} · read-only`;
    $("connectLabel").textContent = "Connect wallet";
    button.removeAttribute("title");
    button.setAttribute("aria-label", "Connect wallet");
    chip.dataset.state = "readonly";
  }
}

async function copyText(text, btn) {
  if (!text) {
    setStatus("Nothing to copy yet.", "warn");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Contract address copied.", "success");
    if (btn) {
      btn.title = "Copied!";
      setTimeout(() => {
        btn.title = "Copy contract address";
      }, 1500);
    }
  } catch {
    setStatus("Copy failed. Select the address and copy it manually.", "error");
  }
}

function formatDeadline(deadline) {
  const ts = Number(deadline);
  if (!ts) return "—";
  const date = new Date(ts * 1000);
  const exact = date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  const diff = ts - Math.floor(Date.now() / 1000);
  if (diff <= 0) return `Ended ${exact}`;
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const rel = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  return `Ends in ${rel} · ${exact}`;
}

function shortAddr(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

function reveal(el, block = "start") {
  el.scrollIntoView({ behavior: matchesReducedMotion() ? "auto" : "smooth", block });
}

function matchesReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function fmt(v) {
  const s = ethers.formatEther(v);
  return Number(s).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// ethers v6 buries the JSON-RPC code under different keys depending on the provider,
// and err.code is often the string "UNKNOWN_ERROR" rather than the real number.
function rpcCode(err) {
  const codes = [
    err?.code,
    err?.info?.error?.code,
    err?.error?.code,
    err?.data?.originalError?.code
  ];
  return codes.find((c) => typeof c === "number") ?? codes.find(Boolean);
}

function shortError(err) {
  if (err?.code === "ACTION_REJECTED" || rpcCode(err) === 4001) return "Request rejected in wallet.";
  const revert = err?.revert?.args?.[0] ?? err?.reason;
  if (typeof revert === "string" && revert) return hintFor(revert);
  const raw = [err?.shortMessage, err?.reason, err?.message, err?.info?.error?.message]
    .filter(Boolean)
    .join(" | ");
  const match = raw.match(/revert(?:ed)?:?\s*"?([^"|\n]+)"?/i);
  return hintFor(match ? match[1].trim() : raw || String(err));
}

// A wallet's gas estimate can fail with no reason attached. Re-running the same call
// as eth_call returns the revert string, so the user sees "target not met", not "missing revert data".
async function readableError(err, retry) {
  const message = shortError(err);
  if (!retry || !/missing revert data|coalesce/i.test(message)) return message;
  try {
    await retry();
  } catch (inner) {
    return shortError(inner);
  }
  return message;
}

function hintFor(message) {
  const text = String(message).trim();
  return (REVERT_HINTS[text.toLowerCase()] || text).slice(0, 220);
}

init();
