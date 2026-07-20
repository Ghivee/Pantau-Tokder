# Pantau Konten Tokder — Deployment Vercel

## Analisis Masalah & Perbaikan

Penyebab **"Cannot GET /"** pada Vercel ada 3 masalah sekaligus:

| Masalah | Penyebab | Solusi |
|---------|----------|--------|
| Vercel tidak menampilkan `index.html` | Tidak ada root `package.json`, Vercel bingung menentukan jenis proyek | Ditambahkan `package.json` di root dengan dependencies yang dibutuhkan |
| Vercel tidak tahu mana file statis, mana serverless | `vercel.json` hanya punya `rewrites` tanpa `builds` | Ditambahkan konfigurasi `builds` eksplisit untuk setiap file |
| Backend crash karena `.env` tidak ada di Vercel | `dotenv.config()` gagal, `DATABASE_URL` berisi placeholder | `dotenv` dibungkus `try-catch`, placeholder terdeteksi otomatis → mode dummy aktif |

## Struktur Repo Final (Bersih)

```
Pantau-Tokder/
├── index.html          ← Halaman utama (statis)
├── dashboard.css       ← Styling
├── dashboard.js        ← Logika frontend
├── tokderlogo.png      ← Logo
├── package.json        ← Dependencies untuk Vercel
├── vercel.json         ← Konfigurasi routing & build Vercel
├── .gitignore
└── api/
    ├── index.js        ← Entry point serverless function
    └── src/
        ├── app.js      ← Express app
        ├── config/
        │   └── db.js   ← Koneksi DB / data dummy
        ├── routes/     ← Endpoint API
        ├── services/   ← Logika bisnis
        ├── integrations/ ← Koneksi YouTube/IG/FB
        └── jobs/
            └── cronScan.js
```

---

## Mode Saat Ini: Data Dummy (Tanpa API/DB)

Saat ini proyek berjalan sepenuhnya dengan **data dummy** bawaan. Tidak perlu database, tidak perlu API key. Ini sudah bisa langsung online di Vercel.

---

## Panduan Beralih ke Data Asli

Ketika Anda siap menggunakan data asli, ikuti langkah berikut:

### Langkah 1: Siapkan Database PostgreSQL

Buat database gratis di [Supabase](https://supabase.com) atau [Neon](https://neon.tech):
1. Buat akun dan project baru
2. Salin **Connection String** (biasanya berformat `postgresql://user:password@host:port/dbname`)
3. Jalankan SQL dari file `migrations/001_init.sql` di SQL Editor Supabase untuk membuat tabel

### Langkah 2: Siapkan API Key Platform

| Platform | Cara Mendapatkan |
|----------|-----------------|
| **YouTube** | Buka [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Enable YouTube Data API v3 → Create Credentials → API Key |
| **Instagram** | Buka [Meta for Developers](https://developers.facebook.com) → Buat App → Instagram Basic Display API → Generate Token |
| **Facebook** | Dari app Meta yang sama → Marketing API → Page Access Token |

### Langkah 3: Masukkan ke Vercel Environment Variables

1. Buka **Dashboard Vercel** → pilih project **Pantau-Tokder**
2. Klik **Settings** → **Environment Variables**
3. Tambahkan variable berikut satu per satu:

| Name | Value | Keterangan |
|------|-------|------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/dbname` | Connection string dari Supabase/Neon |
| `YOUTUBE_API_KEY` | `AIza...` | API key dari Google Cloud |
| `YOUTUBE_CHANNEL_ID` | `UC...` | ID channel YouTube yang dipantau |
| `IG_BUSINESS_ACCOUNT_ID` | `17841...` | ID akun bisnis Instagram |
| `FB_PAGE_ACCESS_TOKEN` | `EAAG...` | Token akses halaman Facebook |
| `FB_PAGE_ID` | `12345...` | ID halaman Facebook |

4. Klik **Save**
5. Klik **Deployments** → klik titik tiga (⋯) pada deployment terakhir → **Redeploy**

> [!IMPORTANT]
> Setelah menambahkan `DATABASE_URL` yang valid, sistem akan **otomatis beralih** dari data dummy ke data asli dari database. Tidak perlu mengubah kode apapun!

### Langkah 4: Jalankan Migrasi Database

Jalankan SQL berikut di SQL Editor Supabase Anda untuk membuat tabel yang dibutuhkan:

```sql
CREATE TABLE IF NOT EXISTS editors (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  kode_identifikasi VARCHAR(20) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'aktif'
);

CREATE TABLE IF NOT EXISTS content (
  id SERIAL PRIMARY KEY,
  editor_id INTEGER REFERENCES editors(id),
  platform VARCHAR(50) NOT NULL,
  judul TEXT,
  tanggal_upload TIMESTAMP,
  url TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  komentar INTEGER DEFAULT 0,
  status_identifikasi VARCHAR(20) DEFAULT 'unmatched'
);
```

---

## Testing Lokal

Untuk testing lokal tanpa backend (data dummy frontend):
```
Buka index.html langsung di browser (klik dua kali)
```

Untuk testing lokal dengan backend:
```bash
cd api
npm install
npm start
# Buka http://localhost:3000 di browser
# Frontend harus dibuka terpisah dari index.html
```
