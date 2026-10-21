# Panduan Pantau Tokder

Pantau Tokder memantau kerja harian tim konten di tiga channel: **Tokder**, **Budidaya Cabe** dan **Harga Cabe Hari Ini**.

- Video ditarik otomatis dari YouTube.
- Setiap video dikenali pembuatnya lewat kode karyawan di deskripsi.
- Tugas di luar upload dicatat sendiri oleh karyawan.
- Dari semua itu, sistem menghitung skor harian per karyawan.

## Isi aplikasi

| Menu | Isi | Siapa |
|---|---|---|
| Ringkasan | Video tayang vs target, views, tepat jadwal, kinerja tiap karyawan, per channel, ide topik, video terbaik | Semua |
| Harian | Satu kartu per karyawan untuk hari yang dipilih: skor, cek harian, garis waktu jadwal vs jam tayang, skor 14 hari, daftar yang dikerjakan | Semua |
| Konten | Semua video: cari, filter, urutkan, detail dan retensi, unduh CSV | Semua |
| Belum dikenali | Video tanpa kode karyawan, untuk ditetapkan manual | Pemilik dan Editor |
| Karyawan | Kode, peran, jadwal, target, PIN | Diubah oleh Pemilik |
| Pendapatan | Pendapatan iklan per karyawan/channel/video, target omzet afiliasi | Pemilik |
| Pengaturan | Status sambungan, sinkronisasi, channel, password | Pemilik |

Kalau server belum tersambung, atau alamat diakhiri `?demo`, aplikasi menampilkan **data contoh** dengan pita kuning di bagian atas. Di mode ini password pemilik adalah `demo` dan PIN karyawan `1234`.

---

## Menyambungkan data asli

### 1. Terbitkan kode baru

Perubahan ini ada di branch `dashboard-harian`. Gabungkan ke `main` lewat Pull Request di GitHub. Vercel akan menerbitkannya otomatis.

Saat aplikasi pertama kali dibuka setelah terbit, database diperbarui otomatis. Perubahannya hanya **menambah**, tidak ada data yang dihapus:

- tabel `aktivitas`
- kolom `peran`, `pin`, `jadwal`, `target_harian`, `foto_url` di tabel karyawan
- kolom `channel_id`, `channel_nama`, `revenue` di tabel konten

> Link Preview dari Vercel memakai database yang sama dengan website utama. Jadi membuka link Preview juga menjalankan pembaruan database di atas.

### 2. Masukkan ketiga channel di Vercel

1. Cari **ID channel** masing-masing (diawali `UC…`). Caranya: login ke channel itu, buka https://www.youtube.com/account_advanced, lalu salin **ID Channel**. Ulangi untuk ketiga channel.
2. Buka Vercel → project **Pantau-Tokder** → **Settings → Environment Variables**.
3. Tambahkan:

| Name | Value |
|---|---|
| `YOUTUBE_CHANNEL_IDS` | Tiga ID dipisah koma, misal `UC1wIvd8HotnZe0KENzHj2kQ,UCxxxx,UCyyyy` |

4. Variabel yang sudah ada tetap dipakai: `DATABASE_URL`, `YOUTUBE_API_KEY`, `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET`. Kalau `YOUTUBE_CHANNEL_IDS` sudah diisi, `YOUTUBE_CHANNEL_ID` yang lama tidak dipakai lagi.
5. Buka **Deployments**, klik ⋯ pada deployment terakhir, lalu **Redeploy**.

### 3. Masuk sebagai pemilik dan ganti password

1. Klik **Masuk → Pemilik**. Password bawaannya `admin123`.
2. Langsung buka **Pengaturan → Password pemilik** dan ganti dengan password minimal 8 karakter.

Password bawaan itu diketahui siapa pun yang membaca kode. Selama belum diganti, siapa saja bisa masuk sebagai pemilik.

### 4. Atur karyawan

Buka menu **Karyawan**.

- **Alivia** belum ada. Klik **Tambah karyawan** dan isi:
  - Nama `Alivia`, kode `AL`, peran **Editor**
  - Jadwal tayang, misal `06:00, 07:00, 12:00`
  - Target, misal `3`
  - PIN 4–12 angka
- **DENI**: klik **Ubah**, ganti nama menjadi `Deni`, peran **Editor terbatas**, lalu isi jadwal, target dan PIN.
- **Ghifa** dan **HILAL**: kalau tidak lagi bekerja, ubah statusnya menjadi **Nonaktif**. Jangan dihapus, supaya video lama tetap tercatat atas nama mereka.

PIN tidak bisa dilihat lagi setelah disimpan. Berikan PIN langsung ke masing-masing karyawan.

**Jadwal** adalah jam tayang yang direncanakan (WIB). Video yang tayang lebih dari 15 menit setelah jadwal dihitung **telat**. Kalau jadwal dikosongkan, penilaian tepat/telat tidak dihitung untuk orang itu.

### 5. Wajib: kode di deskripsi video

Supaya video dikenali otomatis, setiap karyawan menulis kodenya di **deskripsi** video, misalnya:

```
#AL
```

atau `#DE` untuk Deni. Kode harus berdiri sendiri. Sebelumnya, kode yang menempel di kata lain ikut terhitung, misalnya "DE" di dalam kata "kode" atau "desa". Akibatnya video bisa tercatat atas nama orang yang salah. Sekarang hal itu sudah tidak terjadi.

Untuk video lama yang mungkin salah tercatat, periksa di menu **Konten** (filter per pembuat). Buka videonya, lalu ganti pembuatnya bila perlu.

Video tanpa kode masuk ke **Belum dikenali**. Pemilik atau Alivia bisa menetapkan pembuatnya di sana, satu per satu atau beberapa sekaligus.

### 6. Sinkronisasi

- Klik **Pengaturan → Sinkronkan sekarang** untuk menarik video 30 hari terakhir dari ketiga channel.
- Vercel juga menjalankan sinkronisasi otomatis sekali sehari, pukul 07:00 WIB (`vercel.json`, bagian `crons`). Paket gratis Vercel hanya mengizinkan jadwal harian. Agar data lebih sering diperbarui, klik Sinkronkan, atau pakai layanan cron luar yang memanggil `https://<domain>/api/scan/cron`.
- Satu sinkronisasi dibatasi sekitar 45 detik. Kalau videonya banyak, sisanya dilanjutkan di sinkronisasi berikutnya; pesan di layar akan memberi tahu.

> Video terakhir di database bertanggal **21 Agustus 2026**. Setelah langkah 2 dan 6, cek **Pengaturan → Sambungan** untuk memastikan sinkronisasi berjalan lagi. Kalau masih gagal, buka Vercel → Deployments → **Logs**, cari baris `Scan`, lalu kirimkan pesannya.

### 7. YouTube Analytics (retensi dan pendapatan)

Di **Pengaturan**, klik **Hubungkan** lalu login dengan akun Google pemilik channel.

Ada satu batasan dari YouTube: satu sambungan hanya membaca **satu channel**, yaitu channel yang dipilih saat login. Untuk channel lain, grafik retensi ditampilkan sebagai perkiraan, dan pendapatan mereka tidak terbaca.

### 8. Kebiasaan harian karyawan

1. Buka website, klik **Masuk → Karyawan**, pilih nama dan isi PIN.
2. Halaman **Harian** langsung menampilkan kartu mereka sendiri.
3. Setiap selesai tugas, klik **Catat aktivitas** dan isi:
   - jenis tugas: riset harga cabai, buat thumbnail, cek SEO & tag, balas komentar, edit video, atau lainnya
   - jam selesai
   - jumlah, misalnya banyak komentar yang dibalas
   - keterangan singkat
4. Upload video tidak perlu dicatat, karena sudah otomatis dari YouTube selama kodenya ada di deskripsi.

Karyawan hanya bisa mencatat untuk hari ini dan 2 hari ke belakang. Catatan sendiri bisa dihapus dalam 24 jam. Pemilik bisa mencatat dan menghapus untuk siapa pun.

---

## Cara skor dihitung (0–100 per hari)

| Komponen | Poin | Ukuran |
|---|---|---|
| Video tayang | 35 | Jumlah video dibanding target harian karyawan |
| Tepat jadwal | 25 | Bagian video yang tayang paling lambat 15 menit setelah jadwal |
| Views | 20 | Views video dibanding median channel dan jenis yang sama (Shorts/panjang). Hanya video berumur ≥ 2 hari. Poin penuh pada 1,2× median |
| Tugas lain | 20 | Target harian: 1 riset harga, thumbnail dan cek SEO sebanyak target video, 30 komentar |

Komponen yang belum ada datanya tidak dihitung, dan skor dihitung dari komponen sisanya. Contohnya: jadwal belum diatur, atau belum ada aktivitas tercatat sama sekali.

Untuk **hari ini**, target hanya menghitung jadwal yang sudah lewat, jadi skor pagi hari tidak langsung jelek. Skornya ditandai "sementara".

Nilai: **A** ≥ 85, **B** ≥ 70, **C** ≥ 55, **D** di bawahnya. Aturan ini bisa diubah di bagian atas `app/main.js` (`TOL`, `TUGAS`).

## Ide konten

Topik ditebak dari kata di judul, misalnya "harga", "thrips", "pupuk" atau "semai". Daftar katanya ada di `TOPIK` dalam `app/main.js`. Setiap topik dibandingkan dengan median views channel-nya:

- 1,2× ke atas: **perbanyak**
- di bawah 0,8×: **kurangi**
- kurang dari 2 video: **uji lagi**

## Keamanan

- Halaman bisa **dilihat** tanpa masuk, sama seperti versi sebelumnya. Mencatat, menetapkan dan mengubah data perlu PIN atau password pemilik. Untuk mengunci seluruh website, aktifkan **Vercel → Settings → Deployment Protection**.
- PIN disimpan dalam bentuk hash, bukan teks asli.
- `/api/scan/status` sekarang hanya menjawab "ada/tidak". Potongan kunci API tidak lagi ditampilkan.

## Struktur file

```
index.html          kerangka halaman
app/styles.css      tampilan (warna, huruf, tata letak, mode gelap)
app/main.js         logika halaman, skor, grafik
app/demo.js         data contoh untuk mode demo
api/src/...         server: sinkronisasi YouTube, karyawan, aktivitas, akses
```
