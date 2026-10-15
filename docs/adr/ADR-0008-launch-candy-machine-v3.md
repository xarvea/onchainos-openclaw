# ADR-0008 — Launch/Mint: Candy Machine v3 + Core via Umi (JS), tanpa program kustom

**Status:** Accepted (2026-10-14)

## Konteks
Butuh jalur mint end-to-end untuk koleksi: buat koleksi, konfigurasi launch
(harga, jumlah, guard), unggah aset, dan mint. Pilihan: tulis program Anchor
kustom, atau pakai program Metaplex standar (Candy Machine v3) lewat klien JS.

## Keputusan
- Gunakan **Candy Machine v3** (program Metaplex standar) — **bukan** program
  Anchor kustom untuk mint.
- Klien memakai **Umi** + `@metaplex-foundation/mpl-core` +
  `@metaplex-foundation/mpl-candy-machine` + storage IPFS/Pinata (REST).
- Koleksi memakai **Metaplex Core** (lihat ADR-0002), konsisten dengan read model.
- Mint interaktif (tombol "Mint") di-sign di sisi klien; operasi admin
  (buat koleksi, buat CM, insert items) dijalankan dari server/script dengan
  keypair admin (bukan di browser).
- Semua akses eksternal dibungkus port (`CollectionMinter`) agar bisa diuji dengan
  fake dan tidak mengunci use case ke Umi.

## Alternatif
- **Program Anchor kustom untuk mint** — kontrol penuh, tapi biaya audit tinggi
  dan tidak memberi nilai tambah untuk MVP; standar Metaplex sudah teruji luas.
- **Candy Machine v3 CLI saja** (tanpa wrapper) — cepat untuk demo, tetapi tidak
  bisa dipanggil dari dalam aplikasi/diuji otomatis.

## Konsekuensi
- Jauh lebih cepat & aman; mengikuti standar terbuka (konsisten dengan visi).
- Bergantung pada Umi + program Metaplex (versi di-pin; lihat `package.json`).
- Biaya mint mengikuti CM/guards (mis. `solPayment`, `mintLimit`); fee platform
  untuk mint ditangani di guard, bukan kontrak sendiri.
- Read model tetap terisi lewat DAS/webhook (ADR-0003) — mint tidak menulis
  langsung ke Postgres; konsistensi dijaga oleh indexer.
