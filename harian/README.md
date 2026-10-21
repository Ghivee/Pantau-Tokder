# Pantau Harian Karyawan

Halaman `/harian/` menampilkan apa saja yang dikerjakan Alivia dan Deni setiap hari di channel Tokder, Budidaya Cabe dan Harga Cabe Hari Ini: video yang tayang, tepat atau telat jadwal, tugas lain, skor harian, dan ide topik berikutnya.

- Semua karyawan: `https://<domain-vercel>/harian/`
- Link pribadi (kartu sendiri di atas, dengan sapaan): `/harian/#alivia` dan `/harian/#deni`

Halaman ini berdiri sendiri. Aplikasi utama Pantau Tokder di `/` tidak berubah.

Saat ini isinya **data contoh** (`data/video.csv` dan `data/aktivitas.csv`). Ikuti langkah di bawah untuk memakai data asli.

---

## Mengganti ke data asli (Google Sheet)

### 1. Buat satu Google Sheet dengan dua tab

Buat Sheet baru, misalnya "Pantau Harian Tokder", lalu buat dua tab bernama `video` dan `aktivitas`. Isi baris pertama tiap tab dengan judul kolom persis seperti di bawah. Cara cepatnya: **File → Impor** lalu pilih `data/template-video.csv` dan `data/template-aktivitas.csv`.

**Tab `video`**: satu baris per video yang tayang.

| Kolom | Isi | Contoh |
|---|---|---|
| Tanggal | Tanggal tayang | `2026-10-22` atau `22/10/2026` |
| Channel | Persis salah satu: `Tokder`, `Budidaya Cabe`, `Harga Cabe Hari Ini` | Budidaya Cabe |
| Karyawan | Persis `Alivia` atau `Deni` | Alivia |
| Judul | Judul video | Cara semai cabai anti gagal |
| Topik | Kelompok topik, tetap konsisten | Semai & bibit |
| Jadwal | Jam tayang yang direncanakan | `12:00` |
| Jam_Tayang | Jam video benar-benar tayang | `12:04` |
| Views | Dari YouTube Studio | 2345 |
| Jam_Tonton | Dari YouTube Studio (boleh 0) | 120,5 |
| Subscriber | Dari YouTube Studio (boleh 0) | 25 |
| CTR | Dari YouTube Studio (boleh 0) | 6,2 |

Mengisi Views dari YouTube Studio: **Analytics → Mode lanjutan → Konten**, pilih rentang tanggal, lalu **Ekspor → Google Spreadsheet**. Salin kolom views ke baris video yang sama. Views terus bertambah, jadi perbarui sekali sehari.

**Tab `aktivitas`**: satu baris per pekerjaan selain upload. Diisi Alivia dan Deni sendiri.

| Kolom | Isi | Contoh |
|---|---|---|
| Tanggal | Tanggal kerja | `2026-10-22` |
| Jam | Jam selesai | `05:30` |
| Karyawan | Persis `Alivia` atau `Deni` | Deni |
| Tugas | Persis salah satu: `Riset harga cabai`, `Buat thumbnail`, `Cek SEO & tag`, `Balas komentar` | Balas komentar |
| Detail | Keterangan singkat | Balas komentar di 3 channel |
| Jumlah | Banyaknya (komentar: jumlah komentar; lainnya: 1) | 15 |

Tugas di luar empat jenis itu tetap muncul di daftar "Yang dikerjakan", tetapi tidak dihitung dalam skor.

Saran supaya isian tidak salah ketik: pakai **Data → Validasi data → Dropdown** untuk kolom Channel, Karyawan dan Tugas.

### 2. Bagikan Sheet ke karyawan

**Bagikan** Sheet ke `alivialutfiana1@gmail.com` dan `arirana45@gmail.com` sebagai **Editor** supaya mereka bisa mengisi log aktivitas.

### 3. Publikasikan tiap tab sebagai CSV

1. **File → Bagikan → Publikasikan ke web**.
2. Pilih tab `video`, format **Nilai yang dipisahkan koma (.csv)**, klik **Publikasikan**, lalu salin link-nya.
3. Ulangi untuk tab `aktivitas`.

Link-nya kira-kira seperti `https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv`.

### 4. Tempel link ke `harian/config.js`

Di GitHub, buka `harian/config.js`, klik ikon pensil, lalu ganti bagian `data`:

```js
data: {
  video: 'https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv',
  tugas: 'https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=123456&single=true&output=csv',
},
```

Klik **Commit changes**. Vercel akan menerbitkan ulang otomatis dalam sekitar satu menit.

Setelah itu Anda tidak perlu menyentuh GitHub lagi. Setiap isian baru di Sheet akan muncul di dashboard. Google memperbarui CSV yang dipublikasikan sekitar setiap 5 menit, dan dashboard memuat ulang data setiap 10 menit (atau klik **Muat ulang data** di bagian bawah halaman).

### 5. Foto profil (opsional)

Unggah foto ke folder `harian/foto/` (misalnya `alivia.jpg` dan `deni.jpg`; foto persegi paling bagus), lalu isi di `config.js`:

```js
foto: {
  Alivia: '/harian/foto/alivia.jpg',
  Deni: '/harian/foto/deni.jpg',
},
```

Kalau dikosongkan, kartu memakai inisial nama.

---

## Aturan skor (0–100 per hari)

| Komponen | Poin | Ukuran |
|---|---|---|
| Video tayang | 35 | Dibanding target 3 video per orang per hari |
| Tepat jadwal | 25 | Telat lebih dari 15 menit dihitung telat |
| Views | 20 | Dibanding video lain di channel dan hari yang sama; poin penuh di 1,2× |
| Tugas lain | 20 | Target harian: 30 komentar, 1 riset harga, 3 thumbnail, 3 cek SEO |

Nilai: A ≥ 85, B ≥ 70, C ≥ 55, D di bawahnya. Target dan bobot ada di bagian atas `harian/app.js` (`TARGET`, `TOL`, `TUGAS`).

## Soal akses

- Link Vercel bisa dibuka siapa saja yang tahu alamatnya, dan link CSV yang dipublikasikan juga terbuka. Jangan masukkan data pribadi atau pendapatan ke Sheet ini.
- Untuk membatasi akses, aktifkan **Vercel → Settings → Deployment Protection** (proteksi kata sandi tersedia di paket berbayar Vercel).
- Link `#alivia` dan `#deni` hanya mengatur urutan tampilan, bukan kunci. Keduanya tetap bisa melihat data satu sama lain.
