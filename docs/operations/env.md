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
pnpm db:generate   # drizzle-kit generate migrations
pnpm db:migrate    # apply ke Postgres
```

Validasi cepat: `GET /api/health` mengembalikan `{ ok: true, ... }` bila env server valid.
