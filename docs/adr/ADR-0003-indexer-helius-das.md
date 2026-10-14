# ADR-0003 — Indexer: Helius DAS + Webhooks (bukan custom Geyser sejak awal)

**Status:** Accepted (dengan abstraksi)

## Konteks
Tim kecil, ingin ship cepat; custom Geyser butuh minggu–bulan + operasional berat
(reorg handling, backfill, parsing IDL).

## Keputusan
MVP pakai **Helius DAS + Webhooks**, cache di Postgres. Bungkus dalam interface
`IndexerProvider` agar bisa swap ke custom Geyser nanti.

## Alternatif
Custom Geyser indexer dari hari pertama.

## Konsekuensi
Vendor lock ringan (mitigasi: abstraksi). Query kompleks (filter listing by
price/rarity) dilakukan di Postgres sendiri.
