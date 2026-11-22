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
| Performa | Video satu karyawan dibanding median channel dan rekan: views, retensi, like, tepat jadwal, perkembangan 8 minggu, dan saran perbaikan dari datanya sendiri | Semua (karyawan melihat dirinya sendiri) |
| Tren channel | Views/jam tonton/subscriber 7 hari vs minggu sebelumnya, video yang sedang naik, topik dan kata judul yang laris, video lama yang hidup lagi | Semua |
| Konten | Semua video: cari, filter, urutkan, detail dan retensi, unduh CSV | Semua |
| Analytics | Views, jam tonton, subscriber dan pendapatan harian ketiga channel dari YouTube Analytics | Semua (pendapatan hanya Pemilik) |
| Belum dikenali | Video tanpa kode karyawan, untuk ditetapkan manual | Pemilik dan Editor |
| Karyawan | Kode, peran, jadwal, target, PIN | Diubah oleh Pemilik |
| Pendapatan | Pendapatan iklan per karyawan/channel/video, target omzet afiliasi | Pemilik |
| Presensi | Absen masuk/pulang dengan cek Wi-Fi kantor + GPS; pemilik melihat rekap, percobaan yang ditolak, dan mengatur aturannya | Karyawan absen; rekap & aturan Pemilik |
| Izin & klaim | Pengajuan izin, sakit, cuti (dengan jatah tahunan) dan klaim biaya; pemilik menyetujui atau menolak | Karyawan mengajukan; Pemilik memutuskan |
| Gaji | Gaji bulanan dihitung otomatis dari presensi, izin, video, views, klaim dan aturan gaji; finalkan, cetak slip, tandai dibayar | Pemilik semua; karyawan slip sendiri |
| Panduan | Petunjuk pemakaian di dalam website, sesuai peran (pemilik atau karyawan) | Semua |
| Pengaturan | Status sambungan, sinkronisasi, channel, password | Pemilik |

Semua menu hanya bisa dibuka setelah **masuk** (pemilik atau karyawan). Sebelum masuk, website hanya menampilkan tombol Masuk.

Setiap menu punya alamatnya sendiri tanpa tanda `#`, misalnya `pantautokder.vercel.app/presensi`, `/harian` atau `/pengaturan`. Alamat lama yang memakai `#` (misalnya `/#presensi`) otomatis dialihkan ke alamat baru, jadi bookmark lama tetap jalan.

Semua angka berasal dari data asli: YouTube Data API, YouTube Analytics, dan catatan karyawan. Tidak ada data contoh atau perkiraan. Kalau sebuah angka belum tersedia, aplikasi menampilkan "—" atau "Belum ada data" beserta alasannya. Kalau server tidak bisa dihubungi, muncul pesan error dengan tombol **Coba lagi**.

---

## Menyambungkan data asli

### 1. Terbitkan kode baru

Perubahan ini ada di branch `dashboard-harian`. Gabungkan ke `main` lewat Pull Request di GitHub. Vercel akan menerbitkannya otomatis.

Saat aplikasi pertama kali dibuka setelah terbit, database diperbarui otomatis. Perubahannya hanya **menambah**, tidak ada data yang dihapus:

- tabel `aktivitas`
- kolom `peran`, `pin`, `jadwal`, `target_harian`, `foto_url` di tabel karyawan
- kolom `channel_id`, `channel_nama`, `revenue` di tabel konten

> Link Preview dari Vercel memakai database yang sama dengan website utama. Jadi membuka link Preview juga menjalankan pembaruan database di atas.

### 2. Channel yang dipantau

Ketiga channel dari akun tokodeeres@gmail.com sudah dipasang di proyek (`api/src/config/channels.js`):

| Channel | Handle | ID |
|---|---|---|
| Tokder | @tokder-tv | `UC1wIvd8HotnZe0KENzHj2kQ` |
| Budidaya Cabe | @BudidayaCabeTV | `UCzT5qFGfREJM11U81VbVhsw` |
| Harga Cabe Hari Ini | @hargacabehariini | `UCn9o9wh8IaSPUsGmXeA9qDQ` |

Setelah terbit, klik **Pengaturan → Sinkronkan sekarang** untuk menarik video ketiganya.

Untuk menambah atau mengganti channel nanti, tidak perlu login Vercel. Buka **Pengaturan → Channel**, isi satu channel per baris (link, @handle, atau ID `UC…`), lalu klik **Simpan channel**. Daftar yang disimpan di sana menggantikan daftar bawaan.

### 3. Masuk sebagai pemilik dan ganti password

Tidak ada lagi password bawaan `admin123`.

- **Kalau password pemilik sudah pernah diganti** lewat Pengaturan, password itu tetap berlaku. Saat pertama kali masuk setelah versi ini terbit, password otomatis disimpan ulang dalam bentuk hash.
- **Kalau belum pernah diganti** (selama ini masuk dengan `admin123`), isi dulu Environment Variable `ADMIN_PASSWORD` di Vercel (**Settings → Environment Variables**) dengan password baru minimal 8 karakter, lalu Redeploy. Setelah itu masuk dengan password tersebut. Tanpa langkah ini, login pemilik menampilkan pesan "Password pemilik belum diatur".

Setelah masuk, password bisa diganti di **Pengaturan → Password pemilik**. Mengganti password otomatis mengeluarkan pemilik dari semua perangkat lain.

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

### 6. Sinkronisasi (otomatis)

- Selama aplikasi terbuka di browser siapa pun, data YouTube ditarik ulang otomatis bila sudah lebih dari **15 menit**. Pojok kiri bawah menunjukkan kapan terakhir diperbarui.
- Angka di layar dimuat ulang tiap 5 menit, dan saat tab dibuka kembali.
- Vercel juga menjalankan sinkronisasi sekali sehari pukul 07:00 WIB, untuk berjaga-jaga kalau tidak ada yang membuka aplikasi.
- Klik **Pengaturan → Sinkronkan sekarang** untuk menarik saat itu juga.
- Hanya satu sinkronisasi yang bisa berjalan pada satu waktu, dan satu kali sinkronisasi dibatasi sekitar 45 detik. Sisanya dilanjutkan di sinkronisasi berikutnya.

Views, like dan komentar per video dari YouTube Data API hampir seketika. Angka **YouTube Analytics** (jam tonton, subscriber, retensi, pendapatan) memang baru dikeluarkan YouTube 2–3 hari kemudian. Itu batasan dari YouTube, bukan dari aplikasi.

### 7. YouTube Analytics untuk ketiga channel

Satu sambungan Google hanya berlaku untuk satu channel. Jadi lakukan ini **tiga kali**, sekali untuk tiap channel:

1. Masuk sebagai pemilik, buka **Pengaturan**.
2. Di baris "Analytics: Tokder", klik **Hubungkan**.
3. Login dengan **tokodeeres@gmail.com**. Saat Google bertanya "Pilih akun atau channel", **pilih channel yang sesuai**.
4. Setujui izinnya. Halaman berikutnya menyebut channel yang baru tersambung dan menyediakan tombol **Hubungkan channel lain**.
5. Ulangi untuk **Budidaya Cabe** dan **Harga Cabe Hari Ini**.

Setelah ketiganya tersambung, menu **Analytics** menampilkan:

- total views, jam tonton, subscriber bersih, rata-rata durasi tonton, dan pendapatan (khusus pemilik), dengan perbandingan ke periode sebelumnya;
- grafik views harian per channel;
- kartu dan tabel perbandingan tiap channel.

Grafik retensi di detail video juga terisi untuk ketiga channel. Kalau sebuah video belum punya retensi saat detailnya dibuka, aplikasi langsung menanyakannya ke YouTube Analytics (paling sering 6 jam sekali per video) dan menuliskan alasannya bila kosong: channel belum tersambung, YouTube belum mengeluarkan angkanya (biasanya 2–3 hari setelah tayang atau penonton masih sedikit), atau pesan penolakan dari YouTube. Retensi di atas 100% berarti bagian video itu ditonton ulang (umum di Shorts).

Sambungan lama (satu channel) dipindahkan otomatis ke channel yang benar. Sambungan bisa diputus per channel di Pengaturan.

> **Pembersihan data palsu.** Versi lama mengisi grafik retensi dan rata-rata durasi tonton dengan angka acak kalau Analytics belum tersambung. Saat versi ini pertama kali jalan, semua angka itu dihapus sekali. Retensi asli diisi ulang otomatis untuk channel yang tersambung: video 14 hari terakhir di setiap sinkronisasi, dan video lama 25 per sinkronisasi. Dua skrip pembuat data contoh (`migrate_retention.js`, `seed2.js`) juga dihapus dari repo.

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

### 9. Presensi (absen masuk dan pulang)

Absen hanya diterima kalau **semua** syarat ini terpenuhi. Semuanya diperiksa di server, bukan di HP:

1. **Wi-Fi kantor.** IP publik internet karyawan harus sama dengan IP Wi-Fi kantor yang didaftarkan pemilik. Ini lapisan utama, karena aplikasi lokasi palsu (Fake GPS) tidak bisa memalsukan jaringan. Data seluler dan VPN otomatis ditolak.
2. **Akurasi GPS.** Akurasi yang terlalu besar (melebihi batas, bawaannya 50 m) ditolak. Akurasi 0 m yang tidak wajar juga ditolak, karena sering dikirim aplikasi lokasi palsu.
3. **Lokasi baru.** Lokasi lama dari cache, atau jam HP yang beda lebih dari 5 menit dari jam server, ditolak.
4. **Radius kantor.** Posisi harus di dalam radius kantor (bawaannya 100 m).
5. **Tidak melompat.** Kalau posisi berpindah lebih cepat dari 150 km/jam dibanding lokasi sebelumnya, absen ditolak. Ini tanda lokasi diganti-ganti.

Satu karyawan hanya bisa absen masuk sekali dan absen pulang sekali per hari. Absen pulang harus setelah absen masuk. Setiap percobaan yang ditolak dicatat beserta alasan, IP, akurasi dan jaraknya, sehingga pemilik bisa melihat siapa yang mencoba curang.

**Pengaturan awal oleh pemilik** (sekali saja, di menu **Presensi → Aturan presensi**):

1. Datang ke kantor, sambungkan laptop/HP ke **Wi-Fi kantor**, masuk sebagai pemilik.
2. Klik **Pakai lokasi saya sekarang** untuk mengisi koordinat kantor.
3. Klik **Tambahkan IP saya** untuk mendaftarkan IP Wi-Fi kantor.
4. Atur radius, akurasi maksimal, **jam kerja per hari**, toleransi telat dan hari libur, lalu klik **Simpan aturan**.

Catatan:

- IP Wi-Fi kantor harus **IP statis** dari penyedia internet. Kalau IP kantor berubah-ubah, minta IP statis ke ISP, atau perbarui IP di aturan presensi setiap kali berubah. Rentang IP seperti `203.0.113.0/24` juga bisa dipakai.
- Pada jaringan IPv6, tombol **Tambahkan IP saya** otomatis mendaftarkan seluruh jaringan kantor (`…::/64`), karena tiap HP mendapat alamat berbeda.

**Karyawan:** buka menu **Presensi**, pastikan tersambung ke Wi-Fi kantor dan GPS menyala, lalu klik **Absen masuk** atau **Absen pulang**. Izinkan akses lokasi saat browser memintanya. Kalau ditolak, alasannya muncul di layar dan di daftar "Percobaan yang ditolak".

### 10. Izin, cuti dan klaim

**Karyawan:** menu **Izin & klaim** → **Ajukan izin / cuti** (izin, sakit, atau cuti yang memakai jatah tahunan) atau **Klaim biaya** (mengganti uang yang dikeluarkan untuk kerja). **Pemilik** menyetujui atau menolak di menu yang sama; jumlah yang menunggu tampil sebagai angka di menu.

Yang disetujui langsung masuk ke gaji: hari izin/sakit/cuti tidak dihitung tidak hadir, klaim ditambahkan ke gaji bulan tanggal klaimnya.

### 11. Gaji

1. **Gaji → Atur gaji → Aturan umum:** jatah cuti per tahun (bawaan 12). Hari kerja dan libur ikut **Presensi → Aturan presensi** (bagian 19).
2. **Atur gaji → Gaji (nama):** gaji pokok, tunjangan, potongan tetap (BPJS/kasbon), potongan per hari tidak hadir, potongan per hari izin, potongan per kali telat, upah lembur per jam, bonus per video di atas target, bonus per 1.000 views. Semua mulai dari 0; komponen bernilai 0 tidak dipakai.
3. Selama bulan berjalan, gaji tampil sebagai **Perkiraan** dan berubah mengikuti data. **Rincian** menampilkan slip lengkap; di sana pemilik bisa menambah **penyesuaian** (bonus atau potongan sekali dengan keterangan).
4. Akhir bulan: **Finalkan** mengunci angka menjadi slip resmi (tidak berubah lagi walau data atau aturan berubah). Setelah transfer, klik **Tandai dibayar**. **Buka lagi** mengembalikan ke perkiraan bila perlu koreksi.
5. Karyawan melihat slipnya sendiri di menu Gaji dan bisa **Cetak / PDF**.

Aturan hitung: tidak hadir = hari kerja tanpa absen masuk dan tanpa izin/sakit/cuti yang disetujui, dihitung mulai hari pertama presensi dipakai dan hanya untuk hari yang sudah lewat. Lembur = absen pulang ≥ 30 menit setelah jam pulang hari itu, atau seluruh jam kerja bila masuk di hari libur (maks. 6 jam/hari). Target video bulanan = target harian × hari kerja yang wajib hadir.

### 12. Notifikasi ke HP

Aktifkan di **Pengaturan** (pemilik) atau **Izin & klaim / Presensi** (karyawan) → **Aktifkan notifikasi**, di setiap HP atau laptop yang dipakai.

- Pemilik: pengajuan izin, sakit, cuti dan klaim baru.
- Karyawan: keputusan izin/klaim, slip gaji final, gaji dibayar, dan pengingat sekali sehari bila belum absen masuk (10 menit setelah batas telat sampai 3 jam setelah jam masuk, hanya di hari kerja dan bila tidak sedang izin/cuti).
- iPhone: buka di Safari → **Bagikan → Tambah ke Layar Utama**, buka dari ikon itu, baru aktifkan (aturan Apple, iOS 16.4+).

Kunci notifikasi (VAPID) dibuat otomatis sekali dan disimpan di database; tidak perlu mengisi apa pun di Vercel.

### 13. Sinkronisasi tiap jam

Vercel gratis hanya boleh menjalankan jadwal sekali sehari. File `.github/workflows/sinkron.yml` membuat GitHub Actions memanggil `/api/scan/cron` tiap jam (menit ke-7), jadi data YouTube dan "Sedang naik sekarang" tetap baru walau tidak ada yang membuka aplikasi, dan pengingat absen terkirim. Jalan otomatis setelah digabung ke `main`; bisa dicek di tab **Actions** GitHub. Opsional: isi secret `CRON_SECRET` di GitHub (Settings → Secrets → Actions) dengan nilai yang sama seperti di Vercel.

### 14. Impor omzet afiliasi

**Pendapatan → Impor CSV**: pilih laporan komisi CSV dari dashboard afiliasi, cek kolom tanggal dan komisi (ditebak otomatis), saring bila perlu (misal status "Selesai"), lihat pratinjau per bulan, lalu Simpan. Omzet tercapai bulan-bulan di file diganti; target tidak berubah.

### 15. Halaman Hari ini (karyawan)

Karyawan langsung masuk ke **Hari ini**: tombol absen masuk/pulang, jadwal tayang (hijau = tepat, kuning = telat, merah = terlewat, bergaris = sebentar lagi), tugas lain dengan tombol Catat, skor sementara, izin yang menunggu, dan perkiraan gaji bulan ini. Menu dikelompokkan: **Kerja saya**, **Channel & tim**, **Bantuan**. Di HP, bilah bawah karyawan berisi Hari ini · Presensi · Performa · Izin; pemilik berisi Ringkasan · Harian · Izin · Gaji.

### 16. IP Wi-Fi kantor berubah

IP internet kantor bisa berganti setelah modem menyala ulang. Bila dua karyawan (satu, bila tim hanya satu orang) yang GPS-nya di dalam kantor ditolak dari jaringan baru yang sama dalam 3 jam, pemilik mendapat notifikasi dan kartu **IP Wi-Fi kantor tampaknya berubah** di Presensi dan Ringkasan: **Ganti IP lama dengan ini**, **Tambahkan saja**, atau **Bukan kantor**. Setelah disetujui, karyawan yang tadi ditolak diberi kabar untuk absen lagi.

### 17. Perawatan data dan ringkasan mingguan

Tiap malam (01.00–05.00 WIB) jadwal tiap jam merapikan data lama: angka views per jam disimpan 14 hari, setelahnya satu angka per video per hari; tanda notifikasi terkirim dihapus setelah 60 hari; percobaan absen ditolak disimpan setahun. Senin 07.00–10.00 WIB pemilik menerima notifikasi ringkasan minggu lalu (video baru, views, telat, pengajuan menunggu). Kondisinya terlihat di **Pengaturan → Kesehatan sistem**.

### 18. Kenyamanan lain

- **Batalkan**: menghapus aktivitas atau membatalkan pengajuan bisa diurungkan dalam 5 detik.
- **Excel**: unduh rekap gaji (Gaji), presensi 30 hari (Presensi) dan daftar video (Konten).
- **Tanpa sinyal**: data terakhir disimpan di perangkat dan langsung tampil saat aplikasi dibuka; bila server tidak terjangkau, muncul keterangan jam data tersebut. Data gaji tidak disimpan di perangkat; keluar akun menghapus semuanya.

### 19. Jam kerja, tanggal merah, privasi karyawan, rupiah, ikon

- **Jam kerja per hari** (Presensi → Aturan presensi): bawaan **Senin–Kamis 08.00–16.00**, **Jumat–Sabtu 08.00–15.00**, Minggu libur. Telat dihitung dari jam masuk hari itu, pulang lebih awal dan lembur dari jam pulang hari itu.
- **Tanggal merah libur**: libur nasional dari SKB 3 Menteri 2026 dan 2027 (setneg.go.id) sudah tercatat di `api/src/services/kalenderService.js`; tahun berikutnya ditambahkan di file itu saat SKB-nya terbit (biasanya September). **Cuti bersama** opsional (centang *Ikut cuti bersama pemerintah*), dan pemilik bisa menambah **libur kantor** sendiri. Di hari libur: tidak dihitung tidak hadir, tidak ada target video/tugas, absen tetap boleh dan jamnya dihitung lembur. Satu kalender ini dipakai presensi, pengingat absen, gaji, cuti dan skor harian.
- **Karyawan hanya melihat dirinya sendiri dan channel secara umum.** Server hanya mengirim profil, aktivitas, presensi, izin dan gaji milik karyawan itu; video buatan rekan dikirim tanpa pembuat (tampil “Tim”). Menu Ringkasan tim dan Karyawan (termasuk tabel hak akses) hanya untuk pemilik. Performa karyawan dibandingkan dengan video lain di channel, bukan dengan rekan. Di Belum dikenali, karyawan hanya bisa menandai video sebagai miliknya sendiri.
- **Pendapatan dalam rupiah**: YouTube Analytics diminta dalam IDR (kurs harian YouTube). Saat pertama kali sinkron setelah pembaruan ini, angka US$ yang sudah tersimpan dikonversi sekali dengan kurs hari itu (Frankfurter/ECB, cadangan open.er-api.com; tercatat di settings `pendapatan_rupiah`), lalu riwayat harian channel diambil ulang dalam rupiah.
- **Warna per bagian menu**: tiap kelompok menu punya warna aksen sendiri (oranye, biru, ungu) di menu samping, tab bawah dan ikon di judul halaman.
- **Ikon aplikasi** dari logo Tokder: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (Android), `apple-touch-icon.png` (iPhone), `icon-32.png` (tab browser).

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

Nilai: **A** ≥ 85, **B** ≥ 70, **C** ≥ 55, **D** di bawahnya. Aturan ini bisa diubah di `app/src/core/rules.js` (`TOL`, `TUGAS`).

## Ide konten

Topik ditebak dari kata di judul, misalnya "harga", "thrips", "pupuk" atau "semai". Daftar katanya ada di `TOPIK` dalam `app/src/core/rules.js`. Setiap topik dibandingkan dengan median views channel-nya:

- 1,2× ke atas: **perbanyak**
- di bawah 0,8×: **kurangi**
- kurang dari 2 video: **uji lagi**

## Keamanan

- Semua data hanya bisa dilihat setelah masuk. Karyawan hanya melihat aktivitas dan presensinya sendiri.
- Sesi login memakai token acak di cookie HttpOnly. Password dan PIN tidak pernah disimpan di cookie atau di browser. Keluar, ganti password, ganti PIN atau menonaktifkan karyawan langsung mencabut sesinya.
- Password pemilik dan PIN disimpan dalam bentuk hash, bukan teks asli.
- Salah password atau PIN berulang kali (8 kali untuk pemilik, 6 kali per karyawan) memblokir percobaan selama 15 menit.
- Permintaan dari website lain ditolak (CORS dan pemeriksaan asal permintaan). Menyambungkan dan memutus YouTube Analytics hanya bisa dilakukan pemilik.
- Jika Environment Variable `CRON_SECRET` diisi, Vercel Cron bisa sinkron kapan saja. Tanpa itu, sinkron harian tetap jalan, tapi dibatasi paling cepat 15 menit sekali seperti permintaan lain.
- Kalau database tidak bisa dihubungi, aplikasi menampilkan error dan tidak pernah beralih ke data contoh.
- Token YouTube Analytics disimpan terenkripsi. Kuncinya tetap (dari `ENCRYPTION_KEY` bila diisi, kalau tidak dari `GOOGLE_CLIENT_SECRET`), jadi tidak hilang saat server Vercel mulai ulang. Kalau di Pengaturan → Catatan sinkronisasi muncul "kunci enkripsi berubah", hubungkan ulang channel itu sekali.
- `/api/scan/status` sekarang hanya menjawab "ada/tidak". Potongan kunci API tidak lagi ditampilkan.
- Pendapatan hanya dikirim server ke pemilik yang sudah masuk.
- Aturan keamanan browser (CSP) tidak lagi mengizinkan skrip inline sembarang: hanya skrip yang hash-nya tercatat di `vercel.json`. Setelah mengubah skrip di `app/index.html`, jalankan `npm run build && node scripts/cek-csp.cjs --tulis`. GitHub Actions **Tes** memeriksanya di setiap PR, bersama `npm test` dan build.
- Semua isian diperiksa di server: kode karyawan, jadwal, PIN, tanggal, jam, angka target. Pesan kesalahannya dalam bahasa Indonesia, dan kalau database tidak bisa dihubungi, aplikasi mengatakan itu dengan jelas.

## Kecepatan

- Semua data untuk semua menu dimuat dalam **satu** permintaan (`/api/bootstrap`) saat website dibuka. Pindah menu sesudahnya tidak menunggu internet (sekitar 10–30 milidetik).
- Server API berjalan di Singapura (`"regions": ["sin1"]` di `vercel.json`), dekat dengan pengguna dan database. Untuk memastikan setelah deploy: header `x-vercel-id` di jawaban `/api/...` harus mengandung `sin1::sin1`.
- File tampilan (JS/CSS) disimpan browser selama setahun; tiap rilis memakai nama file baru, jadi tidak pernah basi.
- Pembaruan struktur database hanya berjalan sekali per versi, bukan di setiap server mulai.

## Halaman hukum dan verifikasi TikTok/Meta

- `assets/privacy.html`, `assets/terms.html`, `assets/data-deletion.html` tampil tanpa login di `/privacy.html`, `/terms.html`, `/data-deletion.html` (Indonesia + English). Ini yang didaftarkan sebagai Privacy Policy URL, Terms of Service URL, dan Data Deletion URL di TikTok for Developers dan Meta for Developers. Tautannya juga ada di bawah menu samping.
- `assets/tiktok….txt` adalah berkas verifikasi kepemilikan URL dari TikTok; harus tetap bisa dibuka di `https://pantautokder.vercel.app/<nama-berkas>.txt`. Jangan dihapus atau diganti isinya.
- Bila fitur baru mengumpulkan data baru (mis. sambungan TikTok/Meta sungguhan), perbarui `privacy.html` bagian 1 dan 3.

## Sosmed: TikTok, Instagram, Facebook

- Menu **Sosmed** (khusus pemilik) menarik pengikut dan statistik posting 90 hari terakhir dari akun yang Anda hubungkan: views, suka, komentar, bagikan. Statistiknya hanya dibaca.
- Menghubungkan: klik **Hubungkan** pada platformnya → masuk di TikTok/Meta → setujui izin → kembali ke app. Sebelum itu kunci app harus diisi di Vercel dan app didaftarkan di portal pengembang. Langkahnya ada di `PENDAFTARAN_TIKTOK_META.md`.
- Data ditarik otomatis di setiap sinkronisasi jam-an. Tombol **Tarik data** menariknya sekarang. Token diperbarui otomatis; kalau izin kedaluwarsa, akun diberi tanda ! dan perlu dihubungkan ulang.
- **Putuskan** menghapus token dan semua posting akun itu dari Pantau Tokder. Menghapus aplikasi di pengaturan Instagram/Facebook juga menghapusnya otomatis lewat callback Meta.
- Pembuat posting dikenali dari kode karyawan di keterangan, seperti video YouTube. Posting sosmed belum dihitung ke skor harian dan gaji; itu masih hanya video YouTube.
- **Posting sekali upload** (Sosmed → kartu paling atas): isi judul dan deskripsi, pilih satu video, centang tujuan (TikTok, Instagram, Facebook, YouTube), klik **Unggah dan siapkan**. Semuanya masuk sebagai draf: Instagram dan Facebook tayang dengan tombol **Tayangkan**; TikTok diselesaikan di aplikasi TikTok; YouTube diunggah privat (antre sampai 1 jam) lalu dipublikasikan di YouTube Studio. Persiapan sekali jalan (Blob, CRON_SECRET, izin baru) ada di `PENDAFTARAN_TIKTOK_META.md` bagian F.
- Berkas video hanya disimpan sementara: dihapus otomatis 7 hari setelah diunggah, atau saat posting dihapus.
- Kode posting: `api/src/integrations/posting.js`, `api/src/services/postingService.js`, `api/src/routes/posting.js`, `scripts/youtube-unggah.cjs` dan `.github/workflows/posting-youtube.yml`. Tabel: `posting`, `posting_target`.
- Kode: `api/src/integrations/sosmed.js` (pemanggil API), `api/src/services/socialService.js` (simpan, segarkan token, sinkron), `api/src/routes/social.js` (OAuth, putuskan, callback Meta). Tabel: `social_koneksi`, `social_post`.

## Struktur file

```
app/index.html      kerangka halaman
app/styles/         gaya (warna di tokens.css, tata letak, komponen, mode gelap)
app/src/            tampilan: core/ (data, router, aturan skor), ui/ (dialog, grafik, menu), pages/ (satu berkas per halaman)
api/src/...         server: sinkronisasi YouTube, karyawan, aktivitas, presensi, izin & klaim, gaji, akses
api/src/services/gajiService.js       perhitungan gaji (fungsi murni hitung(), diuji di api/test/gaji.test.cjs)
api/src/services/pengajuanService.js  izin, sakit, cuti, klaim dan jatah cuti
api/src/routes/insight.js             ringkasan retensi dan kenaikan views untuk Performa dan Tren
api/src/services/pushService.js       notifikasi Web Push; pengingatService.js: pengingat absen
assets/sw.js, assets/manifest.webmanifest  service worker notifikasi dan pemasangan di layar utama
.github/workflows/sinkron.yml         sinkronisasi + pengingat + perawatan data tiap jam lewat GitHub Actions
.github/workflows/tes.yml             tes, build dan cek CSP di setiap pull request
api/src/services/perawatanService.js  perapian data lama, ringkasan mingguan, status sistem
api/src/services/kalenderService.js   jam kerja per hari, tanggal merah, cuti bersama, libur kantor
api/test/*.cjs      tes otomatis (jalankan: npm test)
```
