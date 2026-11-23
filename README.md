# Pantau Tokder

Pantau Tokder is an internal operations tool for a small YouTube production team ("tokder" plays on "tukang goreng" / a street vendor, the team's channel theme). Before it existed, the team was piecing together channel performance, staff attendance and affiliate earnings from several disconnected sources; this app puts analytics, staff work tracking, affiliate links and multi-platform posting behind one login, with different views depending on whether you are the owner or staff. The backend is an Express API on Postgres, the frontend is a static Vite app, and the whole thing is deployed on Vercel.

[Baca dalam Bahasa Indonesia di bawah](#bahasa-indonesia)

## What it does

- **Channel analytics** across several YouTube channels at once: click-through rate pulled from the YouTube Reporting API (not estimated), side-by-side channel comparison, and trend charts over time.
- **Content suggestions** generated from real signals rather than guesses: current YouTube search activity, which of the team's own videos are actually selling, and which affiliate products are actually generating sales, so the production team gets "make more of this" advice grounded in data instead of hunches.
- **Affiliate tracking**: a link tracker for outbound affiliate links, a CSV import for affiliate platforms that only export reports as spreadsheets, and a top-products view with real rupiah amounts, not just click counts.
- **Staff operations**: a daily dashboard per staff member, attendance verified against both the office's Wi-Fi IP address and GPS (so "clocking in" from home is caught), tracked working hours, public holidays, payroll, leave requests and claims, and a performance view.
- **Role-based access**: owners see earnings and settings; staff only ever see their own data, never a coworker's numbers or the channel's full revenue.
- **Cross-platform posting** so one piece of content reaches TikTok, Instagram, Facebook and YouTube from a single upload: the file is uploaded once to Vercel Blob, every post is created as a draft first and only goes live when explicitly published, OAuth access is read-only wherever analytics are the only thing needed, access tokens are stored encrypted, and there is a Meta data-deletion callback to satisfy their platform policy requirements.
- **Push notifications** to staff phones, plus an hourly background sync so the dashboard data never goes too stale between manual refreshes.
- **Privacy Policy, Terms of Service and Data Deletion pages**, each in both Indonesian and English, which several of the social platforms above require before they will approve API access.

## Tech stack

Node.js, Express, PostgreSQL (through the `pg` driver), `node-cron` for scheduled jobs, `web-push` for notifications, `@vercel/blob` for file uploads, Vite for the frontend build, deployed on Vercel.

## Getting started

```bash
npm install
cp api/.env.example api/.env   # then fill in the values below
npm run dev                    # the frontend, with hot reload
npm start                      # the API
npm test
```

Apply `migrations/001_init.sql` and then `migrations/002_seed.sql` to your Postgres database before starting the API for the first time.

### Environment variables

`DATABASE_URL`, `ADMIN_PASSWORD`, `ENCRYPTION_KEY`, `CRON_SECRET`, `PUBLIC_URL`, `ALLOWED_ORIGIN`, `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_IDS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BLOB_READ_WRITE_TOKEN`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `META_GRAPH_VERSION`. The platform-specific keys (TikTok, Facebook, Instagram) are only required for the platforms you actually connect; the app degrades gracefully when one is missing rather than failing entirely. When pasting keys into Vercel's environment variable settings, trim any surrounding whitespace first, because some platforms reject a key that has leading or trailing spaces even though it looks identical in a text editor.

## Project structure

```
app/          the frontend: index.html, src, styles
api/          the Express API and its serverless entry point for Vercel
migrations/   SQL schema and seed data, applied in numeric order
scripts/      a CSP header checker and a YouTube upload helper
docs/         the in-app user guide, TikTok/Meta platform registration notes, and app icon assets
```

Only the `main` branch is ever deployed; branch previews are intentionally left blocked, since the Vercel Hobby plan's preview deployments would otherwise expose an unfinished feature to anyone with the preview link.

---

## Bahasa Indonesia

Pantau Tokder adalah alat operasional internal untuk tim produksi YouTube kecil ("tokder" bermain dari "tukang goreng", tema channel tim ini). Sebelum ada alat ini, tim harus menyatukan performa channel, presensi karyawan, dan penghasilan afiliasi dari beberapa sumber yang terpisah-pisah; aplikasi ini menyatukan analitik, pelacakan kerja karyawan, tautan afiliasi, dan posting ke banyak platform di balik satu login, dengan tampilan berbeda bergantung apakah Anda pemilik atau karyawan. Backend-nya API Express di Postgres, frontend-nya aplikasi Vite statis, dan semuanya dideploy di Vercel.

### Fungsi

- **Analitik channel** untuk beberapa channel YouTube sekaligus: rasio klik-tayang (CTR) diambil dari YouTube Reporting API (bukan perkiraan), perbandingan antar channel berdampingan, dan grafik tren dari waktu ke waktu.
- **Saran konten** yang dihasilkan dari sinyal nyata, bukan tebakan: aktivitas pencarian YouTube saat ini, video milik tim sendiri mana yang benar-benar terjual, dan produk afiliasi mana yang benar-benar menghasilkan penjualan, sehingga tim produksi mendapat saran "buat lebih banyak yang seperti ini" yang berdasar data, bukan dugaan.
- **Pelacakan afiliasi**: pelacak tautan untuk tautan afiliasi keluar, impor CSV untuk platform afiliasi yang hanya mengekspor laporan sebagai spreadsheet, dan tampilan produk terlaris dengan nominal rupiah nyata, bukan sekadar jumlah klik.
- **Operasional karyawan**: dashboard harian per karyawan, presensi yang diverifikasi terhadap alamat IP Wi-Fi kantor sekaligus GPS (sehingga "absen" dari rumah tertangkap), jam kerja yang terlacak, tanggal merah, gaji, pengajuan izin dan klaim, serta tampilan performa.
- **Akses berbasis peran**: pemilik melihat penghasilan dan pengaturan; karyawan hanya pernah melihat datanya sendiri, tidak pernah angka rekan kerja atau pendapatan channel secara penuh.
- **Posting lintas platform** sehingga satu konten mencapai TikTok, Instagram, Facebook, dan YouTube dari satu kali upload: berkas diunggah sekali ke Vercel Blob, setiap posting dibuat sebagai draf dulu dan baru tayang saat diterbitkan secara eksplisit, akses OAuth bersifat baca-saja di mana pun analitik satu-satunya yang dibutuhkan, token akses disimpan terenkripsi, dan ada callback hapus data Meta untuk memenuhi kebijakan platform mereka.
- **Notifikasi push** ke HP karyawan, ditambah sinkron latar tiap jam sehingga data dashboard tidak terlalu basi di antara refresh manual.
- **Halaman Kebijakan Privasi, Syarat Layanan, dan Hapus Data**, masing-masing dalam bahasa Indonesia dan Inggris, yang diminta beberapa platform sosial di atas sebelum mereka menyetujui akses API.

### Teknologi

Node.js, Express, PostgreSQL (lewat driver `pg`), `node-cron` untuk pekerjaan terjadwal, `web-push` untuk notifikasi, `@vercel/blob` untuk unggahan berkas, Vite untuk build frontend, dideploy di Vercel.

### Menjalankan

```bash
npm install
cp api/.env.example api/.env   # lalu isi nilai di bawah
npm run dev                    # frontend, dengan hot reload
npm start                      # API
npm test
```

Terapkan `migrations/001_init.sql` lalu `migrations/002_seed.sql` ke database Postgres sebelum menjalankan API untuk pertama kali.

### Variabel lingkungan

`DATABASE_URL`, `ADMIN_PASSWORD`, `ENCRYPTION_KEY`, `CRON_SECRET`, `PUBLIC_URL`, `ALLOWED_ORIGIN`, `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_IDS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BLOB_READ_WRITE_TOKEN`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `META_GRAPH_VERSION`. Kunci khusus platform (TikTok, Facebook, Instagram) hanya perlu diisi untuk platform yang benar-benar disambungkan; aplikasi tetap berjalan dengan baik saat salah satunya tidak ada, bukan gagal total. Saat menempel kunci ke pengaturan variabel lingkungan Vercel, pangkas dulu spasi di sekelilingnya, karena sebagian platform menolak kunci yang punya spasi di awal atau akhir meskipun terlihat identik di editor teks.

### Struktur

```
app/          frontend: index.html, src, styles
api/          API Express dan entri serverless-nya untuk Vercel
migrations/   skema SQL dan data awal, diterapkan sesuai urutan nomornya
scripts/      pemeriksa header CSP dan pembantu unggah YouTube
docs/         panduan pengguna dalam aplikasi, catatan pendaftaran platform TikTok/Meta, dan aset ikon aplikasi
```

Hanya branch `main` yang pernah dideploy; preview cabang sengaja dibiarkan terblokir, karena deployment preview di paket Vercel Hobby bisa membuka fitur yang belum rampung ke siapa pun yang memegang tautan preview-nya.
