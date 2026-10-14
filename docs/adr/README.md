# ADR Log — MICOW

Catatan keputusan arsitektur (Architecture Decision Records).
Format tiap ADR: **Status / Konteks / Keputusan / Alternatif / Konsekuensi.**

| ADR | Judul | Status |
|-----|-------|--------|
| [0001](./ADR-0001-chain-solana.md) | Chain: Solana | Accepted |
| [0002](./ADR-0002-nft-standard-metaplex-core.md) | NFT Standard: Metaplex Core | Accepted |
| [0003](./ADR-0003-indexer-helius-das.md) | Indexer: Helius DAS + Webhooks | Accepted |
| [0004](./ADR-0004-frontend-nextjs-app-router.md) | Frontend: Next.js App Router | Accepted |
| [0005](./ADR-0005-escrow-auction-house.md) | Escrow: Auction House dulu | Accepted |
| [0006](./ADR-0006-orm-drizzle.md) | ORM: Drizzle | Accepted |
| [0007](./ADR-0007-monorepo-pnpm-turbo.md) | Monorepo: pnpm + Turborepo | Accepted |
| [0008](./ADR-0008-launch-candy-machine-v3.md) | Launch/Mint: Candy Machine v3 + Core (Umi) | Accepted |

## Keputusan tertunda (`BLUEPRINT.md §12`)

| # | Pertanyaan | Status |
|---|-----------|--------|
| D1 | Escrow: Auction House vs Anchor kustom | ✅ **Auction House** (ADR-0005) |
| D2 | Wallet: Adapter vs Privy | 🔶 Adapter dulu (ADR-0004); Privy ditunda ke M5 |
| D3 | Network awal | ✅ **devnet** untuk M1–M5 |
| D4 | Brand "micow" (logo/domain) | ⬜ TBD |
| D5 | Model fee platform & royalty | 🔶 mengikuti guard CM + Auction House (ADR-0005/0008); angka final TBD |
