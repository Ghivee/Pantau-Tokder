# Pantau Tokder

Alat internal untuk tim produksi YouTube kecil. Satu tempat untuk memantau analitik channel, kerja dan presensi karyawan, tautan afiliasi, dan posting ke beberapa platform sosial. Backend-nya API Express di Postgres, frontend-nya aplikasi Vite statis. Dideploy di Vercel.

[English](README.md)

## Fungsi

- **Analitik channel** untuk beberapa channel YouTube, dengan CTR dari YouTube Reporting API, perbandingan antar channel, dan tren.
- **Saran** judul, topik, dan kata kunci dari pencarian YouTube dan video terlaris yang nyata, serta dari penjualan produk afiliasi.
- **Afiliasi:** pelacak tautan, impor CSV, dan produk terlaris dengan nominal rupiah.
- **Karyawan:** dashboard harian, presensi yang dicek terhadap IP Wi-Fi kantor dan GPS, jam kerja, tanggal merah, gaji, izin dan klaim, serta performa.
- **Peran:** pemilik melihat penghasilan dan pengaturan, karyawan hanya melihat datanya sendiri.
- **Posting** sekali upload ke TikTok, Instagram, Facebook, dan YouTube. Berkas masuk ke Vercel Blob, semua posting disimpan sebagai draf dulu lalu ditayangkan. OAuth bersifat baca-saja untuk analitik, token dienkripsi, dan ada callback hapus data Meta.
- **Notifikasi HP** lewat web push dan sinkron tiap jam.
- Halaman Kebijakan Privasi, Syarat Layanan, dan Hapus Data dalam bahasa Indonesia dan Inggris.

## Teknologi

Node.js, Express, Postgres (`pg`), `node-cron`, `web-push`, `@vercel/blob`, Vite, Vercel.

## Menjalankan

```bash
npm install
cp api/.env.example api/.env   # lalu isi nilainya
npm run dev                    # frontend
npm start                      # API
npm test
```

Terapkan `migrations/001_init.sql` dan `migrations/002_seed.sql` ke database Postgres.

### Variabel lingkungan

`DATABASE_URL`, `ADMIN_PASSWORD`, `ENCRYPTION_KEY`, `CRON_SECRET`, `PUBLIC_URL`, `ALLOWED_ORIGIN`, `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_IDS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BLOB_READ_WRITE_TOKEN`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `META_GRAPH_VERSION`. Kunci platform hanya perlu diisi untuk platform yang disambungkan. Pangkas spasi pada kunci yang ditempel ke Vercel, karena sebagian platform menolaknya.

## Struktur

```
app/          frontend (index.html, src, styles)
api/          API Express dan entri serverless
migrations/   skema SQL dan data awal
scripts/      cek CSP, pembantu unggah YouTube
docs/         panduan pengguna, catatan pendaftaran TikTok dan Meta, ikon aplikasi
```

Hanya `main` yang dideploy. Preview cabang selalu diblokir di paket Vercel Hobby.
