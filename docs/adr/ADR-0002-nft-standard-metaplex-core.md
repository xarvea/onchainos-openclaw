# ADR-0002 — NFT Standard: Metaplex Core (bukan Token Metadata)

**Status:** Accepted

## Konteks
Proyek greenfield tanpa kebutuhan kompatibilitas legacy.

## Keputusan
Pakai **Metaplex Core** sebagai standar utama.

## Alternatif
Token Metadata — legacy, biaya lebih tinggi, tanpa plugins.

## Konsekuensi
Mint ~80% lebih murah, royalty via plugin. Perlu verifikasi dukungan marketplace
pihak ketiga untuk Core (semakin luas). Aset Token Metadata tetap didukung
(read-only, lewat DAS) untuk kompatibilitas.
