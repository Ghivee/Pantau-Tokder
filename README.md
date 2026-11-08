# Pantau Tokder

Dasbor internal tim konten Tokder: kerja harian, presensi, gaji, dan performa video di YouTube, TikTok, Instagram, Facebook, plus posting sekali upload (semua sebagai draf).

## Peta folder

| Folder / berkas | Isi |
|---|---|
| `app/index.html` | Halaman induk (Vite) |
| `app/src/` | Kode tampilan: `main.js` (entri), `lib/` (pembantu murni), `core/` (state, data, router, aturan), `ui/` (ikon, dialog, grafik, tata letak), `pages/` (satu berkas per halaman), `actions.js` (penanganan klik) |
| `app/styles/` | Gaya: `tokens` (warna/ukuran), `base`, `layout`, `controls`, `components`, `overlays`, `responsive`, `pages`, `utilities`; urutan impor di `index.css` |
| `assets/` | Berkas statis yang disajikan apa adanya: ikon, logo, `privacy.html`, `terms.html`, `data-deletion.html`, berkas verifikasi TikTok, service worker |
| `api/src/routes` | Alamat API (tipis, hanya validasi dan jawaban) |
| `api/src/services` | Logika bisnis dan akses database |
| `api/src/integrations` | Penghubung ke YouTube, TikTok, Meta, dan posting |
| `api/src/middlewares`, `config`, `utils` | Sesi/keamanan, skema database, pembantu |
| `api/test` | Tes otomatis (`npm test`) |
| `api/scripts/migrasi-lama` | Arsip skrip migrasi lama, tidak perlu dijalankan |
| `scripts/` | Pemeriksa CSP dan pengunggah YouTube (dipakai GitHub Actions) |
| `.github/workflows` | Sinkronisasi, posting YouTube, tes |
| `docs/` | `PANDUAN.md` (pemakaian), `PENDAFTARAN_TIKTOK_META.md` (daftar TikTok/Meta), `TIKTOK_ISIAN.md` (isian formulir siap tempel) |

## Perintah

`npm run dev` (tampilan, port 3000) · `npm start` (API, port 3001) · `npm test` · `npm run build`

Mendaftarkan app ke TikTok for Developers dan Meta: lihat `docs/PENDAFTARAN_TIKTOK_META.md`.
