# Deploy log

Shared source of truth for chain state. `.env` is never committed, so the address lives here.

- Target chain: BNB Smart Chain Testnet (97)
- Compiler: solc 0.8.19 · optimizer on · runs 200 · EVM `paris`

## Status

| Check | Public testnet (97) | Local fallback (31337) |
|---|---|---|
| Contract deployed | [ ] blocked: faucet needs mainnet BNB | [x] `0x8D03157bAe4E1e61877cc19466522a0cE6E413BC` |
| Verified on BscScan | [ ] | [ ] impossible on a local chain |
| Wallets funded | [ ] | [x] 0.15 tBNB each |
| Collections seeded | [ ] | [x] #1 open 0.28 / 0.30, #2 refundable 0.02 / 0.30 |
| Read path checked (`npm run inspect`) | [ ] | [x] |

The organizer approved simulating the testnet RPC with a local node for online participants. A local deployment does **not** satisfy the BSC Testnet + BscScan verification requirement; say so in the pitch.

## Addresses

| Item | Public 97 | Local 31337 |
|---|---|---|
| Contract | _pending_ | `0x8D03157bAe4E1e61877cc19466522a0cE6E413BC` |
| Deploy tx | _pending_ | `0xd99e683b91ad8987b75197a79ce03cfc11ad7dec6452a621faeb652f9057528b` |
| Deployer / organizer | `0x8b3a5E539fC17879297e42e8610ACDABC3C40C6f` | same |
| Vendor | _pending_ | `0xa684Ee643712614968C32493EAA8Ee199aF3b418` |
| Maria `AMB001` | _pending_ | `0xdF60a8A8d73C9AeD1F7C502Ec28236FF13494CF6` |
| Jose `AMB002` | _pending_ | `0x23030dC37755e8E19657c0933C5cc219cCD34662` |
| Ella `AMB003` | _pending_ | `0xc81EDD325B82C9b34E5e852340aABbb9F890cf8e` |
| Collection 1 (happy) | target 0.30, expected on-chain 0.28 | id 1, open |
| Collection 2 (failed) | target 0.30, expected on-chain 0.02, expired | id 2, refundable |

The local address is stable across resets because it is the deployer's first CREATE. Private keys stay in `.env`; run `npm run wallets` on the demo machine to print them for MetaMask.

## Reproduce the local state

```bash
npm run localnet     # chain 31337, funds DEPLOYER_KEY, keep this window open
npm run deploy
npm run wallets
npm run seed
npm run inspect
```

Verified on 2026-11-13: deploy 3212-byte bytecode, gas 761470, vendor payout and refund replay guard both pass in `npm run selftest`.

## Notes

- The machine that runs `npm run deploy` also runs `npm run wallets` and `npm run seed`, so keys and collections stay consistent.
- The other laptop copies only `CONTRACT_ADDRESS` and the three member keys into its own `.env`; its MetaMask must use the same RPC.
- If verification fails on public testnet, check EVM `paris` first, then optimizer runs = 200. Re-deploying beats fighting the verifier.
- Restarting the local node erases all state. Re-run deploy, wallets, and seed; the address will be the same.
