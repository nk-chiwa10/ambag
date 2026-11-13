# Build Day notes

Working reference for pitch/build decisions. Not part of the app.

## The formula

AI (understands, decides, does the busywork) + BSC (moves money, records proof, enforces rules) = a product people can trust and pay for.

Guardrail: AI recommends and flags; the contract enforces. No AI on the money path.

## Five questions before committing

1. Real person, frequent pain? Student org/class treasurers reconcile GCash payments in spreadsheets; members cannot see who has paid. Real, but episodic (per collection), not weekly.
2. Why AI? It reads the treasurer's messy payment list so nobody retypes it, and flags duplicates and short payments.
3. Why on-chain? Escrow holds funds until the target, refunds if it is not met, and contributions are public proof.
4. Demo one flow in a day? Yes: one contract, one collection, one "list says 0.38, chain says 0.28" moment.
5. Would they pay or use it weekly? Per collection: 99 pesos or 1% from the org budget. Not weekly; each new collection is the return reason.

## Idea bank (fallbacks, if AmbAG is dropped)

1. Fair Split: split-bill agent. AI reads receipt items; BSC stablecoin transfers plus a shared IOU ledger.
2. Freelancer invoice agent. AI drafts scope/invoice from chat; BSC milestone escrow releases on approval.
3. Remittance planner. AI suggests a family split; BSC locks funds in envelope contracts.
4. Allowance Bot. AI sorts requests and flags unusual ones; BSC enforces spending limits.
5. Pay-per-source research agent. AI plans research and buys only needed data; BSC x402 micropayments per API call.
6. Neighborhood store restock agent. AI forecasts stock from sales notes; BSC escrow pays the supplier on delivery.

Pattern: one AI-understanding step, one BSC-enforcement step, one flow.

## Judge rubric (draft, out of 100)

- Technical execution and BSC: 30. Demo works, on-chain logic essential.
- Use of AI: 25. Real work, sensible guardrails.
- Problem and impact: 20. Real user with a real pain.
- User experience: 15. A non-crypto user can finish the flow.
- Pitch and clarity: 10. Clear story, on time, solid Q&A.

## Pre-flight checklist

- [ ] Fresh dev wallet funded with tBNB
- [ ] BSC Testnet added to that wallet
- [x] Local compile/deploy script works (solc 0.8.19 + ethers)
- [ ] Contract deployed and verified on BscScan
- [ ] LLM API key that can call a tool
- [x] Repo ready, `.env` in `.gitignore`
- [x] Idea in one sentence, who does what

## Demo framing

Keep the BCC/BNB Chain story: student org group buy on BSC Testnet with tBNB and AI reconciliation. Class funds is a problem-slide example only, not a scope change.
