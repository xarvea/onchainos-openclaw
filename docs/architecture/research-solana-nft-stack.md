# Riset Teknis — Solana NFT Stack (2025–2026)

Hasil riset dokumentasi resmi. Disimpan sebagai referensi Phase 1.

---

## Metaplex Core — standard NFT baru

- Model **single account**: 1 akun `Asset` menyimpan owner, name, uri, plugins.
- Hemat biaya mint hingga ~80% vs Token Metadata (tak perlu ATA terpisah).
- **Plugins** modular: Royalties, Freeze/Transfer/Burn Delegate, Attributes, dll.
- **Collections**: asset bertipe `Collection`, asset lain menunjuk `updateAuthority`.
- Program ID: `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d`
- SDK JS: `@metaplex-foundation/mpl-core` (1.x) + `@metaplex-foundation/umi`
- Rust crate: `mpl-core`
- Mint: `create()` / `createCollection()` → `transferV1()`
- Docs: https://developers.metaplex.com/core

**Kapan pakai:** proyek baru hampir selalu Core. Token Metadata hanya untuk
kompatibilitas ekosistem lama.

---

## Candy Machine v3 — launch/mint drop

- Guard: `solPayment`, `splTokenPayment`, `nftPayment`, `startDate`, `endDate`,
  `mintLimit`, `allowList`, `gatekeeper`, `addressGate`, `freezeSolPayment`, dll.
- Mendukung **Core assets** dan Token Metadata.
- Komponen: Candy Machine account + Candy Guard + Config Lines + Hidden Settings.
- SDK JS: `@metaplex-foundation/mpl-candy-machine` (6.x)
- Storage: `umi-uploader-irys` / `umi-uploader-arweave`
- CLI: `mplx cm create|upload|mint`
- Docs: https://developers.metaplex.com/candy-machine

**Alur:** upload asset+metadata → create CM+guard → insert config lines → mint V1.

---

## DAS (Digital Asset Standard) API

- Spesifikasi RPC non-standar (Metaplex + provider RPC) untuk **indeks & serve**
  data NFT seragam (Token Metadata, Core, Bubblegum/cNFT).
- Method: `getAsset`, `getAssetsByOwner`, `getAssetsByGroup` (collection),
  `getAssetsByCreator`, `getAssetsByAuthority`, `searchAssets`,
  `getAssetProof`/`getAssetProofBatch` (cNFT), `getNftEditions`.
- SDK JS: `@metaplex-foundation/digital-asset-standard-api`, `helius-sdk`
- Provider: Helius, Triton, QuickNode, Shyft, Alchemy.
- **Aturan:** selalu pakai DAS, jangan `getProgramAccounts` manual.
- Docs: https://developers.metaplex.com/das-api

---

## Token Metadata (lama) vs Core

| Aspek | Token Metadata | Core |
|-------|----------------|------|
| Akun | Mint + Metadata PDA + Master Edition + ATA | 1 akun Asset |
| Mint cost | ~0.01–0.015 SOL | ~0.003–0.005 SOL |
| Plugins | ❌ | ✅ modular |
| Royalty | field metadata | plugin Royalties |
| Ekosistem | sangat luas (legacy) | tumbuh, didukung ME & Tensor |
| Program ID | `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s` | — |

Bubblegum (cNFT) program ID: `BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY`

---

## Provider RPC

| Provider | Kekuatan | Free tier | Berbayar (indikatif) |
|----------|----------|-----------|----------------------|
| **Helius** | DAS, webhooks, Enhanced TX, cNFT | ~1M credit/bln | mulai ~$49/bln |
| QuickNode | jaringan global, add-on DAS | terbatas | ~$49–$299+/bln |
| Triton One | low-latency, Yellowstone gRPC | trial | custom (ratusan $) |
| Ankr | murah, multi-chain | public RPC | ~$10–30/bln |
| Shyft | khusus NFT/DAS | ada | — |
| Alchemy | multi-chain + Solana | ada | — |

**Pilihan micow:** Helius (DAS + webhook + Enhanced TX) sebagai MVP, rencana
failover ke QuickNode/Triton untuk produksi.

---

## Listing & Escrow On-Chain

> ⚠️ **Koreksi (2026-10-14):** bagian ini semula merekomendasikan **Auction House**.
> Setelah verifikasi ulang di docs resmi Metaplex, rekomendasi itu **DIBATALKAN**:
>
> - **Auction House: DEPRECATED** ("no longer actively maintained") **dan tidak
>   kompatibel dengan Metaplex Core.** AH dibangun di atas `mpl-token-metadata`
>   (model SPL mint + Metadata PDA); Core memakai satu akun tanpa mint. Tidak ada
>   adapter AH untuk Core.
> - **Fixed Price Sale: DEPRECATED** dan hanya Token Metadata (print edition).
> - **Core tidak punya program listing/sale/escrow bawaan.** Core menyediakan
>   `Transfer`/`Burn`/`Update` + sistem **plugin**.
>
> Keputusan pengganti ada di **ADR-0005 (rev): non-custodial listing via Core
> Transfer Delegate** — aset tetap di wallet seller, delegate memindahkan saat
> terjual (authority one-time, revoke setelah transfer).

**Opsi listing untuk aset Core (2026-10):**
1. **Non-custodial via Core Transfer Delegate plugin** (dipilih, ADR-0005 rev) —
   aset tetap di wallet seller; delegate → transfer saat sale. Tanpa program baru.
2. **Program escrow Anchor kustom** — kontrol penuh, biaya audit; ditunda.
3. **Marketplace pihak ketiga (Tensor/Magic Eden)** sebagai backend Core —
   ketergantungan pihak ketiga; tidak dipilih untuk MVP.

**Catatan pola:**
- Auction House (Token Metadata) & Fixed Price Sale: **jangan dipakai** (deprecated).
- Non-custodial orderbook (off-chain listing + signature) — gas murah, dipakai ME/Tensor.
- cNFT sale — butuh program khusus.

---

## Wallet Connect

- **Solana Wallet Adapter** (standar de-facto): `@solana/wallet-adapter-react`,
  `-react-ui`, `-wallets`. Support Phantom, Solflare, Backpack, Glow, Ledger.
  Docs: https://github.com/anza-xyz/wallet-adapter
- **Privy** — embedded wallet + auth (email/social), support Solana.
  Docs: https://docs.privy.io/wallets/using-wallets/solana/overview
- **Dynamic** — alternatif Privy, multi-chain. https://docs.dynamic.xyz

**Pilihan micow:** Wallet Adapter (crypto-native) dulu; Privy untuk onboarding massal.

---

## Best-practice stack fullstack

| Layer | Pilihan | Alasan |
|-------|---------|--------|
| Frontend | Next.js 15 App Router + React 19 + TS strict | SEO/SSR/ISR + OG dinamis |
| UI | Tailwind v4 + shadcn/ui + lucide + motion | cepat, no vendor lock |
| Data | TanStack Query v5 + Zustand | cache RPC + state ringan |
| Indexer | Helius DAS + Webhooks + cache Postgres | ship hari, bukan bulan |
| DB | Supabase Postgres | managed, RLS |
| ORM | Drizzle | ringan, edge-friendly |
| Queue | Inngest/Trigger.dev (serverless) → BullMQ (self-host) | edge runtime tak punya worker |
| Deploy | Cloudflare Pages + Workers (web) + Railway/Fly.io (worker) | hybrid, CF DNS sudah dimiliki |
| Monorepo | pnpm workspaces + Turborepo | reuse antar app/paket |

**Alasan pilih Next.js:** marketplace publik wajib SEO (halaman koleksi/NFT harus
terindeks + OG preview saat di-share).

---

## Environment terpasang (terverifikasi)

```
node     v20.20.2
npm      10.8.2
pnpm     10.26.1
rustc    1.97.1
cargo    1.97.1
git      2.43.0
solana   2.2.0 (Agave)
anchor   0.31.1
bun      (tidak ada)
```
