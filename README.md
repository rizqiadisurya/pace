# Pace — AI running coach

Pace menyesuaikan rencana latihan lari setiap hari berdasarkan tidur, HRV, rasa capek, laporan nyeri, cuaca, dan AQI.
Kamu cukup lari, rencananya yang menyesuaikan.

Ini fondasi MVP (fitur P0 di PRD) dengan Next.js 15 (App Router), TypeScript, Drizzle ORM + Postgres, dan Tailwind CSS 4.

## Menjalankan

```bash
npm install
cp .env.example .env      # sudah ada .env default untuk lokal
npm run dev               # http://localhost:3000
```

Tanpa `DATABASE_URL`, app memakai **PGlite** (Postgres yang berjalan di dalam Node) dengan data di `data/pglite/`. Tidak perlu install database apa pun; migrasi berjalan otomatis.
Dengan `DATABASE_URL` (Neon, Supabase, Postgres lokal), app memakai Postgres sungguhan dan `npm run build` menjalankan migrasi terlebih dulu.
Buka di HP: jalankan `npm run dev -- -H 0.0.0.0`, lalu akses `http://<ip-laptop>:3000` dari HP di jaringan Wi-Fi yang sama.

| Perintah | Fungsi |
| --- | --- |
| `npm test` | Unit test engine + integration test service layer di Postgres (PGlite in-memory) |
| `npm run typecheck` | Cek TypeScript |
| `npm run build && npm start` | Migrasi (jika `DATABASE_URL` ada), build, jalankan mode produksi |
| `npm run db:migrate` | Jalankan migrasi ke `DATABASE_URL` |
| `npm run db:generate` | Buat migrasi SQL baru setelah mengubah `src/db/schema.ts` |
| `npm run db:studio` | Lihat isi database di browser |

## Arsitektur

```
src/
├─ lib/engine/        ← Agent engine. Fungsi murni tanpa DB/IO, semuanya dites.
│  ├─ plan.ts         Generator rencana periodisasi (comeback/base/build/peak/taper)
│  ├─ readiness.ts    Skor readiness 0–100 dari tidur, HRV, perasaan, RPE, beban
│  ├─ conditions.ts   Heat index + AQI → jam lari terbaik / saran treadmill
│  ├─ decide.ts       Keputusan harian: KEEP / DOWNGRADE / SHORTEN / RECOVER / PAIN_STOP
│  ├─ reschedule.ts   Skip, swap, dan pemindahan sesi
│  ├─ guardrails.ts   Aturan keamanan yang tidak boleh dilanggar
│  └─ engine.test.ts
├─ lib/coach.ts       Service layer: menghubungkan engine ↔ database (siklus Sense → Decide → Act)
├─ lib/weather.ts     Open-Meteo forecast + air quality (gratis, tanpa API key)
├─ lib/strava.ts      OAuth Strava + sinkronisasi aktivitas
├─ db/schema.ts       Skema Drizzle (Postgres): users, workouts, activities, daily_signals, adjustments
├─ db/client.ts       Postgres via DATABASE_URL, atau PGlite bila kosong
└─ app/               Halaman (onboarding, today, skip, checkin, plan, profile) + route handler /api/*
```

### Siklus agent harian

1. **Sense:** sinyal hari ini (tidur, HRV, perasaan), RPE kemarin, rasio beban 7 hari vs 4 minggu, cuaca/AQI per jam.
2. **Decide:** `decideToday()` memilih aksi berdasarkan aturan di PRD.
3. **Act:** sesuai level otonomi pengguna. `AUTO` langsung diterapkan; `ASK` dan `SUGGEST` disimpan sebagai usulan.
4. **Explain:** setiap perubahan disimpan di tabel `adjustments` beserta alasan dan snapshot minggu sebelum/sesudah, sehingga **Undo** selalu bisa.

Keputusan berjalan sekali per hari (idempotent). Sinyal baru (mis. jam tidur diisi) memicu hitung ulang.

### Guardrail (tidak bisa dilanggar agent)

- Sesi kualitas berjarak minimal 48 jam dari sesi berat lain.
- Volume minggu tidak naik lebih dari 10% dari volume tertinggi 3 minggu sebelumnya.
- Cutback tiap minggu ke-4 (−25%).
- Comeback mode (break ≥ 4 minggu): 2–3 minggu awal hanya easy + strides, volume mulai dari 50%.
- Nyeri dilaporkan 2× berturut-turut → semua sesi kualitas minggu itu diganti easy.
- Skip/swap tidak pernah menambah volume minggu; sesi yang tidak punya slot aman didrop, bukan ditumpuk.

## API

Semua endpoint memakai cookie sesi `pace_uid` yang dibuat saat onboarding.

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| POST | `/api/onboarding` | Buat profil + rencana |
| GET | `/api/brief` | Morning brief (menjalankan agent harian) |
| POST | `/api/signals` | Simpan tidur/HRV/perasaan, hitung ulang keputusan |
| POST | `/api/adjustments/:id` | `accept` / `dismiss` usulan, atau `undo` perubahan |
| GET/POST | `/api/workouts/:id/skip` | Pratinjau / terapkan skip |
| GET/POST | `/api/workouts/:id/swap` | Daftar / terapkan alternatif |
| POST | `/api/checkin` | Catat lari + RPE + nyeri, kembalikan umpan balik |
| GET | `/api/plan` | Seluruh rencana |
| PATCH/DELETE | `/api/me` | Ubah otonomi/lokasi, atau hapus semua data |
| GET | `/api/strava/connect` → `/callback` | OAuth Strava |
| POST | `/api/strava/sync` | Impor lari 14 hari terakhir |

## Integrasi Strava (opsional)

1. Buat aplikasi di https://www.strava.com/settings/api dengan *Authorization Callback Domain* = domain app (mis. `localhost`).
2. Isi `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, dan `APP_URL` di `.env`.
3. Buka **Profil → Hubungkan Strava**.

Sebelum rilis komersial, cek kebijakan dan batas API Strava untuk aplikasi pihak ketiga.

## Deploy ke Vercel + Neon (±5 menit)

1. **Import repo:** buka https://vercel.com/new, pilih repo `pace` dari GitHub, lalu klik **Deploy**. Deploy pertama boleh gagal karena belum ada database.
2. **Tambah database:** di project Vercel, buka **Storage → Create Database → Neon (Postgres)**, pilih region **Singapore (ap-southeast-1)** supaya dekat dengan Jakarta, lalu hubungkan ke project. Vercel otomatis mengisi `DATABASE_URL` (dan `DATABASE_URL_UNPOOLED`) untuk semua environment.
3. **Set env:** di **Settings → Environment Variables**, tambahkan `APP_URL` = URL produksi (mis. `https://pace-xxx.vercel.app`).
4. **Redeploy:** buka **Deployments → ⋯ → Redeploy**. Build otomatis menjalankan migrasi lalu membangun app.
5. Buka URL-nya di HP, lalu **Add to Home Screen** supaya terasa seperti app.

Untuk riset Fase 0: satu profil tersimpan per browser (cookie). Setiap peserta cukup membuka link di HP masing-masing dan menjalani onboarding.
Untuk Strava di produksi: set *Authorization Callback Domain* app Strava ke domain Vercel, lalu tambahkan `STRAVA_CLIENT_ID` dan `STRAVA_CLIENT_SECRET` di env Vercel.

## Menuju produksi

- **Auth:** ganti cookie `pace_uid` di `src/lib/session.ts` dengan auth sungguhan (Auth.js, Clerk, dll).
- **Agent terjadwal:** saat ini agent jalan ketika brief dibuka. Untuk notifikasi pagi, panggil `runDailyAgent()` lewat cron (mis. 04.30 waktu lokal) lalu kirim push notification.
- **Wearable:** tambahkan Apple Health / Health Connect / Garmin untuk mengisi `daily_signals` otomatis.
- **Enkripsi token:** enkripsi token Strava saat disimpan.

## Keterbatasan versi ini

- Angka bobot readiness dan target volume masih asumsi awal, perlu dikalibrasi dengan data beta dan review pelatih bersertifikat.
- Belum ada push notification, weekly review (P1), integrasi kalender, dan mode Ramadan (P2).
- Saran latihan bukan pengganti nasihat medis.
