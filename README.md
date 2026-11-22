# Pace — AI running coach

Pace menyesuaikan rencana latihan lari setiap hari berdasarkan tidur, HRV, rasa capek, laporan nyeri, cuaca, dan AQI.
Kamu cukup lari, rencananya yang menyesuaikan.

Versi ini **local-first**: seluruh agent berjalan di browser dan data tersimpan di perangkat pengguna (localStorage).
Tidak ada server, login, maupun database, jadi app bisa di-host gratis di **GitHub Pages**.
Versi full-stack (Next.js API + Postgres/Neon + Strava) ada di branch [`server-postgres`](../../tree/server-postgres).

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 26 test: engine + store
npm run build      # static export ke ./out
```

## Deploy (GitHub Pages)

Setiap push ke `main` menjalankan `.github/workflows/deploy.yml`: test → build → publish ke
`https://<user>.github.io/<repo>/`.

Sekali saja di awal: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Kalau deploy pertama gagal karena Pages belum aktif, aktifkan lalu buka **Actions → Deploy ke GitHub Pages → Re-run jobs**.

## Arsitektur

```
src/
├─ lib/engine/      Agent engine murni (plan, readiness, conditions, decide, reschedule, guardrails) + test
├─ lib/store.ts     Store local-first: profil, rencana, sinyal, aktivitas, adjustment (Undo) di localStorage
├─ lib/usePace.ts   Hook React: state reaktif, runner aksi, saran jam lari dari Open-Meteo (cuaca + AQI)
├─ components/      UI primitives, tab bar, guard profil
└─ app/             Halaman: onboarding, today, today/skip, checkin, plan, progress (dashboard), profile
```

### Siklus agent harian

1. **Sense:** tidur, HRV, perasaan, RPE kemarin, rasio beban 7 hari vs 4 minggu.
2. **Decide:** `decideToday()` memilih KEEP / DOWNGRADE / SHORTEN / RECOVER / PAIN_STOP.
3. **Act:** sesuai otonomi. `AUTO` langsung diterapkan; `ASK` / `SUGGEST` jadi usulan.
4. **Explain:** setiap perubahan disimpan beserta alasan dan snapshot, sehingga **Undo** selalu bisa.

Cuaca dan AQI (Open-Meteo, dipanggil langsung dari browser) hanya menghasilkan saran jam lari atau treadmill.

### Guardrail

- Sesi kualitas berjarak ≥ 48 jam dari sesi berat lain.
- Volume minggu naik ≤ 10% dari volume tertinggi 3 minggu sebelumnya; cutback tiap minggu ke-4.
- Comeback mode (break ≥ 4 minggu): 2–3 minggu awal hanya easy + strides, volume mulai 50%.
- Nyeri 2× berturut-turut → semua sesi kualitas minggu itu diganti easy.
- Skip/swap tidak pernah menambah volume; sesi tanpa slot aman didrop, bukan ditumpuk.

## Dashboard Progres

Halaman **Progres** merangkum persiapan menuju event target:

- Hitung mundur ke hari race, minggu ke-berapa, fase, dan target waktu finish.
- Status kesiapan dari kepatuhan 4 minggu terakhir (On track ≥ 75%, perlu konsisten 50–74%, tertinggal < 50%).
- Volume mingguan sebagai bullet chart: lintasan = km rencana, isian = km dijalani (ketuk batang untuk detail).
- Linimasa fase (Comeback → Base → Build → Peak → Taper) dengan penanda posisi saat ini.
- Prediksi waktu finish (rumus Riegel) dari lari terbaik ≥ 3 km dalam 6 minggu terakhir, dibandingkan target.
- Long run terjauh, minggu konsisten berturut-turut, total km, tren readiness 14 hari, dan 5 lari terakhir.

Logikanya ada di `dashboardFrom()` (src/lib/store.ts) dan dites di `store.test.ts`.

## Untuk riset Fase 0

- Bagikan link Pages ke peserta; mereka buka di HP lalu **Add to Home Screen**.
- Data tiap peserta ada di HP-nya sendiri. Di **Profil → Unduh data (JSON)** peserta bisa mengirim datanya ke tim riset.
- Data tidak sinkron antar perangkat, dan hilang jika data browser dihapus.

## Keterbatasan

- Tanpa Strava (butuh server untuk menyimpan client secret). Lihat branch `server-postgres`.
- Bobot readiness dan target volume masih asumsi awal; perlu kalibrasi dengan data beta dan review pelatih.
- Saran latihan bukan pengganti nasihat medis.
