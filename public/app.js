import { reconcileRows } from "/reconcile.js";

const { ethers } = window;

const CHAIN_ID = 97;
const CHAIN_HEX = "0x61";
const CHAIN_PARAMS = {
  chainId: CHAIN_HEX,
  chainName: "BNB Smart Chain Testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: ["https://data-seed-prebsc-1-s1.bnbchain.org:8545"],
  blockExplorerUrls: ["https://testnet.bscscan.com"]
};

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

const state = {
  provider: null,
  signer: null,
  contract: null,
  address: "",
  collectionId: 1,
  collection: null,
  contributions: [],
  extraction: null,
  reconciliation: null
};

const $ = (id) => document.getElementById(id);

function init() {
  $("contract").value = localStorage.getItem("ambag.contract") || "";
  $("collectionId").value = localStorage.getItem("ambag.collectionId") || "1";
  $("memberName").innerHTML = ROSTER.map(
    (r) => `<option value="${r.ref}">${r.name} — ${r.expected} tBNB</option>`
  ).join("");
  updateMemberFields();

  $("connect").addEventListener("click", connectWallet);
  $("load").addEventListener("click", loadCollection);
  $("pay").addEventListener("click", pay);
  $("release").addEventListener("click", release);
  $("refund").addEventListener("click", claimRefund);
  $("demoList").addEventListener("click", () => {
    $("listText").value = DEMO_TEXT;
  });
  $("extract").addEventListener("click", extract);
  $("memberName").addEventListener("change", updateMemberFields);
  $("contract").addEventListener("change", () => localStorage.setItem("ambag.contract", $("contract").value.trim()));
  $("collectionId").addEventListener("change", () => localStorage.setItem("ambag.collectionId", $("collectionId").value));
  window.ethereum?.on?.("accountsChanged", async () => {
    if (!state.provider) return;
    state.signer = await state.provider.getSigner();
    const addr = await state.signer.getAddress();
    $("network").textContent = `Connected ${addr.slice(0, 6)}…${addr.slice(-4)} · chain ${CHAIN_ID}`;
  });
}

async function connectWallet() {
  try {
    if (!window.ethereum) {
      setStatus("No wallet found. Install MetaMask or Trust Wallet.");
      return;
    }
    state.provider = new ethers.BrowserProvider(window.ethereum);
    await state.provider.send("eth_requestAccounts", []);
    const network = await state.provider.getNetwork();
    if (Number(network.chainId) !== CHAIN_ID) {
      try {
        await state.provider.send("wallet_switchEthereumChain", [{ chainId: CHAIN_HEX }]);
      } catch (err) {
        if (err?.code === 4902 || err?.data?.originalError?.code === 4902) {
          await state.provider.send("wallet_addEthereumChain", [CHAIN_PARAMS]);
        } else {
          throw err;
        }
      }
    }
    state.signer = await state.provider.getSigner();
    const addr = await state.signer.getAddress();
    $("network").textContent = `Connected ${addr.slice(0, 6)}…${addr.slice(-4)} · chain ${CHAIN_ID}`;
    setStatus("Wallet connected.");
    if ($("contract").value.trim()) await loadCollection();
  } catch (err) {
    setStatus(`Wallet error: ${shortError(err)}`);
  }
}

async function loadCollection() {
  const address = $("contract").value.trim();
  const id = Number($("collectionId").value);
  if (!ethers.isAddress(address)) {
    setStatus("Enter a valid contract address.");
    return;
  }
  if (!state.provider) state.provider = new ethers.JsonRpcProvider(CHAIN_PARAMS.rpcUrls[0]);
  state.address = address;
  state.collectionId = id;
  localStorage.setItem("ambag.contract", address);
  localStorage.setItem("ambag.collectionId", String(id));
  state.contract = new ethers.Contract(address, ABI, state.signer || state.provider);
  try {
    await refresh();
    setStatus(`Loaded collection ${id}.`);
  } catch (err) {
    setStatus(`Load failed: ${shortError(err)}`);
  }
}

async function refresh() {
  if (!state.contract) return;
  const c = await state.contract.collections(state.collectionId);
  state.collection = {
    organizer: c.organizer,
    vendor: c.vendor,
    target: c.target,
    deadline: c.deadline,
    totalRaised: c.totalRaised,
    released: c.released
  };
  state.contributions = await state.contract.contributionsOf(state.collectionId);
  state.vendorBalance = state.provider
    ? await state.provider.getBalance(state.collection.vendor)
    : 0n;
  renderCollection();
  renderReconciliation();
  $("collectionPanel").hidden = false;
  $("memberPanel").hidden = false;
  $("treasurerPanel").hidden = false;
}

function renderCollection() {
  const c = state.collection;
  if (!c) return;
  $("target").textContent = `${fmt(c.target)} tBNB`;
  $("onchain").textContent = `${fmt(c.totalRaised)} tBNB`;
  $("deadline").textContent = new Date(Number(c.deadline) * 1000).toLocaleString();
  $("vendor").textContent = c.vendor;
  $("vendorBal").textContent = `${fmt(state.vendorBalance ?? 0n)} tBNB`;
  const pct = c.target > 0n ? Number((c.totalRaised * 10000n) / c.target) / 100 : 0;
  $("bar").style.width = `${Math.min(pct, 100)}%`;
  $("bar").classList.toggle("done", c.totalRaised >= c.target);
  $("progressText").textContent = `${fmt(c.totalRaised)} / ${fmt(c.target)} tBNB (${pct.toFixed(1)}%)${c.released ? " · released" : ""}`;
  $("release").textContent = c.totalRaised >= c.target ? "Release to vendor" : "Try release (will revert)";
  $("release").disabled = c.released;
}

function updateMemberFields() {
  const ref = $("memberName").value;
  const row = ROSTER.find((r) => r.ref === ref);
  $("memberRef").value = ref;
  $("memberAmount").value = row ? row.expected : "";
}

async function pay() {
  try {
    if (!state.contract || !state.signer) throw new Error("Connect and load first.");
    const ref = $("memberRef").value.trim();
    const amount = $("memberAmount").value.trim();
    if (!ref) throw new Error("Pick a member.");
    const value = ethers.parseEther(amount);
    setPayStatus("Sending…");
    const tx = await state.contract.contribute(state.collectionId, ethers.encodeBytes32String(ref), { value });
    setPayStatus(`Sent ${tx.hash.slice(0, 10)}… waiting`);
    await tx.wait();
    setPayStatus("Paid. Refreshing…");
    await refresh();
    setPayStatus("Paid.");
  } catch (err) {
    setPayStatus(`Error: ${shortError(err)}`);
  }
}

async function extract() {
  const text = $("listText").value.trim();
  if (!text) {
    setAiStatus("Paste a list first.");
    return;
  }
  setAiStatus("Extracting…");
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    state.extraction = data;
    setAiStatus(`Extracted ${data.rows.length} rows${data.mock ? " (mock)" : ""}.`);
    renderReconciliation();
  } catch (err) {
    setAiStatus(`Error: ${shortError(err)}`);
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
  const tbody = $("reconTable").querySelector("tbody");
  tbody.innerHTML = "";
  if (!rec) {
    $("reconStatus").textContent = "No extraction yet.";
    return;
  }

  for (const r of rec.rows) {
    const tr = document.createElement("tr");
    tr.className = r.status;
    const topUp = r.status === "short"
      ? `<button class="mini" data-ref="${escapeHtml(r.ref)}" data-amount="${fmt(r.missing)}">Top up</button>`
      : "";
    tr.innerHTML = `
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.amount_tbnb)}</td>
      <td>${escapeHtml(r.ref)}</td>
      <td>${fmt(r.actual)}</td>
      <td><span class="badge ${r.status}">${r.status}</span></td>
      <td>${r.status === "short" ? `short ${fmt(r.missing)}` : escapeHtml(r.note || "")}</td>
      <td>${topUp}</td>
    `;
    tbody.appendChild(tr);
  }

  $("listTotal").textContent = `${fmt(rec.listTotal)} tBNB`;
  $("expectedTotal").textContent = `${fmt(rec.expectedTotal)} tBNB`;
  $("onchainTotal").textContent = `${fmt(rec.onchainTotal)} tBNB`;
  $("gapTotal").textContent = `${fmt(rec.gap)} tBNB`;
  $("flagCount").textContent = String(rec.flags);
  $("reconStatus").textContent = rec.flags
    ? `${rec.flags} flag(s). The list says ${fmt(rec.listTotal)}; the chain says ${fmt(rec.onchainTotal)}.`
    : "All rows matched.";

  tbody.querySelectorAll("button.mini").forEach((btn) => {
    btn.addEventListener("click", () => {
      $("memberName").value = btn.dataset.ref;
      updateMemberFields();
      $("memberAmount").value = btn.dataset.amount;
      $("memberPanel").scrollIntoView({ behavior: "smooth", block: "center" });
      $("pay").focus();
      setPayStatus(`Connect the member's wallet, then pay ${btn.dataset.amount} tBNB.`);
    });
  });
}

async function release() {
  try {
    if (!state.contract || !state.signer) throw new Error("Connect and load first.");
    setStatus("Calling release…");
    const tx = await state.contract.release(state.collectionId);
    await tx.wait();
    setStatus("Released. Vendor paid.");
    await refresh();
  } catch (err) {
    setStatus(`Release reverted: ${shortError(err)}`);
  }
}

async function claimRefund() {
  try {
    if (!state.contract || !state.signer) throw new Error("Connect and load first.");
    setStatus("Calling claimRefund…");
    const tx = await state.contract.claimRefund(state.collectionId);
    await tx.wait();
    setStatus("Refund claimed.");
    await refresh();
  } catch (err) {
    setStatus(`Refund reverted: ${shortError(err)}`);
  }
}

function setStatus(msg) { $("status").textContent = msg; }
function setPayStatus(msg) { $("payStatus").textContent = msg; }
function setAiStatus(msg) { $("aiStatus").textContent = msg; }

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

function shortError(err) {
  const revert = err?.revert?.args?.[0] ?? err?.reason;
  if (typeof revert === "string" && revert) return revert;
  const raw = [err?.shortMessage, err?.reason, err?.message, err?.info?.error?.message]
    .filter(Boolean)
    .join(" | ");
  const match = raw.match(/revert(?:ed)?:?\s*"?([^"|\n]+)"?/i);
  return match ? match[1].trim() : raw || String(err);
}

init();
