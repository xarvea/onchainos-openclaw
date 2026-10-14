# MICOW

Marketplace NFT Solana — dibangun dari nol di atas standar terbuka Metaplex
dan API publik Solana.

> **Status:** Phase 2 (Foundation) — monorepo ter-scaffold. Belum ada fitur produksi.
> Lihat `PROGRESS.md` untuk status terkini dan `docs/product/BLUEPRINT.md` untuk roadmap.

## Fitur (target MVP)
- Connect wallet (Wallet Standard / Wallet Adapter)
- Browse koleksi & detail NFT (via Helius DAS)
- Mint koleksi (Metaplex Core + Candy Machine v3)
- Listing fixed-price + buy/cancel (escrow on-chain)
- Riwayat aktivitas (Helius webhooks → Postgres read model)

## Stack
- **Chain:** Solana (devnet → mainnet-beta)
- **NFT:** Metaplex Core · **Launch:** Candy Machine v3 · **Listing:** escrow (Auction House → custom Anchor)
- **Indexer:** Helius DAS + webhooks → Postgres (di balik interface `IndexerProvider`)
- **Frontend:** Next.js 15 App Router + Tailwind v4 + `@micow/ui`
- **Backend:** Node + Drizzle + Postgres + Redis; worker Inngest
- **Monorepo:** pnpm workspaces + Turborepo
- **Deploy:** Cloudflare Pages (web) + worker self-host/Railway — **BUKAN Vercel**

## Struktur
```
micow/
├── apps/
│   ├── web/          # Next.js dApp
│   └── worker/       # Inngest jobs (metadata sync, reconcile)
├── packages/
│   ├── application/  # use cases + ports (framework-free)
│   ├── config/       # env schema (zod)
│   ├── config-eslint/# ESLint flat config
│   ├── config-ts/    # tsconfig presets
│   ├── database/     # Drizzle schema + client
│   ├── domain/       # entities + invariants (framework-free)
│   ├── observability/# structured logger
│   ├── solana/       # cluster, program IDs, DAS/Helius client
│   ├── ui/           # shared components
│   └── validation/   # zod schemas
├── docs/
│   ├── product/      # BLUEPRINT.md
│   ├── architecture/ # research-solana-nft-stack.md
│   ├── adr/          # ADR-0001..0007 (satu file per ADR) + README.md
│   └── operations/   # env.md
└── PROGRESS.md
```

## Prasyarat
- Node **>= 22.13** (pakai `.nvmrc`: `nvm use`)
- pnpm 10.x
- Postgres (lokal sudah tersedia) + Redis (opsional)
- Rust + Solana CLI + Anchor (untuk program escrow — Phase 3)

## Mulai
```bash
nvm use                 # Node 22.23.1
pnpm install
cp .env.example .env    # isi DATABASE_URL dst.
pnpm typecheck
pnpm test
pnpm --filter @micow/web dev   # http://localhost:3000
```

## Batasan etis
Proyek ini **tidak** melakukan reverse engineering, scraping, atau penyalinan
kode/desain/aset dari platform lain (Magic Eden, Tensor, dll). Hanya memakai
standar terbuka (Metaplex) & API publik/resmi (Helius, Solana RPC).

## Environment terverifikasi
```
node 22.23.1 (via nvm) · pnpm 10.26.1 · rustc 1.97.1 · solana 2.2.0 · anchor 0.31.1
postgres: accepting connections · redis: PONG
```
