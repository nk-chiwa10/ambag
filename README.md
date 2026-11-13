# AmbAG

Group-buy collection for student orgs, built for BCC 2026 Build Day.

One link. One target. One rule. Members pay in tBNB on BSC Testnet. The AI transcribes the treasurer's messy payment list, the app matches it to the on-chain record, and the contract holds the money until the target is met or the deadline passes.

## Files

- `build/AmbAG.sol` — the contract.
- `server.js` — local Express server and the `/api/extract` endpoint.
- `public/` — the member link and treasurer dashboard.
- `public/deck.html` — the 6-slide pitch deck. Open `/deck.html`, arrow keys to move, `P` to print to PDF.
- `scripts/seed.js` — creates the happy and failed collections and pre-seeds the demo payments.
- `npm run inspect` — read-only chain dump: collections, references, contributions, vendor balance. No key required.
- `concepts_brief.md` — the brainstorm decisions and demo script.

## 1. Deploy

```bash
npm install
npm run deploy
```

The script compiles with solc `0.8.19` (optimizer on, 200 runs, EVM `paris`), deploys to chain 97 from `DEPLOYER_KEY`, writes `CONTRACT_ADDRESS` to `.env`, and saves `build/AmbAG.artifact.json`. With an empty `DEPLOYER_KEY` it generates a throwaway wallet and prints the address to fund.

Verify on `https://testnet.bscscan.com/verifyContract` using the same compiler settings.

## 2. Configure

```bash
cp .env.example .env
```

Fill:

- `DEPLOYER_KEY` — the organizer wallet. Testnet only.
- `VENDOR_ADDRESS` — the vendor wallet. If empty, the deployer is used.
- `MEMBER_KEYS` — three comma-separated test wallet keys for Maria, Jose, and Ella.
- `MOCK_AI=1` — works without an API key. Set to `0` and fill `OPENAI_API_KEY` for real extraction.

Do not commit `.env`. It is already in `.gitignore`.

## 3. Seed

```bash
npm install
npm run seed
```

The script creates:

- Collection 1: target `0.30` tBNB. Maria `0.10`, Jose `0.10`, Ella `0.08` = `0.28` on-chain. Deadline two hours out.
- Collection 2: target `0.30` tBNB. One `0.02` contribution. Deadline two minutes out, so it expires before the demo.

It prints the collection IDs and totals. Use collection 1 for the happy path and collection 2 for the refund path.

If you prefer Remix, call `createCollection(vendor, 300000000000000000, deadline)` twice and `contribute(id, ref)` from each member wallet. Use the refs `AMB001`, `AMB002`, `AMB003`:

- `AMB001` Maria Santos, expected `0.10`
- `AMB002` Jose Dela Cruz, expected `0.10`
- `AMB003` Ella Garcia, expected `0.10`

## 4. Run

```bash
npm run dev
```

Open `http://localhost:3000`.

Paste the contract address and collection ID, then click **Load collection**.

## 5. Demo

1. Load collection 1.
2. Click **Load demo list**. The list is:

   ```text
   Maria Santos - 0.10
   Jose Dela Cruz - 0.10
   Jose Dela Cruz - 0.10
   Ella Garcia - 0.08
   ```

3. Click **Extract with AI**.
4. The table flags Jose's duplicate row and Ella's `0.02` short payment. The list says `0.38`; the chain says `0.28`.
5. Click **Try release**. The contract reverts with `target not met`.
6. Connect Ella's wallet, choose Ella, pay `0.02`.
7. Click **Release to vendor**. The vendor balance rises by `0.30`.
8. Load collection 2. Click **Claim refund** from a contributing wallet.

## Troubleshooting

- **Wrong network.** The app prompts to switch to chain 97. If the wallet does not have it, it adds the network.
- **No tBNB.** The faucet needs at least `0.002` BNB on mainnet in the same wallet. Ask the room if the faucet is rate-limited.
- **Verification fails.** Check compiler `0.8.19`, optimization on, and the constructor arguments. Verify immediately after deploy.
- **AI fails.** Set `MOCK_AI=1` and use the demo rows. The paste box is the fallback; do not debug vision on stage.
- **Port in use.** Run `PORT=3001 npm run dev`.

Testnet only. No real funds, no token launch.
