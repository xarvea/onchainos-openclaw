# Environment & Secrets

Dokumen ini menjelaskan variabel environment MICOW dan kebijakan rahasianya.
Sumber skema tervalidasi: `packages/config/src/env.ts` (zod).

## Aturan keras

1. **`.env` tidak pernah di-commit** — sudah masuk `.gitignore`.
2. **`NEXT_PUBLIC_*` bocor ke browser.** Jangan pernah taruh API key/secret di sana.
3. **Secret server** (Helius, DB, Redis, S3) hanya diakses dari server
   (server components / route handlers / worker), bukan client component.
4. **Private key / seed phrase tidak pernah** ada di env aplikasi. Marketplace
   non-custodial: signing hanya di wallet pengguna.

## Variabel

| Nama | Scope | Wajib | Keterangan |
|------|-------|:-----:|------------|
| `NODE_ENV` | server | ya | development / test / production |
| `LOG_LEVEL` | server | tidak | debug/info/warn/error |
| `NEXT_PUBLIC_SITE_URL` | client | tidak | Untuk `metadataBase` (SEO/OG) |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | client | ya | devnet / testnet / mainnet-beta |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | client | tidak | Kosong → pakai RPC publik cluster |
| `HELIUS_API_KEY` | **server** | tidak* | DAS, webhooks, enhanced tx |
| `HELIUS_WEBHOOK_SECRET` | **server** | tidak | Verifikasi webhook |
| `DATABASE_URL` | **server** | ya | Postgres (Supabase lokal/prod) |
| `REDIS_URL` | **server** | tidak | Cache/queue (M1 opsional) |
| `S3_*` | **server** | tidak | Cache aset (R2/Supabase Storage) |

\* Wajib untuk fitur yang memakai Helius (browse via DAS, webhook). Untuk M1
tanpa DAS, boleh kosong.

## Alur

```bash
cp .env.example .env
# isi DATABASE_URL dst.
pnpm db:generate   # drizzle-kit generate migrations (review output!)
pnpm db:migrate    # apply ke Postgres
```

Validasi cepat: `GET /api/health` mengembalikan `{ ok: true, ... }` bila env server valid.

### Postgres lokal (dari nol)

```bash
# 1. Buat role + database (peer auth lewat postgres superuser).
sudo -u postgres psql -c "CREATE ROLE micow WITH LOGIN PASSWORD 'micow';"
sudo -u postgres createdb -O micow micow

# 2. Arahkan DATABASE_URL ke DB itu.
echo 'DATABASE_URL=postgres://micow:micow@127.0.0.1:5432/micow' >> .env

# 3. Terapkan migrasi.
pnpm db:migrate

# 4. Verifikasi tabel terbentuk.
psql "$DATABASE_URL" -c '\dt'
# → activities, assets, collections, listings, sync_jobs
```

### Integration test DB

`packages/database/src/repositories.integration.test.ts` menjalankan repo Drizzle
terhadap **Postgres asli** (schema sekali-pakai, di-drop setelah selesai). Test ini
otomatis **di-skip** bila `DATABASE_URL` tidak diset, jadi aman di mesin tanpa DB.

```bash
DATABASE_URL=postgres://micow:micow@127.0.0.1:5432/micow pnpm test
```

Di CI, Postgres 16 disediakan sebagai service container sehingga test ini benar-benar
jalan (lihat `.github/workflows/ci.yml`).

## Webhook Helius → `activities`

Feed aktivitas diisi lewat `POST /api/webhooks/helius`. Endpoint ini:

- **Wajib** punya `HELIUS_WEBHOOK_SECRET`. Bila kosong → `503` (fail-closed);
  secret salah/kosong → `401`. Perbandingan pakai constant-time.
- Menerima array enhanced transaction (Helius), memetakan ke `Activity` dengan id
  deterministik `{signature}:{mint}:{type}` → **replay/duplikat aman** (dedup di DB).
- `200` saat sukses (termasuk delivery kosong), `500` saat gagal tulis supaya
  Helius mengirim ulang, `503` bila read model tak tersedia.

Setup:

```bash
# 1. Set secret di .env (server-only — jangan di NEXT_PUBLIC_*).
echo 'HELIUS_WEBHOOK_SECRET=<random-panjang>' >> .env

# 2. Registrasikan webhook di dashboard Helius:
#    URL    : https://<domain>/api/webhooks/helius?auth=<secret>
#    Type   : Enhanced / raw (NFT events)
#    Account: alamat program/koleksi yang ingin dipantau
```

Verifikasi cepat (dev):

```bash
SECRET=<secret>
# tanpa auth → 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/webhooks/helius -d '[]'
# payload kosong dengan auth → 200 {ok:true,accepted:0}
curl -s -X POST "localhost:3000/api/webhooks/helius?auth=$SECRET" -d '[]'
```

Setelah event masuk, cek `/api/activities` dan halaman `/activity`.

