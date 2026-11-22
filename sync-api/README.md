# Pace sync API

Penghubung kecil antara Pace (GitHub Pages) dan **Garmin Connect Personal API** + **Strava**.
Kunci API disimpan di sini (server), sedangkan data latihan tetap di perangkat pengguna.
Tidak ada database: refresh token Strava disimpan di perangkat dan dikirim saat sinkron.

| Endpoint | Fungsi |
| --- | --- |
| `GET /api/health` | Cek kata sandi & sumber yang aktif |
| `POST /api/garmin/sync` `{from,to}` | Lari, tidur, HRV, Body Battery, zona HR (maks 31 hari) |
| `GET /api/strava/authorize` → `/api/strava/callback` | Login Strava, kembali ke Pace dengan refresh token di `#fragmen` |
| `POST /api/strava/sync` `{refreshToken,from,to}` | Lari dari Strava + refresh token baru |

Semua endpoint data butuh header `X-Pace-Key: <SYNC_PASSPHRASE>`. CORS hanya untuk `APP_ORIGIN`.

## Deploy ke Vercel (sekali saja)

1. https://vercel.com/new → import repo `rizqiadisurya/pace`.
2. **Root Directory: `sync-api`**, Framework Preset: **Other**. Deploy.
3. Settings → Environment Variables (lihat `.env.example`):
   - `SYNC_PASSPHRASE` – kata sandi panjang (≥ 12 karakter) buatanmu.
   - `APP_ORIGIN` = `https://rizqiadisurya.github.io`, `APP_URL` = `https://rizqiadisurya.github.io/pace/profile/`
   - `GARMIN_API_KEY` – dari https://connect.garmin.com/app/settings/personalApiToken (Create Key, pilih masa berlaku; key hanya tampil sekali).
   - `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` – dari https://www.strava.com/settings/api. Isi **Authorization Callback Domain** dengan domain Vercel ini (mis. `pace-sync-xxx.vercel.app`).
4. Redeploy, lalu di Pace: **Profil → Sinkronisasi** → isi alamat Vercel + kata sandi → **Simpan & tes koneksi** → **Hubungkan Strava** → **Sinkron sekarang**.

## Catatan

- Garmin Personal API hanya untuk data akun sendiri, pull-only; access token berlaku 24 jam dan dibuat ulang otomatis dari key. Garmin mengirim email sebelum key kedaluwarsa.
- Strava app baru berada di *Single Player Mode* (hanya akun pemilik).
- Kebijakan API Strava melarang memakai data Strava untuk aplikasi AI/LLM. Analisis Pace berbasis aturan di perangkat; jangan mengirim data Strava ke model AI.
- Basis API Strava bisa diubah lewat `STRAVA_API_BASE` (Strava mengumumkan `https://api-v3.strava.com` mulai 4 Jan 2027).
