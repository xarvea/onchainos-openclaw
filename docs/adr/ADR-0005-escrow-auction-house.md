# ADR-0005 — Escrow: Auction House dulu, custom kemudian

**Status:** Proposed (perlu keputusan — lihat D1 di `BLUEPRINT.md §12`)

## Konteks
Perlu escrow on-chain untuk listing fixed-price yang aman.

## Keputusan usulan
Pakai **Metaplex Auction House** (standar, teruji) untuk MVP; tulis program Anchor
custom hanya jika butuh fitur yang tak didukung.

## Alternatif
Program Anchor custom sejak awal — kontrol penuh, tapi audit mahal.

## Konsekuensi
Lebih cepat & aman; fleksibilitas terbatas pada fitur AH.
