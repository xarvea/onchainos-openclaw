# PROGRESS — MICOW

> Update log per task. Jaga file ini tetap akurat; ini sumber status tunggal.

## Ringkasan fase (framework Phase 0–7)

| Phase | Status | Catatan |
|-------|--------|---------|
| 0 — Discovery | ✅ selesai | visi, chain, model bisnis ada di BLUEPRINT §1 |
| 1 — Spec | 🟡 in progress | BLUEPRINT + riset + ADR ada; PRD/SRS/threat model detail menyusul |
| 2 — Foundation | 🟡 in progress | monorepo ter-scaffold; CI & migrate belum |
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
4. Wallet connect end-to-end di devnet + halaman explore.
5. ✅ GitHub Actions CI (lint, typecheck, test, build, secret scan) + Dependabot.

## Verifikasi (2026-10-14)

| Pipeline | Hasil | Bukti |
|----------|-------|-------|
| `pnpm lint` | ✅ 10/10 tasks (0 warning) | turbo tasks successful |
| `pnpm typecheck` | ✅ 10/10 tasks | tsc --noEmit per paket |
| `pnpm test` | ✅ 6/6 tasks (19 tes + 3 DB-integration bila `DATABASE_URL` ada) | vitest |
| `pnpm build` | ✅ 2/2 tasks | Next.js compiled, 4 route di-generate |
| Runtime | ✅ | `/api/health` → `{ok:true,...}`; `/` → HTTP 200; `/collection/[addr]` → HTTP 200 |

Lingkungan: Node 22.23.1 (nvm) · pnpm 10.26.1 · Next.js 15.5.27 · Turbo 2.11.


## Keputusan tertunda
- D1 escrow (Auction House vs custom Anchor) — lihat BLUEPRINT §12
- D2 Privy vs Wallet Adapter only
- D5 model fee & enforcement royalty
