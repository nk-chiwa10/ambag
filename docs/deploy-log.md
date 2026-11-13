# Deploy log

Shared source of truth for chain state. `.env` is never committed, so the address lives here.

- Chain: BNB Smart Chain Testnet (97)
- Compiler: solc 0.8.19 · optimizer on · runs 200 · EVM `paris`

## Status

- [ ] Contract deployed
- [ ] Contract verified on BscScan
- [ ] Wallets funded
- [ ] Collections seeded
- [ ] Live read path checked (`npm run inspect`)

## Addresses

| Item | Value |
|---|---|
| Contract | _pending_ |
| Deploy tx | _pending_ |
| Vendor | _pending_ |
| Collection 1 (happy) | target 0.30, expected on-chain 0.28 |
| Collection 2 (failed) | target 0.30, expected on-chain 0.02, expired |

## Notes

- The machine that runs `npm run deploy` also runs `npm run wallets` and `npm run seed`, so keys and collections stay consistent.
- The other laptop copies only `CONTRACT_ADDRESS` and the three testnet member keys into its own `.env`.
- If verification fails, check EVM `paris` first, then optimizer runs = 200. Re-deploying beats fighting the verifier.
