# AmbAG

* **Author:** nk-chiwa10
* **Date:** 2026-11-13
* **Status:** Final brainstorm brief — all seven lenses complete.

## Overview

AmbAG is a group-buy collection assistant for Filipino student organizations. The treasurer creates one link for a group buy where the vendor needs the full amount or the order does not happen: jackets, a venue deposit, grad photos. Members pay in tBNB on BSC Testnet and receive a short reference. The AI reads the treasurer's messy payment list, extracts each row, and joins it to the on-chain record. The contract holds the money and releases it to the vendor only when the target is met; if the deadline passes short, members claim refunds.

The user is the org treasurer who fronts the money and chases twenty people across a group chat, a spreadsheet, and a payment app. The value is the liquidation report: a public money record, a rule the treasurer cannot quietly bend, and a refund path that does not depend on the treasurer's memory.

Business model: 99 pesos per collection or 1%, paid by the org from its budget, not from the collected funds. The B2B path is the university student-affairs office buying it for all recognized orgs.

## Analysis

### 1. The first concept failed on two rails

A GCash screenshot proves that pesos moved inside GCash. It says nothing about tBNB arriving at the contract. If the demo shows a GCash screenshot reconciled against an on-chain ledger, a judge will ask within a minute: "If the money is on-chain, why is the AI reading GCash? If it is GCash, why does the contract hold it?"

Decision: GCash belongs on the problem slide only, as the way orgs collect today. The demo input is the org's messy payment list: names, amounts, references, and tBNB transaction hashes or Binance send receipts. The AI extracts the rows; the app checks each hash against BSC Testnet. One rail: tBNB into the contract. Show a fixed demo rate next to the tBNB amounts so the audience can read pesos. No oracle.

### 2. Member wallets are the adoption cost; state it, do not hide it

The design lens argued for the opposite: keep members on GCash and make the treasurer the only wallet user, with the contract as a commitment vault. That removes the five-step wallet onboarding, but it also removes member custody: the contract holds the treasurer's mirrored pool, refunds are manual, and "release to vendor" is really "release to the treasurer." The escrow story weakens, and the "why chain" answer becomes a shared spreadsheet with extra steps.

Decision: one rail, member tBNB wallets for the demo. The trade-off is real: a student will not install a wallet to pay a small share. Put embedded wallets and a GCash on-ramp on the Phase 2 slide. Do not pretend the trade-off does not exist. The hackathon demo uses three funded test wallets, and the member view is one link with a pre-connected demo account, so the judges see the mechanism without the onboarding.

Fallback if wallet integration slips: switch to the organizer-only commitment vault and pitch the treasurer's liquidation report. Do not demo both.

### 3. Public money, private names

Putting every member's name, amount, and paid status on-chain is permanent, world-readable, and invites a Data Privacy Act question. It also forces the AI to decide whether "J. Dela Cruz" is "Jose Dela Cruz," which is subjective and flaky live.

Decision: the chain stores a 6-character reference, the payer address, the amount, and the timestamp. Names live in the app, in a roster keyed by reference. The public view shows `AMB-7F3A paid 0.10 tBNB`. The treasurer view shows `Jose Dela Cruz paid 0.10 tBNB`. The organizer is the trusted mapper; the AI may suggest a name, but a human confirms it. The chain is complete about money and silent about people.

### 4. The AI's real work is reconciliation, not OCR

"Read a name and amount from a screenshot" is OCR plus fuzzy matching. Judges will score it as a wrapper. The harder problem is joining a proof to a ledger: a hash that is not on-chain, a duplicate row, a short payment, an unknown reference, a payment with no reference.

Decision: the LLM only transcribes. It returns `{rows: [{name, amount_tbnb, note}], unreadable: []}`. Deterministic code normalizes names, matches exact reference and amount, checks each hash against BSC Testnet, and builds the reconciliation table. The AI's output is advisory; the organizer confirms; the contract holds the money. The visible trace is four steps: extract, normalize, match, flag.

This means the honest track is Payments, not AI Agents. A single extraction call is not an agent, and the agent framing invites autonomy questions the team does not need to answer. The AI still carries the 25-point "use of AI" score because it does real reconciliation work with visible guardrails. If the team wants the AI Agents category, the AI needs a real tool loop, for example it calls the RPC to verify hashes. That is a stretch for two hours and an overclaim risk. Do not do it.

### 5. The demo's load-bearing moment is a false completion

The progress bar is setup. The memorable moment is a payment list that looks complete but is not.

Staged numbers: target 0.50 tBNB; five members at 0.10 each. On-chain: four full payments and one 0.08 payment = 0.48. The treasurer's list shows 0.58 because one 0.10 row appears twice. A naive treasurer sees 0.58 and thinks the target is met. The AI reconciles the list to the chain: one duplicate row, one short payment of 0.02. The contract's release reverts at 0.48. The short member tops up 0.02. The chain total reaches 0.50. Release succeeds; the vendor balance rises.

That one scene proves the chain alone is insufficient, because it cannot see the duplicate row in the treasurer's proof, and the AI is load-bearing, because it explains why the list and the ledger disagree. The contract still enforces custody and the target. The organizer signs the resolution.

Show it as one exception card, not a table: receipt crop or pasted row, extracted name, amount, reference, confidence, matched transaction, one Resolve button. The progress bar is secondary. Open on the mess — the group chat and the spreadsheet — not on a wallet modal.

### 6. Scope has to collapse to one flow

The first concept had two roles, two full paths, a create-collection flow, live OCR, wallet integration, a verified deploy, a public repo, commits on both days, and a pitch. That is too much for three people and two hours.

Decisions:
- Cut the create-collection flow. A script creates two collections: one happy path, one failed path. The UI operates on existing addresses. Put one-click creation on the roadmap slide.
- Cut live screenshot OCR from the critical path. Use a messy pasted payment list or a cached extraction. Keep the screenshot as a visual prop. The LLM still extracts; the matching still runs live.
- Cut the full refund UI. Keep `claimRefund` in the contract and pre-stage a failed collection. Show one claim click only if the happy path is done by T-90; otherwise show the function on BscScan.
- Cut the vendor marketplace, login, org profiles, notifications, analytics, and fee billing. The vendor is a test wallet; the fee is one slide.
- Keep the hard bar first: public repo, `.env` in `.gitignore`, funded testnet wallets, contract deployed and verified, commits on Nov 12–13.

### 7. The pitch and the business model

Pitch order: 20 seconds on the mess with a blurred real screenshot; 20 seconds on why GCash plus a spreadsheet fails at the hold and refund moment; 90 seconds on the demo; 20 seconds on why the chain and the division of labor; 20 seconds on the business model and close. Put "not split-bill, not freelancer escrow" on the slide. The escrow is the commodity; the reconciliation is the differentiator.

One-sentence pitch: "AmbAG is one link for a student org group buy: members pay with test money, AI reconciles the treasurer's messy payment list against the on-chain record and flags duplicates and short payments, and a smart contract holds the money until the target is met, or lets members claim refunds after the deadline."

Who pays: 99 pesos per collection or 1%, from the org's budget, not the collected funds. The B2B path is the university student-affairs office buying it for all orgs. That is one slide, not a demo. The vendor cashes out through an exchange in production; today the vendor is a test wallet.

### 8. Risks and what must be true

- **Member wallet adoption.** The demo works with three funded test wallets, but a real student will not install a wallet for a small share. The Phase 2 slide must say embedded wallets and a GCash on-ramp. If a judge asks, answer directly; do not pretend the problem does not exist.
- **tBNB and verification slip first.** Faucets are rate-limited, and BscScan verification fails on compiler or constructor details. Start both at minute 0. If the deployer has 0 tBNB at minute 10, stop coding and ask the room.
- **AI variance.** Vision extraction can fail on venue Wi-Fi or a bad screenshot. Cache the extraction, keep a paste-text fallback, and rehearse the fallback. Never debug on stage.
- **PII and PDPA.** Use fake names and fake receipts in the demo. Do not upload real GCash receipts to an LLM. The university buyer will ask.
- **Custody and regulation.** Testnet only. The contract is non-custodial; the production version needs a licensed partner or a stablecoin rail. Put that on the "what's next" slide, not in the demo.
- **Judges compare it with the taught ideas.** The taught ideas are Baon Bot, split-bill, freelancer escrow, and lost-and-found. AmbAG is the collection side, not the split side; the pain is the chase and the liquidation report, not the math. Say this in the first 20 seconds.

### 9. The Ideal Final Result

The chain is a pseudonymous cash register: complete about money, silent about people. The AI proposes; the organizer signs; the chain verifies. No PII is immutable, every settled row has a chain-verifiable transaction hash, and no one has to trust the treasurer's spreadsheet.

## Goals vs. Non-Goals

**In-Scope Goals**

- One Solidity contract on BSC Testnet: target, deadline, fixed vendor, `contribute(id, ref)`, `release(id)`, `claimRefund(id)`.
- One AI endpoint: transcribe a messy payment list into rows; the app matches exact reference and amount, checks hashes, and flags duplicates, short payments, unknown references, and name mismatches.
- One dashboard: public view and treasurer view, progress bar, one exception card, release and claim buttons.
- Two seeded collections: happy path with a 0.50 target, 0.48 on-chain, one duplicate row in the list, and one 0.02 short payment; failed path with a past deadline.
- Verified contract on chain 97, public Git repo, commits on Nov 12–13, pitch deck, 90-second backup video.

**Out-of-Scope Non-Goals**

- GCash integration, fiat on-ramp, or off-ramp.
- On-chain names or any PII.
- Organizer create flow exposed in the UI, factory contract, multi-org dashboard, login, notifications, analytics.
- Full refund UI; one claim click at most.
- Vendor onboarding, KYB, real fee billing.
- General fuzzy matching or ML; live camera OCR on the critical path.
- Mainnet, real funds, token launch.

## Alternatives Weighed

- **GCash screenshot as the primary reconciliation flow.** Rejected: it creates a two-rail proof problem. GCash proves pesos, not tBNB. Keep it on the problem slide.
- **Organizer-only commitment vault, members on GCash.** Rejected as the primary: it removes member custody, makes refunds manual, and weakens the "why chain" answer. Kept as a fallback if member wallet integration slips in rehearsal.
- **On-chain names.** Rejected: permanent public PII, gas cost, wallet memo limits, and subjective name matching. Replace with 6-character references and an off-chain roster.
- **Full "agent" framing.** Rejected: one extraction call is not an agent. Enter Payments; describe the AI as reconciliation, not autonomy.
- **Generic "any collection" positioning.** Rejected: refunding at 97% looks punitive. Narrow to group buys where partial funds are useless.
- **Create-collection flow.** Rejected for time. Pre-deploy two collections and put creation on the roadmap.
- **Split-bill, Baon Bot, freelancer escrow, lost-and-found.** Rejected as crowded taught ideas. AmbAG is the collection side, not the split side.
- **Live OCR on stage.** Rejected from the critical path. Use a pasted list or cached extraction; keep the screenshot as a prop.
- **Full refund UI and second demo path.** Rejected for time. Keep the contract function and one pre-staged claim; the primary guardrail is the release revert plus the AI explanation.

## Key Decisions & Staging for Next Steps

**Contract**

- Single file, compiler 0.8.19, optimization on, no proxy, no external libraries beyond a reentrancy lock.
- State: `organizer`, `vendor`, `target`, `deadline`, `totalRaised`, `released`, `mapping(address => uint256) contributed`, `Contribution[] contributions`.
- `contribute(uint256 id, bytes32 ref) payable`: rejects zero value, rejects after release or deadline, records payer, ref, amount.
- `release(uint256 id)`: callable by anyone when `totalRaised >= target`; sends `totalRaised` to the fixed vendor; sets `released`; reentrancy guard.
- `claimRefund(uint256 id)`: after the deadline only if `totalRaised < target`; returns the caller's contribution once; reentrancy guard.
- No admin withdrawal, no upgradeability, no fees. Deploy once; create two collections with a script.
- Use `collections(id)` and `contributionsOf(id)` view calls after each transaction. Do not build event indexing or websockets.

**Data**

- On-chain: payer, ref, amount, timestamp, event.
- Off-chain: `ref -> {name, expectedAmount}` roster in a local JSON file.
- LLM output: `{rows: [{name, amount_tbnb, note}], unreadable: []}`. The app adds `txHash`, `ref`, `confidence`, `flags`.
- Flags: duplicate (same reference or same normalized name and amount in the list), short (aggregate actual below expected), unknown (no roster match), missing (roster name with no payment). Define these on the slide; do not let the model decide.

**Demo Sequence**

1. Open on the mess: the group chat and the spreadsheet. No wallet modal (10 seconds).
2. Show the verified contract on BscScan (10 seconds).
3. Happy collection: target 0.50, on-chain 0.48. The treasurer's list says 0.58. AI flags a duplicate row and a 0.02 short payment. The exception card shows the evidence (20 seconds).
4. Click Release. It reverts: target not met (10 seconds). This is the guardrail beat.
5. The short member tops up 0.02. Total 0.50. Release succeeds; the vendor balance rises (20 seconds).
6. Switch to the failed collection. If time, one claim click; otherwise show `claimRefund` on BscScan and say the refund is pull-based (10 seconds).

**Build Sequence (120 minutes)**

- 0–10: freeze spec and config; confirm wallets, tBNB, API key, repo.
- 10–50: parallel build — contract/deploy, AI/backend, frontend.
- 50–90: integrate; seed both collections; test with real chain rows.
- 90–105: rehearse twice with three browser profiles; record backup video; deck.
- 105–120: final rehearsal and submission. Feature freeze at 105. No code after 105.

**Hard Bar**

- Public repo; `.env` in `.gitignore`; commits every 20 minutes.
- tBNB in at least four wallets; chain 97 added before the demo.
- Contract deployed and verified by T-50; BscScan link on the title slide.
- Deck by T-60; backup video by T-105.

**Fallbacks**

- Cached extraction JSON in `localStorage`; live call fires in the background and replaces it only within 8 seconds.
- Paste-text LLM call; deterministic parser for the staged list; 20-second recorded clip as last resort.
- One retry maximum. Do not debug on stage. Phone hotspot and a second API key ready.
- If member wallet integration slips by T-50, switch to the organizer-only commitment vault and pitch the liquidation report. Do not demo both.

**Open Questions for the Team**

- Can the three of you cover the contract, the AI/backend, and the frontend without blocking each other? If not, cut the frontend to a single HTML page with ethers.
- Do you have a vision-capable API key and a funded testnet wallet now? If not, the paste-text fallback is the primary path.
- Which collection story will you use in the pitch: jackets, venue deposit, or grad photos? Pick one and use the same numbers in the demo and the deck.
