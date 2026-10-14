# ADR-0005 — Escrow: Auction House dulu, custom kemudian

**Status:** Accepted (D1 diputuskan 2026-10-14)

## Konteks
Perlu escrow on-chain untuk listing fixed-price yang aman.

## Keputusan
Pakai **Metaplex Auction House** (standar, teruji) untuk MVP; tulis program Anchor
custom hanya jika butuh fitur yang tak didukung.

## Alternatif
Program Anchor custom sejak awal — kontrol penuh, tapi audit mahal.

## Konsekuensi
- Lebih cepat & aman; fleksibilitas terbatas pada fitur AH.
- Fee platform & enforcement royalty mengikuti skema AH (biaya
  `sellerFeeBasisPoints` + `buyerPrice`/`protocolConfig`), bukan kontrak custom.
- Escrow non-custodial: dana berpindah langsung seller↔buyer saat eksekusi.
- Bila nanti butuh fitur AH yang tak mendukung (mis. auction eksotis, fee
  berjenjang), kita tulis program Anchor terpisah — port `ListingGateway` sudah
  mengisolasi ini sehingga UI/use case tidak perlu berubah.
