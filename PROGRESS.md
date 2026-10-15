# PROGRESS — MICOW

> Update log per task. Jaga file ini tetap akurat; ini sumber status tunggal.

## Ringkasan fase (framework Phase 0–7)

| Phase | Status | Catatan |
|-------|--------|---------|
| 0 — Discovery | ✅ selesai | visi, chain, model bisnis ada di BLUEPRINT §1 |
| 1 — Spec | 🟡 in progress | BLUEPRINT + riset + ADR ada; PRD/SRS/threat model detail menyusul |
| 2 — Foundation | 🟡 in progress | monorepo, CI, migrate, web read model, webhook+SEO selesai; escrow/mint belum |
| 3–7 | ⬜ belum | — |

## Task log

### 2026-10-14 — Phase 1: blueprint & riset
- [x] Riset stack Solana (Metaplex Core, Candy Machine v3, DAS, Helius, escrow, wallet)
- [x] `docs/product/BLUEPRINT.md` (visi, scope, arsitektur, protocol, data, threat, roadmap)
- [x] `docs/architecture/research-solana-nft-stack.md`
- [x] `docs/adr/ADR-0001..0007` (7 file terpisah) + `docs/adr/README.md` (indeks)
- [x] Koreksi deploy: NO VERCEL → Cloudflare Pages

### 2026-10-14 — Phase 2: perbaikan pasca-review
- [x] `git init` + commit awal (106 file, tanpa node_modules/artifacts)
- [x] `.nvmrc` diperbaiki — sebelumnya berisi komentar sehingga `nvm use` gagal
- [x] ADR dipecah: `docs/adr/ADR-0001..0007` (7 file) + `README.md` (indeks)
- [x] Bug DAS (`packages/solana`): `uri` diambil dari `json_uri` (bukan `''`),
  image prefer `files[].cdn_uri` > `links.image`, `getCollection` tak lagi
  mengarang `verified`/`standard`, paginasi penuh (loop halaman, cap 100)
- [x] `sync-asset`: logika diekstrak ke `syncAsset()` murni (bisa diuji tanpa
  Inngest); test lama hanya mereplikasi logika → false coverage, sudah dibuang
- [x] Test baru: `packages/solana/src/das.test.ts` (6 tes mapping DAS)
- [x] Lint: `container.ts` pakai `import type * as schema` → 0 warning
- [x] CI: `.github/workflows/ci.yml` (lint · typecheck · test · build + secret scan)
- [x] `.github/dependabot.yml` (paket npm/pnpm + GitHub Actions, mingguan)
- [x] Dokumen konsisten: sisa referensi "Vercel" → Cloudflare Pages

### 2026-10-14 — Phase 2: wire indexer → read model
- [x] Worker: use case `syncCollection`, `syncOwner`, `syncCollectionMeta` (paginasi
  ditangani indexer; upsert batch ke `AssetRepository`)
- [x] Fungsi Inngest kedua: `sync-collection` (event `micow/collection.sync`)
- [x] `buildWorker` merakit 2 fungsi + meneruskan `collections` repo ke deps
- [x] Port `AssetIndexer` diperluas (opsi limit/page, `getCollection` opsional)
- [x] Integration test `indexer-integration.test.ts`: pakai `HeliusDasIndexer` ASLI
  dengan `global.fetch` di-mock → membuktikan pipeline DAS JSON → domain → repo,
  termasuk paginasi 1001 aset lintas 2 halaman

### 2026-10-14 — Phase 2: Postgres + migrasi (M2)
- [x] Postgres 16 lokal: role `micow` + DB `micow` dibuat, `pnpm db:migrate` sukses
- [x] Verifikasi DB: 5 tabel (activities, assets, collections, listings, sync_jobs),
  14 index, 1 migrasi tercatat di `drizzle.__drizzle_migrations`
- [x] `pnpm db:generate` → "No schema changes" (schema vs migrasi sinkron, tanpa drift)
- [x] Integration test repo Drizzle vs **Postgres asli** (`repositories.integration.test.ts`):
  schema sekali-pakai di-drop setelah tes; membuktikan upsert idempotent, bigint
  price round-trip (1.5 SOL > 2^31), jsonb attributes, uuid
- [x] CI: service container Postgres 16 + langkah `pnpm db:migrate` sebelum test
- [x] Dokumentasi: `docs/operations/env.md` diberi langkah setup DB dari nol

### 2026-10-14 — Phase 2/M3: webhook Helius → activities + SEO/OG
- [x] Port `ActivityRepository` (append-only, idempotent) + `DrizzleActivityRepository`
  + `InMemoryActivityRepository` + wiring `container`
- [x] Mapper murni `packages/solana/src/helius-webhook.ts`: `HeliusEnhancedTransaction`
  → `Activity[]`; id deterministik `{signature}:{mint}:{type}` (replay = no-op),
  harga dari `events.nft.amount` lalu fallback `nativeTransfers`, **tidak mengarang
  history** untuk tipe/kunci tidak valid
- [x] `POST /api/webhooks/helius`: auth shared-secret **constant-time**, fail-closed
  (503 tanpa secret, 401 salah), retry-safe (200 ok, 500 saat gagal tulis)
- [x] Feed: `ActivityFeed` + halaman `/activity` + `/api/activities`
  (serialisasi bigint→string agar aman untuk nilai > 2^53)
- [x] SEO: `robots.ts`, `sitemap.ts` (statis + koleksi dari read model, degrade aman)
- [x] OG dinamis via `next/og`: root + per-koleksi (1200×630)
- [x] Metadata lengkap: canonical, robots, openGraph, twitter; portfolio `noindex`
- [x] `NEXT_PUBLIC_SITE_URL` di client env schema
- [x] Test: 13 tes mapper + integrasi DB (idempotency, bigint price, urutan blockTime)
- [x] Verifikasi end-to-end: dev server + Postgres nyata — webhook (401/ok/recorded),
  DB dedup 1 baris meski payload dikirim 2×, `/api/activities` & `/activity` render
  (badge SALE, 1.5 SOL), OG image PNG 1200×630, robots/sitemap valid

### 2026-10-14 — M3 #1: launch/mint Candy Machine v3 + Core (devnet)
- [x] Keputusan: D1 = Auction House (ADR-0005 Accepted), D3 = devnet;
  ADR-0008 baru: launch via Candy Machine v3 + Core (Umi), tanpa program kustom
- [x] `packages/solana` — dependency Umi + `mpl-core` + `mpl-core-candy-machine`
  (paket Core yang benar; `mpl-candy-machine` biasa = Token Metadata-only)
- [x] `umi-client.ts` — factory Umi (Core + Core Candy Machine) + loader keypair CLI
- [x] `launch.ts` — helper murni: `computeConfigLineSettings`, `buildMintGuards`,
  `assertValidItems` (13 unit test)
- [x] Port `CollectionMinter` (@micow/application) + `UmiCollectionMinter`
  (create Core collection → CM v3 + guards → insert items, chunked)
- [x] `scripts/probe-launch.ts` + script `pnpm --filter @micow/solana launch:probe`
- [x] **Terverifikasi on-chain (devnet)**: Core collection (owner program Core) +
  Candy Machine v3 (owner program `CMACYFE…`), items terisi, via minter asli
- [x] Fix env: hapus `NODE_ENV=development` dari `.env*` (merusak `next build` bila
  di-source) + wallet-provider fallback saat `NEXT_PUBLIC_SOLANA_RPC_URL` kosong

### 2026-10-14 — M3 #1 lanjutan: mint → read model (pipeline end-to-end)
- [x] Port `MetadataStorage` (@micow/application) — `putJson`/`putBytes`, framework-free
- [x] `packages/solana/src/storage.ts` — `InlineJsonStorage` (data-URI, offline) +
  `HttpStorage` (endpoint → `{ uri }`, Irys/ArDrive-agnostic) + 6 unit test
- [x] Use case `launchCollection` (@micow/application) — urutan metadata → storage →
  minter → read model; **abort sebelum chain bila storage gagal** (tak buang SOL);
  6 unit test (termasuk "tak pernah memalsukan `verified=true`")
- [x] Keputusan desain: **tidak** menulis baris aset saat launch — Candy Machine
  hanya menyimpan *config lines*, bukan aset ter-mint. Baris aset diisi indexer
  (`syncCollection` → DAS) saat mint masuk on-chain (mencegah phantom + tabrakan PK)
- [x] `apps/worker/scripts/probe-launch-e2e.ts` + script
  `pnpm --filter @micow/worker launch:e2e` — menjalankan use case asli dengan
  storage HTTP lokal (URI `http://…` benar-benar resolvable, lolos validasi minter)
- [x] **Terverifikasi on-chain (devnet)**: collection `96n8WA8…`, CM `2jAxFB6…`,
  3 signature; read model terisi `{name, size:2, verified:false}` ✅
- [x] Verifikasi penuh: typecheck 10/10, lint 10/10, test 56 (application 6,
  solana 37, domain 4, database 3+4 skip, worker 6), build 14 route + worker dist

### 2026-10-15 — M3: storage metadata → IPFS/Pinata (ganti Irys)
- [x] **Keputusan: buang Irys.** `@irys/cli` v0.0.19 rusak (prompt inquirer mati,
  `--no-confirmation` tak ngefek → fund/upload tak pernah jalan). Tidak ada
  dependency `@irys/*` di repo (terbukti), jadi tak ada yang perlu di-uninstall.
- [x] **Provider baru: IPFS via Pinata (REST).** `PinataStorage`
  (`packages/solana/src/storage.ts`) — `pinFileToIPFS` (multipart, bytes) +
  `pinJSONToIPFS` (JSON) via `fetch`, **tanpa SDK**. URI baca =
  `https://<gateway>/ipfs/<cid>`. Fail-loud (tak pernah kembalikan URI palsu);
  error tak membocorkan body/JWT.
- [x] **Env dinetralkan**: `IRYS_SECRET_KEY`/`IRYS_NODE_URL` →
  `ASSET_STORAGE_DRIVER` (`inline|http|pinata`), `PINATA_JWT`, `IPFS_GATEWAY`,
  `ASSET_STORAGE_ENDPOINT`, `ASSET_STORAGE_TOKEN`. `.env` + `.env.example` +
  `docs/operations/env.md` diperbarui; `.gitignore` diperketat (`.env.bak*`).
- [x] **Doc dibersihkan** (tak ada lagi sebutan Irys): `env.md`, `BLUEPRINT`,
  `research-solana-nft-stack`, `ADR-0008`, `probe-launch-e2e.ts`, `ports.ts`.
- [x] Test: `storage.test.ts` +5 tes Pinata (konstruktor, pin JSON, pin bytes
  multipart + normalisasi gateway, non-ok, missing `IpfsHash`).
- [x] **Factory `createMetadataStorage(cfg)`** (composition root): pilih driver
  `inline|http|pinata` dari `ASSET_STORAGE_DRIVER`; **fail-loud** bila kredensial
  kurang (tidak diam-diam turun ke `inline` yang menghasilkan URI `data:` tak
  durable). +3 unit test.
- [x] **Probe launch:e2e di-wire** ke factory: default server HTTP lokal (offline,
  tanpa secret), atau IPFS bila `ASSET_STORAGE_DRIVER=pinata` + `PINATA_JWT`.
- [x] Verifikasi penuh: typecheck 10/10, lint 10/10, test **88** (domain 12,
  application 17, solana 50, database 3+4 skip, worker 6).
- [ ] **Belum**: isi `PINATA_JWT` di `.env` (buat di
  https://app.pinata.cloud/developers/api-keys, scope pinFileToIPFS +
  pinJSONToIPFS) → lalu `ASSET_STORAGE_DRIVER=pinata` siap dipakai.
- [ ] **Belum**: composition root untuk web/worker runtime (bukan cuma probe) —
  saat route mint publik ditambahkan.

### 2026-10-15 — M3 #2 lanjutan: listing e2e devnet + perbaikan signer (createNoopSigner)
- [x] `scripts/probe-listing-e2e.ts` + script `pnpm --filter @micow/solana listing:e2e` —
  jalur list→buy end-to-end via use case + `UmiListingGateway` ASLI terhadap devnet
  (funder/seller/delegate/buyer keypair terpisah, asset Core throwaway)
- [x] **Temuan #1 — bug signer (tak terlihat unit test):** authority Core harus
  berupa Umi `Signer`; `PublicKey` biasa menghasilkan tx dgn
  `numRequiredSignatures = 0` (wallet tak bisa submit). Fix: `createNoopSigner`
  pada authority di `addPlugin`/`revokePluginAuthority`/`transfer`
- [x] **Temuan #2 — delegate TIDAK dihapus setelah buy:** plugin `TransferDelegate`
  tetap ada, `authority` di-reset ke `{ type: 'Owner' }` ("dicabut" ≠ "dihapus")
- [x] **Temuan #3 — buyer tak perlu sign** (delegate yang otorisasi transfer);
  `buyTx` mewajibkan delegate (feepayer + authority)
- [x] **Temuan #4 (gap disadari):** `buildBuyTx` belum menyertakan instruksi
  pembayaran (`priceLamports` tak dipakai di tx) — enforced off-chain; alasan
  kuat port Anchor kustom utk pembayaran atomic
- [x] Probe diperbaiki: plugin dibaca via `deriveAssetPlugins` (`asset.plugins`
  tidak ada di `AssetV1` — cek lama selalu `n/a`); ditambah assertion keras
  (owner tetap seller + delegate authority benar saat LIST; owner = buyer +
  delegate ter-reset saat BUY) sebelum mencetak `OK`
- [x] `umi-listing.test.ts`: assert **required signers** (numRequiredSignatures>0
  + authority ada di daftar), bukan sekadar "unsigned" (yang trivially true)
- [x] **Terverifikasi on-chain (devnet):** LIST → owner tetap seller +
  TransferDelegate→delegate ✅; BUY → owner = buyer + delegate authority reset ✅;
  `OK`
- [x] Verifikasi penuh: typecheck 10/10, lint 10/10, test 6/6 tasks (application 17,
  solana 42, database 3+4 skip, worker 6)
- [x] Docs: ADR-0005 + bagian "Temuan signer" (4 temuan terverifikasi)

### 2026-10-14 — M3 #2: listing non-custodial (ADR-0005 rev) + API routes
- [x] **Revisi ADR-0005**: Auction House & Fixed Price Sale **DEPRECATED**
  (diverifikasi live di developers.metaplex.com) dan tidak kompatibel Metaplex
  Core (bound ke Token Metadata). Core **tidak** punya program sale bawaan →
  keputusan: **non-custodial via Core `Transfer Delegate`** (escrowless). Aset
  tetap di wallet seller; authority di-revoke setelah transfer (one-time).
- [x] Domain `fees.ts` — `computeFeeSplit` (I5 deterministik, sisa → seller) + 12 test;
  `ListingRepository` + `findById` / `listActiveBySeller` / `listActive`
  (Drizzle + in-memory)
- [x] Port `ListingGateway` (non-custodial) + use case `createListing` /
  `cancelListing` / `buyListing` (I1/I4/I6) + 17 test
- [x] `packages/solana/src/umi-listing.ts` — `UmiListingGateway`
  (`addPlugin` / `revokePluginAuthority` / `transfer`) → transaksi **unsigned**
  (base64) + 4 test
- [x] Config: `PLATFORM_DELEGATE`, `PLATFORM_FEE_BPS`, `PLATFORM_TREASURY`,
  `NEXT_PUBLIC_PLATFORM_DELEGATE` + schema validasi `createListingInput` /
  `cancelListingInput` / `buyListingInput`
- [x] Web `lib/listings.ts` — composition root (container + `UmiListingGateway`
  + use case) dengan **safe-degrade** (503 bila `DATABASE_URL`/delegate kosong)
- [x] API routes: `GET/POST /api/listings`, `GET /api/listings/[id]`,
  `POST /api/listings/[id]/cancel`, `POST /api/listings/[id]/buy`. Semua mengembalikan
  transaksi **unsigned** + pemetaan `InvariantViolation.code` (I1/I4/I5/I6) → HTTP
  (403/404/409/422/503). Split fee di-serialisasi sebagai string (bigint-safe).
- [x] Verifikasi penuh: typecheck 12/12, lint 12/12, test 67 (application 17,
  solana 41, domain 12, database 3+4 skip, worker 6), build produksi bersih
  (env bersih) — 4 route listing terdaftar


### 2026-10-14 — Phase 2: web read model (M1 selesai)
- [x] `lib/read-model.ts` — akses read model server-side dengan **safe-degrade**:
  tanpa `DATABASE_URL` halaman render empty-state, bukan crash
- [x] API routes: `/api/collections`, `/api/assets` (validasi pubkey + paginasi zod)
- [x] Halaman `/explore` (RSC) — daftar koleksi + strip aset unggulan
- [x] Halaman `/collection/[address]` — grid aset, validasi alamat, 404 lembut
- [x] Halaman `/portfolio` + `WalletPortfolio` (client) — connect wallet → fetch
  NFT dimiliki via `/api/assets?owner=` (end-to-end wallet → server → read model)
- [x] Komponen `SiteHeader`/`AssetCard`/`CollectionCard`/`EmptyState` + nav konsisten
- [x] Home page pakai `SiteHeader` (link `create` yang 404 diganti explore/portfolio)
- [x] Smoke test dev server: `/`,`/explore`,`/portfolio`,`/collection/*` → 200;
  `/api/*` benar; diuji dengan data seed nyata (Demo Cats) → muncul di UI, lalu dibersihkan

### 2026-10-14 — Phase 2: monorepo scaffold
- [x] Root: `pnpm-workspace.yaml`, `package.json`, `turbo.json`, `.npmrc`, `.prettierrc`, `.nvmrc`, `.gitignore`
- [x] `packages/config-ts` (base/nextjs/node tsconfig)
- [x] `packages/config-eslint` (flat config base + react)
- [x] `packages/config` — env schema zod (`parseServerEnv`, `parseClientEnv`)
- [x] `packages/domain` — primitives, listing state machine, invariants (I1–I6) + unit test
- [x] `packages/application` — ports + use case `createListing`, `browse`
- [x] `packages/database` — Drizzle schema (collections, assets, listings, activities, sync_jobs) + client + drizzle.config
- [x] `packages/solana` — cluster/program IDs, DAS interface, `HeliusDasIndexer`
- [x] `packages/validation` — zod schemas (pubkey, listing, pagination)
- [x] `packages/observability` — structured logger + redaction
- [x] `packages/ui` — `cn`, Button, Card, styles
- [x] `apps/web` — Next.js 15 App Router, Tailwind v4, wallet provider, home/collection/health
- [x] `apps/worker` — Inngest client + `syncAssetMetadata` skeleton
- [x] `.env.example` + `docs/operations/env.md`

## Berikutnya (M1 selesai → M2)
1. ✅ `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm build` — semua hijau (lihat Verifikasi).
2. ✅ Setup Postgres lokal + `pnpm db:generate` (tanpa drift) → migrasi diterapkan.
3. ✅ Wire indexer→read model: `syncCollection`/`syncOwner` + fungsi Inngest + integration test.
4. ✅ Wallet connect + halaman explore/portfolio/collection membaca read model.
5. ✅ GitHub Actions CI (lint, typecheck, test, build, secret scan) + Dependabot.

## Berikutnya (menuju M3)
1. Mint koleksi end-to-end via Candy Machine v3 (devnet).
2. Escrow program (Auction House) + listing/buy (D1 di BLUEPRINT §12).
3. ✅ Helius webhooks → `activities` (feed aktivitas realtime) + UI `/activity`.
4. ✅ OG image dinamis + sitemap + robots (SEO).

## Verifikasi (2026-10-15)

| Pipeline | Hasil | Bukti |
|----------|-------|-------|
| `pnpm -r typecheck` | ✅ 10/10 tasks | tsc --noEmit per paket |
| `pnpm -r lint` | ✅ 10/10 tasks (0 warning) | eslint per paket + `next lint` |
| `pnpm -r test` | ✅ 6/6 tasks — application 17, solana 42, database 3 (+4 skip), worker 6 (total **68**) | vitest |
| `pnpm build` | ✅ 2/2 tasks | Next.js compiled, **18 route** di-generate + worker dist |
| `listing:e2e` (devnet) | ✅ `OK` | LIST→BUY via use case asli: owner tetap seller + delegate authority benar; buy → owner = buyer + delegate authority reset |

### Verifikasi sebelumnya (2026-10-14)
| Pipeline | Hasil |
|----------|-------|
| lint / typecheck | ✅ 10/10 |
| test | ✅ 6/6 tasks (32 unit + 4 DB-integration bila `DATABASE_URL` ada) |
| build | ✅ 2/2 tasks, 14 route |
| Runtime | ✅ `/api/health` `{ok:true}`; core pages 200; robots/sitemap valid; OG 1200×630 |
| Webhook | ✅ 401 tanpa secret; `recorded:true` sale; DB dedup saat replay |

Lingkungan: Node 22.23.1 (nvm) · pnpm 10.26.1 · Next.js 15.5.27 · Turbo 2.11.


## Keputusan tertunda
- D1 escrow (Auction House vs custom Anchor) — lihat BLUEPRINT §12
- D2 Privy vs Wallet Adapter only
- D5 model fee & enforcement royalty

## Keputusan diambil
- **Storage metadata: IPFS via Pinata (REST)** — menggantikan Irys (CLI rusak).
  Driver dipilih via `ASSET_STORAGE_DRIVER`. Lihat task log 2026-10-15 M3.
