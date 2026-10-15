# MICOW — NFT Marketplace on Solana

> Marketplace NFT self-built, dibangun dari nol di atas standar terbuka Metaplex
> dan API publik Solana. Tidak menyalin kode, aset, atau sistem privat platform
> manapun (Magic Eden, Tensor, dll).

**Status:** Phase 1 — Product & Protocol Specification (draft)
**Owner:** cryptobloxq
**Dibuat:** 2026-10-14

---

## 1. Visi Produk

**Masalah.** Marketplace NFT Solana yang ada (Magic Eden, Tensor) adalah produk
komersial besar dengan kurva biaya dan kompleksitas tinggi bagi kreator kecil dan
kolektor baru. Kreator indie kesulitan meluncurkan koleksi dengan biaya rendah,
kontrol royalti yang jelas, dan UI yang tidak penuh noise trading.

**Solusi (micow).** Marketplace NFT ringkas yang fokus pada:
- **Mint & launch koleksi murah** lewat Metaplex Core + Candy Machine v3.
- **Listing/buy yang aman** dengan escrow on-chain standar terbuka.
- **Royalty kreator yang eksplisit** dan transparan (bukan opsional tersembunyi).
- **Onboarding ramah** untuk user non-crypto (opsional embedded wallet).

**Target pengguna awal.** Kreator indie Solana + kolektor retail (1–2 wallet).
Bukan institutional trading desk (itu domain Tensor).

**Diferensiasi.** Sederhana, self-custodial, biaya rendah, royalty jelas.
Bukan "clone" — melainkan produk dengan scope sempit yang dikerjakan dengan benar.

---

## 2. Ruang Lingkup MVP

### In-scope (MVP)
| # | Fitur | Sumber |
|---|-------|--------|
| F1 | Connect wallet (Phantom/Solflare/Backpack + Wallet Standard) | Wallet Adapter |
| F2 | Browse koleksi & detail NFT | Helius DAS (`getAsset`, `getAssetsByGroup`) |
| F3 | Profil user: NFT dimiliki, koleksi dibuat | DAS (`getAssetsByOwner`, `getAssetsByCreator`) |
| F4 | Mint koleksi via Candy Machine v3 (Core assets) | `mpl-candy-machine` |
| F5 | Listing fixed-price non-custodial | Core Transfer Delegate (plugin); aset tetap di wallet seller |
| F6 | Buy / cancel listing | Delegate transfer (buy) + revoke (cancel) |
| F7 | Riwayat aktivitas (mint/list/sale/transfer) | Helius Webhooks + Enhanced TX |
| F8 | Halaman koleksi SEO-friendly + OG image dinamis | Next.js Metadata API |

### Out-of-scope (post-MVP)
- Auction (English/Dutch), offers/bids
- Compressed NFT (cNFT) minting
- Fiat on-ramp / fiat payment
- Mobile native app
- Reverse-engineering data atau UI dari platform lain (secara eksplisit TIDAK dilakukan)

---

## 3. Arsitektur Sistem

```
┌──────────────┐     ┌──────────────────────────────────────┐
│  Browser     │     │  Edge / Cloudflare Pages + Workers    │
│  (wallet)    │────▶│  Next.js 15 App Router (RSC + ISR)    │
└──────────────┘     │  - Halaman koleksi/NFT (SSR/ISR)      │
        │            │  - OG image dinamis                   │
        │ txn sign   │  - API routes (read model)            │
        ▼            └──────────────┬───────────────────────┘
┌──────────────┐                    │
│ Solana       │                    ▼
│ Cluster      │        ┌──────────────────────────┐
│ - Core prog  │◀──────▶│  Postgres (Supabase)      │
│ - Candy Mach │  DAS   │  read model + index cache │
│ - Escrow     │        └──────────────┬───────────┘
│ - Metaplex   │                       │
└──────┬───────┘                       │
       │ webhooks/geyser               │
       ▼                               ▼
┌──────────────────────────┐   ┌────────────────────┐
│ Helius (DAS, Webhook,    │   │ Worker (Inngest /  │
│ Enhanced TX, RPC)        │──▶│ BullMQ) metadata   │
└──────────────────────────┘   │ sync + reconcile   │
                               └────────────────────┘
```

**Sumber kebenaran (tidak bisa dinegosiasi):**
- Kepemilikan NFT & state listing → blockchain (program), bukan backend.
- Hasil transaksi → signature + status confirmed dari RPC.
- Data pencarian/riwayat → Postgres (read model yang **direkonstruksi** dari chain).
- Backend **tidak pernah** dianggap sumber kebenaran saldo/ownership.

---

## 4. Stack Teknis (final untuk MVP)

### Frontend
| Layer | Pilihan | Alasan |
|-------|---------|--------|
| Framework | **Next.js 15 App Router + React 19 + TS strict** | SEO marketplace wajib SSR/ISR |
| Styling | **Tailwind CSS v4 + shadcn/ui + lucide-react** | Custom branding cepat, no vendor lock |
| Animasi | **motion (Framer Motion)** | Transisi halus listing/modal |
| Data client | **TanStack Query v5 + Zustand** | Cache RPC + state ringan |
| Wallet | **@solana/wallet-adapter-react + Wallet Standard** | De-facto standar; forward-compatible |
| Solana client | **@solana/kit (web3.js v2)** untuk build txn | Modern, tree-shakeable |

### On-chain
| Layer | Pilihan | Alasan |
|-------|---------|--------|
| NFT standard | **Metaplex Core** | 1 akun/asset, mint ~80% lebih murah, plugins |
| Launch/mint | **Candy Machine v3** | Guard (harga, allowlist, fase, limit) |
| Listing/buy | **Non-custodial** via **Core Transfer Delegate** (plugin) | Aset tetap di wallet seller; tanpa audit program; AH deprecated |
| Program framework | **Anchor 0.31** (sudah terpasang) | Aman, IDL, testable |
| Storage metadata | **IPFS / Pinata** (REST) | Permanen, tanpa SDK berat, gateway publik |

### Backend & Data
| Layer | Pilihan | Alasan |
|-------|---------|--------|
| Indexer | **Helius DAS + Webhooks** (MVP) → abstraksi `IndexerProvider` | Ship hari vs bulan; bisa swap ke Geyser nanti |
| Database | **Supabase Postgres** | Managed, RLS, murah |
| ORM | **Drizzle ORM + drizzle-kit** | Ringan, edge-friendly, SQL-first |
| Cache/queue | **Upstash Redis** + **Inngest** (MVP) → **BullMQ** saat self-host | Edge runtime tak punya long-running worker |
| Storage aset | **Cloudflare R2 / Supabase Storage** (cache gambar) | Hemat bandwidth |

### Infra & Delivery
| Layer | Pilihan |
|-------|---------|
| Monorepo | **pnpm workspaces + Turborepo** |
| CI/CD | GitHub Actions (lint, typecheck, test, secret scan) |
| Deploy web | **Cloudflare Pages** (user punya CF DNS) — BUKAN Vercel |
| Deploy worker | Railway / Fly.io (Docker) / self-host |
| Monitoring | Sentry + Cloudflare Analytics + Helius dashboard |
| Wallet (opsional) | Privy / Dynamic untuk embedded wallet (onboarding non-crypto) |

---

## 5. Struktur Monorepo

Diadaptasi dari `struktur-projects.md` ke konteks Solana:

```text
micow/
├── apps/
│   ├── web/                    # Next.js dApp (marketplace)
│   └── worker/                 # metadata sync, reconcile, backfill
│
├── packages/
│   ├── domain/                 # entities: Asset, Collection, Listing, Activity + invariants
│   ├── application/            # use cases: CreateListing, BuyAsset, MintFromCM...
│   ├── database/               # Drizzle schema + migrations + client
│   ├── solana/                 # program clients, wallet helpers, DAS client
│   ├── config/                 # env terskema (zod)
│   ├── observability/          # logging, metrics, tracing
│   ├── validation/             # zod schemas bersama
│   └── ui/                     # shadcn components
│
├── programs/                   # Anchor workspaces (jika escrow custom)
│   └── micow-marketplace/
│       ├── programs/micow-marketplace/src/
│       ├── tests/
│       └── Anchor.toml
│
├── infra/
│   ├── docker/
│   └── runbooks/
│
├── docs/
│   ├── product/                # PRD, SRS
│   ├── architecture/           # arsitektur, diagram
│   ├── protocol/               # state machine listing, invariants
│   ├── security/               # threat model
│   └── adr/                    # Architecture Decision Records
│
├── tests/e2e/
├── .github/workflows/
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

**Prinsip dependency:** `domain` tidak depend ke framework/DB/chain client.
`application` orkestrasi lewat interface. Infra implementasi interface.
Frontend tak menyimpan private key. Backend tak jadi sumber kebenaran on-chain.

---

## 6. Protocol Specification — Listing (draft)

### State machine Listing
```
   createListing
        │
        ▼
   ┌─────────┐   buy        ┌───────────┐
   │ ACTIVE  │─────────────▶│  FILLED   │  (terminal)
   └────┬────┘              └───────────┘
        │ cancel / expire
        ▼
   ┌───────────┐
   │ CANCELLED │  (terminal)
   └───────────┘
```

### Invariants
- **I1** — Sebuah asset hanya boleh punya ≤ 1 listing `ACTIVE` pada satu waktu.
- **I2** — Saat listing `ACTIVE`, asset berada di escrow PDA (custody program).
- **I3** — Buy hanya sukses jika pembayar mengirim `price + marketplace_fee` tepat;
  royalty kreator ditransfer sesuai plugin/atribut.
- **I4** — Cancel hanya oleh seller asli, mengembalikan asset ke seller.
- **I5** — Pembagian dana deterministik: `seller + platform_fee + creator_royalty == price_charged`.
- **I6** — Listing kedaluwarsa tidak bisa dibeli; cancel selalu bisa setelah expiry.

### Event on-chain
`ListingCreated`, `ListingCancelled`, `ListingFilled`, `ListingExpired`.

---

## 7. Data Specification (read model — draft)

| Entity | Field kunci | Sumber |
|--------|-------------|--------|
| `assets` | mint, name, uri, image, collection, owner, core(bool) | DAS |
| `collections` | address, name, image, verified, size | DAS |
| `listings` | id, asset, seller, price, fee, status, expiry, tx | chain + backend |
| `activities` | id, type, asset, from, to, price, ts, tx | Webhooks |
| `sync_jobs` | id, kind, cursor, status, attempts, last_error | backend |

Semua tabel dapat **direkonstruksi ulang** dari chain/dari DAS (replayable).
`cursor`/checkpoint memungkinkan backfill tanpa duplikasi (idempotent upsert).

---

## 8. Threat Model (ringkas — draft)

| Aset | Aktor ancaman | Trust boundary | Mitigasi |
|------|---------------|----------------|----------|
| NFT di escrow | Seller jahat | program PDA | invariant I1–I4, test fuzz |
| Dana buyer | Pembeli/seller | escrow program | pembagian deterministik (I5) |
| Royalty kreator | Marketplace | plugin Core | verifikasi on-chain, bukan off-chain saja |
| API keys (Helius) | pihak luar | server env | secret di server-only, rotasi, RLS |
| Spoof listing | penyerang | indexer | backend tak jadi sumber kebenaran; verifikasi ke chain |
| Front-running buy | MEV | mempool | slippage/deadline, tx simulation |

**Aturan keras:** private key/seed **tidak pernah** menyentuh frontend atau backend
(marketplace non-custodial). Semua signing terjadi di wallet pengguna.

---

## 9. Roadmap (mengikuti Phase 0–7 `struktur-projects.md`)

| Phase | Deliverable | Gate |
|-------|-------------|------|
| **0** Discovery | visi, model bisnis, pilihan chain, risk register | Feasibility approval |
| **1** Spec ⬅️ *kita di sini* | PRD, SRS, protocol spec, tokenomics, threat model, API spec, ADR, test strategy | Spec lengkap tanpa tebakan |
| **2** Foundation | monorepo, CI, env schema, Drizzle migration, ADR awal | clean build reproduce, lint/type/test di CI |
| **3** Implementasi | domain → programs → test → indexer → API/worker → frontend → e2e | coverage berbasis risiko |
| **4** Security | audit kontrak, invariant/fuzz, economic analysis | tidak ada isu critical/high terbuka |
| **5** Testnet | rehearsal deploy di devnet, e2e penuh | go/no-go |
| **6** Mainnet | deploy terkontrol, multisig authority, verifikasi program | monitoring aktif |
| **7** Operasi | monitoring, incident response, upgrade path | continuous assurance |

Urutan implementasi Phase 3 (dependency-correct):
`domain → programs → contract tests → indexer/persistence → API & workers → frontend/wallet → e2e`

---

## 10. Milestone MVP (estimasi kasar)

| M | Deliverable | Exit criteria |
|---|-------------|---------------|
| M1 | Monorepo + wallet connect + browse koleksi (DAS) | User bisa connect & lihat NFT |
| M2 | Postgres + Drizzle + sync worker | Read model terisi dari DAS |
| M3 | Candy Machine mint end-to-end di devnet | Mint sukses, muncul di DB |
| M4 | Escrow program + listing/buy + test fuzz/invariant | Listing lifecycle lolos test |
| M5 | SEO, OG dinamis, aktivitas realtime (webhook) | Halaman terindeks + feed hidup |
| M6 | Hardening + rehearsal devnet | siap go/no-go mainnet |

---

## 11. Yang TIDAK kita lakukan (batasan etis & legal)

- ❌ Tidak reverse-engineer, decompile, atau scrape sistem privat platform lain.
- ❌ Tidak menyalin kode, desain, aset, atau API privat Magic Eden/Tensor/dll.
- ✅ Hanya pakai **standar terbuka** (Metaplex Core/Candy Machine, dan plugin bawaan Core),
  **API publik/resmi** (Helius DAS, Solana RPC), dan library open-source berlisensi.
- ✅ Fitur "mirip secara konsep" (listing, mint, koleksi) boleh — karena itu
  standar industri publik, bukan milik satu platform.

---

## 12. Keputusan tertunda (perlu dijawab sebelum Phase 2)

| # | Pertanyaan | Status / Keputusan |
|---|-----------|---------------------|
| D1 | Escrow: Auction House (standar) / program Anchor sendiri / non-custodial? | ✅ **Non-custodial via Core Transfer Delegate** (ADR-0005 rev) — AH deprecated & tak kompatibel Core; escrow kustom ditunda |
| D2 | Wallet: cukup **Wallet Adapter** atau tambah **Privy** (email login)? | 🔶 Adapter dulu (ADR-0004); Privy ditunda ke M5 |
| D3 | Network awal: devnet → mainnet-beta | ✅ **devnet** untuk M1–M5 |
| D4 | Nama & identitas brand "micow" (logo, domain, dll) | ⬜ TBD |
| D5 | Model fee platform (%) dan enforcement royalty | 🔶 split deterministik di `ListingGateway` (ADR-0005 rev) + guard CM (ADR-0008); angka final TBD |

Tambahan: jalur launch/mint diputuskan di **ADR-0008** (Candy Machine v3 + Core
via Umi, tanpa program kustom).

---

## Referensi (semua publik/resmi)

- Metaplex Core: https://developers.metaplex.com/core
- Candy Machine v3: https://developers.metaplex.com/candy-machine
- DAS API: https://developers.metaplex.com/das-api
- Core Transfer Delegate Plugin: https://developers.metaplex.com/smart-contracts/core/plugins/transfer-delegate
- Helius DAS: https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api
- Helius Webhooks: https://docs.helius.dev/webhooks-and-websockets/webhooks
- Solana Wallet Adapter: https://github.com/anza-xyz/wallet-adapter
- Next.js App Router: https://nextjs.org/docs/app
- Drizzle ORM: https://orm.drizzle.team
- Anchor: https://www.anchor-lang.com
