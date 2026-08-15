# Integrasi API Meta (Facebook & Instagram)

Saat ini web Tokder baru menyinkronkan data secara nyata dari YouTube. Untuk menghubungkan Facebook dan Instagram dari Meta Business Suite Anda secara otomatis, kita perlu mengintegrasikan **Meta Graph API**.

## Pendekatan yang Disarankan

Untuk memberikan pengalaman termudah bagi Anda (tanpa perlu menyalin token yang bisa kedaluwarsa), saya merekomendasikan pembuatan sistem **OAuth Meta (Facebook Login)**, sama seperti yang kita lakukan pada YouTube.

### Tahap 1: Persiapan Aplikasi Meta (Tugas Anda)
Karena API Meta sangat ketat, Anda harus membuat Aplikasi di **Meta for Developers** (developers.facebook.com). Anda nantinya perlu:
1. Membuat aplikasi tipe **Business**.
2. Mengaktifkan **Facebook Login for Business**.
3. Mendapatkan `META_APP_ID` dan `META_APP_SECRET` lalu memasukkannya ke Vercel Environment Variables.
4. Menambahkan URL Redirect OAuth dari web Anda.

*Detail langkah demi langkah akan saya berikan di instruksi selanjutnya setelah rencana ini disetujui.*

### Tahap 2: Pembaruan Sistem Web (Tugas Saya)
Saya akan memodifikasi kode web ini untuk:
1. **Sistem Login Meta:** Membuat rute `/api/auth/meta` agar Anda bisa login ke Facebook langsung dari halaman Pengaturan web Tokder.
2. **Penyimpanan Token:** Menyimpan *Page Access Token* secara aman di database `settings` agar sinkronisasi bisa berjalan otomatis setiap saat.
3. **Penarikan Data Asli:** Memperbarui fungsi `scanService.js` dan integrasi FB/IG agar menarik postingan Reels, Video, dan Postingan terbaru dari API Meta, lengkap beserta jumlah *Views* (jika tersedia), *Likes*, *Komentar*, dan *Durasi* video.
4. **Tampilan Pengaturan:** Menambahkan tombol **"Hubungkan Meta"** di menu Pengaturan, mendampingi tombol YouTube yang sudah ada.

> [!IMPORTANT]
> **User Review Required**
> Berbeda dengan YouTube, API Meta memiliki beberapa batasan. Misalnya, metrik *Views* (Play Count) untuk Reels di Instagram terkadang memerlukan konfigurasi izin yang sangat spesifik (seperti `instagram_manage_insights`). Apakah Anda setuju untuk menggunakan alur OAuth ini?

> [!NOTE]
> Jika Anda setuju, klik **Proceed/Lanjutkan**, dan saya akan mulai memprogram fitur OAuth Meta ini dan memandu Anda untuk setup aplikasinya di Meta for Developers!
