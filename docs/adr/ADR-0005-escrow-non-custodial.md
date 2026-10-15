# ADR-0005 — Escrow/listing: Non-custodial via Core Transfer Delegate

**Status:** Accepted (direvisi 2026-10-14; menggantikan versi "Auction House" yang invalid)

## Riwayat revisi

- **v1 (2026-10-14, awal):** "Pakai Metaplex Auction House." → **DIBATALKAN.**
- **v2 (2026-10-14, revisi ini):** "Non-custodial listing via Core Transfer
  Delegate." → **Accepted.**

### Mengapa v1 dibatalkan (temuan terverifikasi)

Diverifikasi langsung di `developers.metaplex.com` (2026-10):

1. **Metaplex Auction House DEPRECATED.** Halaman Auction House menyatakan
   tegas: *"Auction House is deprecated and is no longer actively maintained."*
2. **Auction House tidak kompatibel dengan Metaplex Core.** AH dibangun di atas
   `mpl-token-metadata` (model SPL mint + Metadata PDA). Core memakai model satu
   akun tanpa mint (`CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d`). AH
   memvalidasi & CPI ke Token Metadata secara hard-coded; **tidak ada adapter
   AH untuk Core.** Sehingga AH tak bisa meng-escrow/list/menjual aset Core —
   padahal ADR-0002 memilih Core sebagai standar utama. Kontradiksi.
3. **"Fixed Price Sale" juga DEPRECATED** dan hanya untuk Token Metadata
   (print edition dari master edition) — bukan penjualan ulang aset Core.
4. **Core TIDAK punya program listing/sale/escrow bawaan.** Tidak ada instruksi
   `Sell`/`ExecuteSale` di program Core (klaim semacam itu terbukti keliru —
   URL dokumennya 404). Core menyediakan `Transfer`, `Burn`, `Update`, dan
   sistem **plugin** — bukan marketplace.

Konsekuensi: rencana "pakai AH" di v1 tidak dapat dijalankan tanpa mengganti
standar NFT (mundur ke Token Metadata), yang akan membatalkan ADR-0002 dan
kehilangan keunggulan Core (biaya, royalty enforced, plugin).

## Konteks

Kita butuh mekanisme listing fixed-price yang aman untuk aset **Core**, dengan
fee platform + royalty yang bisa ditegakkan, tanpa menulis program Anchor kustom
(yang mahal untuk diaudit) pada tahap MVP.

## Keputusan

Pakai pola **non-custodial (escrowless) listing** memanfaatkan plugin bawaan
Core: **Transfer Delegate**.

Alur:

1. **Seller list** — seller menambahkan plugin `Transfer Delegate` pada aset dan
   menunjuk **program/akun delegate MILIK MICOW** sebagai authority. Aset
   **tetap di wallet seller** (tidak dipindah ke escrow). Listing dicatat
   off-chain (read model) sebagai `ACTIVE`.
2. **Buyer beli** — buyer mengirim pembayaran; delegate (MICOW) memindahkan aset
   seller → buyer. Pembayaran dipecah deterministik: platform fee + royalty +
   seller proceeds, dan wajib **sum == price** (invariant I5).
3. **Seller cancel** — seller mencabut plugin delegate (revoke), listing →
   `CANCELLED`.

### Sifat penting Transfer Delegate (dari docs resmi)

- Deskripsi resmi: *"allows a designated authority to transfer Core Assets on
  behalf of the owner. **Essential for escrowless marketplace sales**."*
- Authority **dicabut otomatis setelah transfer** (*one-time use*) → setelah
  terjual, delegate tak bisa dipakai lagi (aman).
- Termasuk plugin *Owner Managed*.

### Temuan signer — diverifikasi on-chain (devnet, 2026-10-15)

Dijalankan via `pnpm --filter @micow/solana listing:e2e`
(`scripts/probe-listing-e2e.ts`) memakai use case + `UmiListingGateway` asli
terhadap devnet. Empat temuan yang **tidak bisa dilihat unit test offline**:

1. **Authority harus di-mark sebagai signer (`createNoopSigner`).** Core
   me-resolve akun `authority` dari sebuah Umi `Signer`; hanya `Signer` yang
   di-emit dengan `isSigner = true`. Bila `authority` diberi `PublicKey` biasa
   (atau dihilangkan), tx yang dihasilkan **mewajibkan NOL signer**
   (`numRequiredSignatures = 0`) — wallet tak akan pernah bisa submit, dan unit
   test lama tetap lolos karena tx kosong itu "trivially unsigned". Perbaikan:
   bungkus tiap authority dengan `createNoopSigner(pk)` (backend tidak
   menandatangani, hanya *menandai* alamat sebagai required signer). Signer yang
   diwajibkan: **create/cancel → seller** (owner aset), **buy → delegate**.

2. **Buy TIDAK mewajibkan buyer menandatangani.** Pada `transfer`, delegate-lah
   yang mengotorisasi; pemilik baru (buyer) tidak perlu tanda tangan. Di probe,
   `buyTx` mewajibkan delegate (muncul dua kali: fee payer + authority).

3. **Delegate TIDAK dihapus setelah transfer — authority-nya di-*reset* ke
   Owner.** Setelah buy, plugin `TransferDelegate` **masih ada** pada aset, tapi
   `authority` kembali ke `{ type: 'Owner' }` (bukan `Address: delegate`).
   Konsekuensi: listing ulang oleh pemilik baru harus **me-delegate ulang**
   (bukan sekadar mengandalkan plugin lama). Ini nuansa penting: "dicabut
   otomatis" ≠ "plugin dihapus".

4. **`buildBuyTx` saat ini belum menyertakan instruksi pembayaran.** Parameter
   `priceLamports` diterima tetapi tidak dipakai membangun transfer SOL — jadi
   tx buy hanya memindahkan aset. Penegakan pembayaran masih off-chain/read
   model (invariant I5) dan **belum** berupa escrow on-chain. Ini gap yang
   disadari (lihat Trade-off) dan menjadi alasan kuat untuk port Anchor kustom
   bila butuh pembayaran atomic (NFT+SOL dalam satu tx).


## Alternatif yang dipertimbangkan

| Opsi | Kenapa tidak dipilih (sekarang) |
|---|---|
| Auction House (v1) | Deprecated + tidak kompatibel Core |
| Fixed Price Sale | Deprecated + Token Metadata-only |
| Program escrow Anchor kustom | Kontrol penuh, tapi butuh audit (mahal/lama). **Ditunda** — port `ListingGateway` mengisolasi ini sehingga bisa ditambahkan tanpa mengubah UI/use-case |
| Marketplace pihak ketiga (Tensor/Magic Eden) sebagai backend | Cepat, tapi ketergantungan pihak ketiga & kurang kontrol fee/branding |

## Konsekuensi

- **Posisitif:** tidak deprecated; Core-native; tanpa audit program; aset tetap
  di wallet seller (UX & keamanan lebih baik); seller bisa list di beberapa
  tempat.
- **Trade-off:** penegakan pembayaran/fee bergantung pada alur tx kita (bukan
  dijamin program escrow yang mengunci dana). Karena itu **invariant I5 (split
  deterministik) dan verifikasi di sisi server wajib** — lihat `invariants.ts`.
- **Fee & royalty:** angka final = keputusan D5 (masih TBD). Struktur split
  disiapkan sekarang (`platformFee` + `creatorRoyalty` + `sellerProceeds`).
- **Escape hatch:** bila nanti butuh escrow terkunci / fee berjenjang / auction,
  tulis program Anchor terpisah sebagai implementasi `ListingGateway` baru —
  UI & use case tidak berubah.
- **Dampak kode:** `ListingGateway` membangun tx non-custodial (create/cancel/
  buy) memakai Umi + `@metaplex-foundation/mpl-core` (plugin transfer delegate),
  bukan `mpl-auction-house`.
