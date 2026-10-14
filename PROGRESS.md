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
- [x] `docs/adr/ADR-0001..0007.md`
- [x] Koreksi deploy: NO VERCEL → Cloudflare Pages

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
2. Setup Postgres DB lokal + `pnpm db:generate` → review migration.
3. Wire `HeliusDasIndexer` ke `AssetRepository` (Drizzle) + worker upsert.
4. Wallet connect end-to-end di devnet + halaman explore.
5. GitHub Actions CI (lint, typecheck, test, secret scan).

## Verifikasi (2026-10-14)

| Pipeline | Hasil | Bukti |
|----------|-------|-------|
| `pnpm lint` | ✅ 10/10 tasks | turbo tasks successful |
| `pnpm typecheck` | ✅ 10/10 tasks | tsc --noEmit per paket |
| `pnpm test` | ✅ 4/4 tasks (domain 4/4 tests) | vitest |
| `pnpm build` | ✅ 2/2 tasks | Next.js compiled, 5 route di-generate |
| Runtime | ✅ | `/api/health` → `{ok:true,...}`; `/` → HTTP 200; `/collection/[addr]` → HTTP 200 |

Lingkungan: Node 22.23.1 (nvm) · pnpm 10.26.1 · Next.js 15.5.27 · Turbo 2.11.


## Keputusan tertunda
- D1 escrow (Auction House vs custom Anchor) — lihat BLUEPRINT §12
- D2 Privy vs Wallet Adapter only
- D5 model fee & enforcement royalty
