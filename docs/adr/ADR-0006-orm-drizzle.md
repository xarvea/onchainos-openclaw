# ADR-0006 — ORM: Drizzle (bukan Prisma)

**Status:** Accepted

## Konteks
Stack TS modern, kemungkinan edge runtime, query SQL-heavy untuk indexer.

## Keputusan
Drizzle ORM + drizzle-kit.

## Alternatif
Prisma — DX enak, tapi lebih berat untuk edge, engine overhead.

## Konsekuensi
SQL-first, cold-start rendah, cocok Next.js edge.
