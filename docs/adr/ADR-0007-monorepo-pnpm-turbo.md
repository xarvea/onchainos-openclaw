# ADR-0007 — Monorepo: pnpm workspaces + Turborepo

**Status:** Accepted

## Konteks
Multi-app (web, worker) + paket bersama (domain, db, solana, ui).

## Keputusan
pnpm workspaces + Turborepo.

## Alternatif
- Nx — overkill untuk MVP.
- Bun workspaces — ekosistem Solana/Next belum sepenuhnya aman.

## Konsekuensi
Caching task, reuse kode, struktur jelas.
