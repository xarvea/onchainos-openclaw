# ADR-0004 — Frontend: Next.js App Router

**Status:** Accepted

## Konteks
Marketplace publik butuh SEO, OG preview sosial, Core Web Vitals.

## Keputusan
Next.js 15 App Router (RSC + ISR).

## Alternatif
Vite React SPA — buruk untuk SEO tanpa pre-render manual.

## Konsekuensi
Server Components untuk read-heavy pages; Client Components hanya untuk interaksi
wallet. Catatan: deploy target adalah **Cloudflare Pages** (bukan Vercel) — lihat
koreksi di `PROGRESS.md`.
