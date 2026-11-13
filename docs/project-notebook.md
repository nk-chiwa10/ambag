# AmbAG — project notebook

Working explanation of what AmbAG does, how it is built, and how to run it.
Last updated: 2026-11-13 · BCC 2026 Build Day · Payments track.

---

## 1. What it is

A group-buy escrow for student orgs, in one sentence:

> Members pay tBNB into a contract; the contract pays the vendor only if the target is met by
> the deadline, otherwise each member gets their own money back; AI reads the treasurer's messy
> payment list and the app proves where it disagrees with the chain.

Three actors:

| Actor | Cares about |
|---|---|
| Member | Did my payment count? Can I get it back? |
| Treasurer | Does the list match the chain? Who is short? |
| Organizer / vendor | Is the target met? Who gets paid, when? |

---

## 2. Structure — four layers

```
Browser (public/)  ──reads/writes──►  Contract (build/AmbAG.sol)
      │                                      ▲
      │ fetch                                │ JSON-RPC
      ▼                                      │
Backend (server.js)                    Local node / BSC Testnet
      │
      └── AI extraction (mock or Gemini/OpenAI)
```

| Layer | File | Responsibility | Must never |
|---|---|---|---|
| Contract | `build/AmbAG.sol` | Hold money, enforce target/deadline/vendor | Be upgradable or admin-controlled |
| Backend | `server.js` | Serve files, proxy AI extraction | Decide whether money moves |
| Reconciliation | `public/reconcile.js` | Match list to chain, flag gaps | Use AI to decide |
| UI | `public/app.js`, `index.html`, `style.css` | Wallet, ledger, actions | Invent chain state |
| Operations | `scripts/*.js` | Deploy, fund, seed, inspect, test | Run on the wrong chain silently |

---

## 3. The contract — the only thing that touches money

`build/AmbAG.sol` is 108 lines, compiler `0.8.19`, optimizer 200 runs, EVM `paris`.
No imports, no OpenZeppelin, no proxy.

### Data

| Storage | Meaning |
|---|---|
| `collections[id]` | organizer, vendor, target, deadline, totalRaised, released |
| `contributionsOf(id)` | append-only list of `(contributor, ref, amount)` |
| `contributed[id][wallet]` | how much one wallet put in — used for refunds |
| `collectionCount` | next id |

A contribution stores a `bytes32 ref` like `AMB001`.
**No names, phones, or receipts ever reach the chain.**

### Functions

| Function | Caller | Rules |
|---|---|---|
| `createCollection(vendor, target, deadline)` | organizer | vendor non-zero and not the contract, target > 0, deadline in the future |
| `contribute(id, ref) payable` | member | collection exists, not released, before deadline, value > 0 |
| `release(id)` | **anyone** | not released, `totalRaised >= target`; pays the whole balance to the fixed vendor |
| `claimRefund(id)` | contributor | not released, after deadline, target missed, caller has a balance; returns exactly their own money once |

### Invariants

- Funds can leave in exactly two directions: the vendor (target met) or the contributor who paid (target missed after deadline).
- No function lets the organizer withdraw.
- `release` and `claimRefund` are mutually exclusive by state.
- Replaying either is blocked (`released`, `nothing to refund`).
- A hand-written reentrancy lock (`_lock`) guards both payout functions.
- After a refund, `totalRaised` decreases, so the contract total always equals money actually held.

### Why it is shaped this way

- **Permissionless release** removes the "organizer disappears" failure.
- **Pull refunds** avoid a loop over members and avoid gas griefing.
- **Fixed vendor** means no one can redirect the money at release time.
- **No admin** means judges cannot ask "what can the owner do to the funds?"

---

## 4. Backend — small on purpose

`server.js` is static hosting plus three routes:

| Route | Purpose |
|---|---|
| `GET /api/health` | Reports `{ok, mock, model}` so the UI can label mock mode |
| `GET /api/config` | Chain id, name, RPC, explorer, contract address, `local` flag |
| `POST /api/extract` | Turns pasted text into `{rows, unreadable}` |

### Extraction, mock vs real

- `MOCK_AI=1` → returns four fixed rows. Used for the stage so Wi-Fi cannot break the demo.
- `MOCK_AI=0` → calls any OpenAI-compatible `/chat/completions`:
  - OpenAI: `https://api.openai.com/v1`
  - Gemini: `https://generativelanguage.googleapis.com/v1beta/openai`, model `gemini-2.5-flash`

Before returning, `validateExtraction` enforces: every row has a name, every amount is a
positive decimal, notes are strings, unreadable lines are preserved. The model cannot inject
a malformed row into the UI.

**The backend never says a payment is valid.** It only transcribes.

---

## 5. Reconciliation — the actual product

`public/reconcile.js` is deterministic and shared by browser and tests.
It takes five inputs: extracted rows, on-chain contributions, roster, `parseEther`, `decodeRef`.

Steps:

1. Decode each on-chain `bytes32` back to `AMB001` and sum amounts per reference.
2. Normalize names: lowercase, strip punctuation, collapse spaces.
3. For each row, find the roster member and their expected amount.
4. Assign a status.

| Status | Condition | What the treasurer learns |
|---|---|---|
| `matched` | on-chain amount ≥ expected | Nothing to do |
| `short` | some money, less than expected | Exactly how much is missing |
| `missing` | zero on-chain | This member never paid |
| `duplicate` | same name + amount appears twice | The list double-counts |
| `unknown` | name not on the roster | Someone outside the group paid |

Then it adds **missing members**: anyone on the roster absent from the list is surfaced,
not silently dropped. Finally it computes:

```
listTotal     = sum of the treasurer's rows    (0.38 in the demo)
expectedTotal = sum of the roster              (0.30)
onchainTotal  = actual contract total          (0.28)
gap           = expectedTotal − onchainTotal   (0.02)
flags         = rows not "matched"             (2)
```

That is the demo's whole "aha": **the sheet says 0.38, the chain says 0.28.**
AI transcribed; math and chain state found the lie.

---

## 6. Frontend — the ledger and the actions

`public/app.js` keeps one `state` object: provider, signer, contract, address, collection id,
collection data, contributions, extraction, vendor balance.

| Function | Role |
|---|---|
| `init()` | Fetch config, restore last collection, fill roster, wire buttons |
| `connectWallet()` | Request accounts, switch/add network, build signer, handle `-32002` |
| `loadCollection()` | Validate address/id, read contract, reveal panels |
| `refresh()` | Re-read collection, contributions, vendor balance |
| `renderCollection()` | Progress bar, status pill, button enable/disable, hints |
| `pay()` | `contribute` with selected ref and amount |
| `extract()` | POST the pasted list |
| `reconcile()` / `renderReconciliation()` | Run shared matcher, draw the table |
| `release()` / `claimRefund()` | The two money-out paths |
| `readableError()` | Re-runs a failed call as `eth_call` to recover the revert reason |

Design details worth knowing:

- **Read-only works without a wallet.** The app uses a plain JSON-RPC provider until you connect.
- **The contract address prefills** from `/api/config`.
- **Chain comes from the server**, so local (31337) and public (97) need no code change.
- **Revert reasons are user language**: `target not met` → "The target isn't met yet, so release is locked."
- **Explorer link hides** on a local chain instead of pointing at a BscScan page that cannot exist.

---

## 7. Scripts — operations, in order

| Command | What it does | Run when |
|---|---|---|
| `npm run localnet` | Ganache chain `31337`, RPC `8545`, funds the deployer | Every session; keep open |
| `npm run deploy` | Compiles solc 0.8.19 and deploys; writes `.env` + artifact | After every chain reset |
| `npm run wallets` | Creates/funds Maria, Jose, Ella; prints keys | After deploy |
| `npm run seed` | Creates happy + failed collections, pays 0.10/0.10/0.08 and 0.02 | **Once** after wallets |
| `npm run inspect` | Read-only dump of all collections and vendor balance | Anytime / verification |
| `npm run selftest` | Deploys to a throwaway EVM and asserts the rules | After contract changes |
| `npm run test:reconcile` | Duplicate/short/unknown/missing cases | After matching changes |

Reset semantics: restarting the node erases state. The contract address is stable because it is
the deployer's first deployment, but you must rerun deploy → wallets → seed.

---

## 8. The demo scenario

Locked numbers, already seeded:

| Item | Value |
|---|---|
| Target | 0.30 tBNB |
| On-chain before top-up | 0.28 (0.10 + 0.10 + 0.08) |
| Treasurer's list | 0.38 (Jose listed twice) |
| AI flags | duplicate (Jose), short (Ella missing 0.02) |
| Release before top-up | reverts `target not met` |
| Fix | Ella pays 0.02 → 0.30 |
| Release | vendor receives exactly 0.30 |
| Failed collection | 0.02 / 0.30, deadline passed |
| Refund | Maria claims 0.02; second claim reverts `nothing to refund` |

Cast: Maria `AMB001` 0.10, Jose `AMB002` 0.10, Ella `AMB003` 0.08 + 0.02.
Maria also owns the 0.02 in the failed collection, so the refund must be claimed from **her** wallet.

---

## 9. How to use it

### Setup once per machine

```powershell
cd "C:\Users\mcmadueno\Binance Academy x BCC"
npm install
npm run localnet      # terminal 1, leave open
npm run deploy
npm run wallets       # import the 3 keys into MetaMask
npm run seed
npm run dev           # terminal 2
```

MetaMask network: name `BSC Local (demo)`, RPC `http://127.0.0.1:8545`, chain `31337`, symbol `tBNB`.

### During the demo

1. Open `http://localhost:3000`; contract and collection 1 are prefilled.
2. Load collection 1 → 0.28 / 0.30.
3. Paste list → Extract → read flags.
4. Click Release → blocked.
5. Switch to Ella, pay 0.02 → 0.30.
6. Release from any account → vendor 0.30.
7. Collection 2 → switch to Maria → claim refund.

### Sample values

| Field | Happy path | Refund path |
|---|---|---|
| Contract | `0x8D03157bAe4E1e61877cc19466522a0cE6E413BC` | same |
| Collection ID | `1` | `2` |

---

## 10. What is real, mock, and blocked

| Part | Status |
|---|---|
| Contract logic | Real, tested on EVM |
| Payments, release, refunds | Real transactions on the local chain |
| Reconciliation | Real, deterministic, tested |
| AI extraction | Mock rows on stage; live path wired but unkeyed |
| BSC Testnet deployment | **Not done** — no tBNB |
| BscScan verification | **Impossible** without the testnet deployment |

The organizer approved simulating the testnet RPC locally for online participants.
Say that plainly in the pitch; do not present the local chain as a testnet deployment.

---

## 11. The three answers to memorize

1. **Why not let AI decide?**
   It reads unstructured input; money rules must be deterministic and auditable.
   AI advises, the contract enforces.

2. **Why is the chain needed?**
   Custody and public proof. The treasurer cannot quietly edit who paid; the contract cannot
   release without the target.

3. **What is the product?**
   The escrow is a commodity. **The reconciliation is the product** — it is the part that saves
   the treasurer an hour and catches the 0.10 that never arrived.
