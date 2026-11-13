# AmbAG — demo operator guide

For whoever is driving the laptop on stage. Follow top to bottom.

---

## What you need

- The project folder: `C:\Users\mcmadueno\Binance Academy x BCC`
- Two terminals
- Chrome or Edge with MetaMask
- A browser profile that is not your personal one (the three demo keys live here)

---

## 1. Start the demo stack

**Terminal 1 — chain** (leave this open, never close it):

```powershell
cd "C:\Users\mcmadueno\Binance Academy x BCC"
npm run localnet
```

Expected:

```
RPC        http://127.0.0.1:8545
Chain ID   31337
Deployer   0x8b3a5E53...0C6f
Balance    1000.0 tBNB
```

If the chain was restarted, it is empty. Run the reset sequence:

```powershell
npm run deploy
npm run wallets
npm run seed
npm run inspect
```

Expected at the end:

```
#1  0.28 / 0.3 tBNB  (93.33%)  open
#2  0.02 / 0.3 tBNB  (6.66%)   refundable
```

**Terminal 2 — app**:

```powershell
cd "C:\Users\mcmadueno\Binance Academy x BCC"
npm run dev
```

Expected: `AmbAG running on http://localhost:3000`.

---

## 2. MetaMask setup (once per browser profile)

Add network manually:

| Field | Value |
|---|---|
| Name | `BSC Local (demo)` |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Symbol | `tBNB` |

Import three accounts (MetaMask → account menu → Import account):

```powershell
npm run wallets
```

Copy the three keys printed under **Member private keys for MetaMask import**.
Label them **Maria**, **Jose**, **Ella** so you never switch to the wrong one.

Only local tBNB is at stake. Never reuse these keys on a real network.

---

## 3. Five minutes before the pitch

- [ ] Terminal 1 still shows the local node running
- [ ] `npm run inspect` still shows `#1 0.28/0.30 open`, `#2 0.02/0.30 refundable`
- [ ] `http://localhost:3000` loads, chip says `BSC Local (demo) · chain 31337`
- [ ] Contract field shows `0x8D03…13BC`, collection `1`
- [ ] MetaMask on `BSC Local (demo)`, not Ethereum or BSC Testnet
- [ ] Deck open at `http://localhost:3000/deck.html`
- [ ] Backup: a screen recording of the flow exists and plays

Do **not** run `npm run seed` again. It creates collections 3 and 4 and double-pays.

---

## 4. The script (about 3 minutes)

### Slide 1 — problem (20 s)

> "A group buy, twenty people, payments in a group chat, and nobody can prove who paid.
> The treasurer rebuilds it in a spreadsheet, and someone fronts the money when the order dies."

### Live — load the ledger (30 s)

1. Open `http://localhost:3000`.
2. Click **Load collection** (contract and ID `1` are prefilled).
3. Point at the numbers: **Raised on-chain 0.28 / target 0.30**, three `AMB` references.

> "No names on chain. Only a reference, the wallet, and the amount."

### Live — AI reconciliation (40 s)

4. Click **Load demo list**, then **Extract with AI**.
5. Point at the table:

| Row | Status | Meaning |
|---|---|---|
| Maria 0.10 | Matched | paid |
| Jose 0.10 | Matched | paid |
| Jose 0.10 | Duplicate | listed twice |
| Ella 0.08 | Short | 0.02 missing |

6. Point at the totals: **list 0.38, chain 0.28, gap 0.02**.

> "The sheet says 0.38. The chain says 0.28. AI only transcribed; the math and the chain found the gap."

### Live — blocked release (30 s)

7. Click **Release to vendor**.
8. Expected red message: **"The target isn't met yet, so release is locked."**
9. Read the revert in MetaMask if it shows: `target not met`.

> "The contract will not move a single tBNB while the target is short."

### Live — fix and release (40 s)

10. Switch MetaMask to **Ella**.
11. Pay `0.10` for `AMB003` → on-chain becomes **0.30**.
12. Keep Ella, or switch back to Maria — release is permissionless.
13. Click **Release to vendor** → confirm.
14. Vendor balance rises to **0.30**, status becomes **Released**.

> "Anyone can trigger the payout once the rule is satisfied. No organizer needed."

### Live — refund path (30 s)

15. Load collection **`2`**.
16. Switch MetaMask to **Maria**.
17. Click **Claim refund** → total returns to 0, her 0.02 comes back.
18. Click again → **"This wallet has no contribution to refund."**

> "Missed deadline, each member pulls their own money. No loop, no admin."

### Close

> "AI reads the list. The chain holds the money. The contract enforces the rule."

---

## 5. If something breaks

| Symptom | Cause | Fix |
|---|---|---|
| `EADDRINUSE :::3000` | app already running | open the existing tab, or kill port 3000 |
| `EADDRINUSE :::8545` | node already running | don't start a second one; use the running chain |
| Fields empty on the page | page loaded before server knew the address | `Ctrl+Shift+R` |
| `That address doesn't look like an AmbAG contract` | wrong address or chain reset | paste `0x8D03…13BC`, verify `npm run inspect` |
| `-32002` | MetaMask request already open | open the MetaMask popup, approve/reject, click Connect once |
| Wrong network | MetaMask on 97 or 1 | switch to `BSC Local (demo)`, chain 31337 |
| All collections gone | node restarted | run deploy → wallets → seed again |
| `missing revert data` | wallet hid the reason | the app retries and shows the real reason automatically |
| Vendor balance unchanged | release tx not confirmed | wait, then reload; check `npm run inspect` |

Worst case: read the numbers from `npm run inspect` and narrate. The chain state is the demo.

---

## 6. Do not claim

- BSC Testnet deployment or BscScan verification — the demo runs on a local node.
- GCash or peso integration — payments are tBNB only.
- Backend reconciliation — matching runs in the shared client module.
- An autonomous AI agent — AI transcribes, the contract enforces.

If asked about the missing testnet deployment:

> "The faucet requires mainnet BNB, and the organizer approved simulating the testnet RPC locally
> for online participants. The contract is chain-agnostic; with tBNB it deploys unchanged to chain 97."

---

## 7. Reset for the next run

To return to the exact starting state:

1. Stop the local node (close terminal 1 or `Ctrl+C`).
2. Start it again: `npm run localnet`.
3. In terminal 2: `npm run deploy`, `npm run wallets`, `npm run seed`.
4. Reload the app.

The contract address stays `0x8D03157bAe4E1e61877cc19466522a0cE6E413BC` because it is the
deployer's first deployment.
