# Pendaftaran TikTok & Meta untuk Pantau Tokder

Kode integrasinya sudah ada (menu **Sosmed**). Yang tersisa adalah mendaftarkan app di portal masing-masing dan mengisi kunci di Vercel. Ikuti urutan ini.

Alamat dasar di bawah memakai `https://tokder.vercel.app`. Kalau nanti pindah ke domain sendiri, ganti semua alamat, isi variabel `PUBLIC_URL` di Vercel dengan domain baru, dan daftarkan ulang berkas verifikasi TikTok.

## Alamat yang sama di semua portal

| Isian | Nilai |
|---|---|
| Redirect URI (OAuth) | `https://tokder.vercel.app/api/social/callback` |
| Privacy Policy URL | `https://tokder.vercel.app/privacy.html` |
| Terms of Service URL | `https://tokder.vercel.app/terms.html` |
| Data Deletion Instructions URL | `https://tokder.vercel.app/data-deletion.html` |
| Data Deletion Request Callback URL (Meta) | `https://tokder.vercel.app/api/social/meta/data-deletion` |
| Deauthorize Callback URL (Meta) | `https://tokder.vercel.app/api/social/meta/deauthorize` |
| Ikon | `docs/ikon-app/ikon-app-1024x1024.png` (1024×1024, sudah disiapkan di repo) |
| URL situs / Web URL | `https://tokder.vercel.app` (halaman depan publik menjelaskan app dan menaut ke Privacy, Terms, Hapus data) |
| Email kontak | `tokodeeres@gmail.com` |

## A. TikTok (developers.tiktok.com)

1. Daftar/login → **Manage apps → Connect an app**. Tipe: organisasi atau perorangan sesuai kenyataan.
2. Isi nama (jangan memuat kata "TikTok"), ikon, kategori *Business/Productivity*, deskripsi (di bawah), URL Privacy dan Terms.
3. **Add products**: *Login Kit*, *Display API*, dan *Content Posting API* (hanya mode upload ke inbox/draf; jangan minta direct post).
4. **Login Kit → Redirect URI**: alamat di tabel. Platform: *Web*, URL situs `https://tokder.vercel.app`.
5. **Scopes** (empat, persis seperti di kode): `user.info.basic`, `user.info.stats`, `video.list`, `video.upload`. Jangan minta `video.publish`: itu butuh audit TikTok.
6. **URL properties → URL prefix** `https://tokder.vercel.app/`, verifikasi memakai berkas `tiktokjd9X….txt` yang sudah ada di situs. Buka URL berkasnya di browser dulu, baru klik Verify.
7. Di mode **Sandbox**: tambahkan akun TikTok channel Anda sebagai *target user*, lalu uji Hubungkan di menu Sosmed.
8. Salin **Client key** dan **Client secret** ke Vercel: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`. Deploy ulang.
9. Rekam demo video (lihat bagian D), lalu **Submit for review** dengan penjelasan per scope.

Deskripsi app (Inggris, siap tempel):
> Pantau Tokder is an internal dashboard for the Tokder chili-farming video team. The account owner connects the team's own TikTok account with Login Kit to read the profile name, follower count and the list of the account's own videos with view, like, comment and share counts, and to send a video the owner uploads to that account as a draft in the TikTok app (Content Posting API, upload mode). These numbers are shown next to the team's YouTube, Instagram and Facebook numbers so the owner can track each editor's output and the channel's growth. Nothing is ever published without the owner's own action in the TikTok app; the app never edits or deletes existing content and never reads other users' data.

Penjelasan per scope (kolom review):
- `user.info.basic`: show the connected account's name and avatar so the owner knows which account is connected.
- `user.info.stats`: show follower and like totals in the growth overview.
- `video.list`: list the account's own videos with view/like/comment/share counts for the performance table.
- `video.upload`: send a video the owner uploads in the dashboard to the owner's TikTok inbox as a draft, which the owner finishes and posts in the TikTok app.

## B. Instagram (developers.facebook.com)

1. **Create app** → tipe *Business* (atau *Other → Business*). Tambahkan produk **Instagram → API setup with Instagram login**.
2. **App settings → Basic**: ikon, Privacy Policy URL, Terms of Service URL, kategori, **App Domains** `tokder.vercel.app`, **User data deletion**: pilih *Data deletion request URL* = alamat callback di tabel (atau *Instruction URL* = `data-deletion.html`).
3. Instagram → **Business login settings**: Redirect URL = alamat di tabel; Deauthorize dan Data deletion callback = alamat di tabel.
4. Izin yang diminta kode untuk Instagram: `instagram_business_basic`, `instagram_business_manage_insights`, `instagram_business_content_publish`. Pastikan ketiganya aktif di *API setup with Instagram login*.
5. **App roles**: tambahkan akun Facebook Anda sebagai Admin, dan untuk tiap akun Instagram channel: **Instagram Testers** (Roles → Instagram Testers), lalu terima undangannya di Instagram (Setelan → Apps and websites → Tester invites).
6. Akun Instagram channel harus **Professional** (Business atau Creator).
7. Salin **Instagram app ID** dan **Instagram app secret** (bukan App ID utama) ke Vercel: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`.
8. Tetap di **Development mode**: cukup untuk akun milik Anda dan tidak butuh App Review. Review dan Business Verification baru perlu bila akun lain di luar tim ikut tersambung.

## C. Facebook Pages (app Meta yang sama atau terpisah)

1. Tambahkan produk **Facebook Login for Business** (atau Facebook Login). Valid OAuth Redirect URI = alamat di tabel.
2. Izin yang dipakai (sama dengan kode): `pages_show_list`, `pages_read_engagement`, `read_insights`, `pages_manage_posts`. Di Development mode izin ini bekerja untuk Admin/Developer/Tester app.
3. Akun Facebook yang dipakai Hubungkan harus mengelola Page tersebut (peran Page admin).
4. Salin **App ID** dan **App secret** utama ke Vercel: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`. `FACEBOOK_APP_SECRET` juga memverifikasi callback penghapusan data dari Meta.

## Variabel di Vercel

`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`. Opsional: `PUBLIC_URL` (domain sendiri) dan `META_GRAPH_VERSION` (bawaan `v23.0`). Deploy ulang setelah menambah variabel.

## D. Demo video untuk review (3–4 menit, Inggris, 1080p)

1. Tampilkan alamat `tokder.vercel.app` di bilah browser. Masuk sebagai pemilik.
2. Buka menu **Sosmed**, klik **Hubungkan** pada platform yang direview.
3. Tampilkan layar izin TikTok/Meta secara utuh dengan daftar izinnya (jangan di-skip), setujui.
4. Kembali ke app: tunjukkan nama akun, pengikut, tabel posting dengan views/suka/komentar. Sebut tiap scope dan di layar mana datanya dipakai.
5. Klik **Putuskan** dan tunjukkan datanya hilang. Lalu buka `/privacy.html` dan `/data-deletion.html`.
6. Beri teks atau narasi: "Reads statistics. Posting only sends the owner's own video as a draft, on the owner's command."

## E. Daftar periksa sebelum submit

- [ ] Menu Sosmed menampilkan data asli dari akun Anda sendiri di Sandbox/Development.
- [ ] Hanya scope di atas yang diminta; deskripsi, kebijakan privasi, dan video konsisten.
- [ ] URL privacy, terms, deletion, dan berkas `.txt` TikTok terbuka tanpa login (cek di jendela penyamaran).
- [ ] Callback Meta merespons: kirim `signed_request` palsu harus mendapat HTTP 400 (bukan 404/500).
- [ ] Token tersimpan terenkripsi; tombol Putuskan menghapus akun dan posting-nya.

## F. Fitur Posting sekali upload (menu Sosmed → Posting sekali upload)

Satu video diunggah di Pantau Tokder, lalu disiapkan di semua akun yang dicentang. **Semuanya masuk sebagai draf**; tidak ada yang tayang sendiri.

| Platform | Yang terjadi | Cara tayang |
|---|---|---|
| TikTok | Video masuk ke kotak draf di aplikasi TikTok | Buka aplikasi TikTok, tulis keterangan, tekan Posting |
| Instagram | Reels disiapkan (berlaku 24 jam) | Tombol **Tayangkan** di Pantau Tokder |
| Facebook | Video Page dibuat tidak dipublikasikan | Tombol **Tayangkan** di Pantau Tokder |
| YouTube | Diunggah **privat** oleh GitHub Actions (maks 1 jam antre) | Ubah ke publik di YouTube Studio |

### Yang harus disiapkan sekali
1. **Vercel Blob:** Vercel → Storage → Create → **Blob** → sambungkan ke proyek Pantau Tokder. Variabel `BLOB_READ_WRITE_TOKEN` terisi otomatis. Deploy ulang.
2. **YouTube:** isi `CRON_SECRET` di Vercel (nilai acak panjang), dan secret GitHub dengan nama dan nilai yang sama (repo → Settings → Secrets and variables → Actions → `CRON_SECRET`). Workflow `Unggah YouTube dari Posting` berjalan tiap jam, atau jalankan manual dari tab Actions.
3. **Izin baru:** akun yang sudah tersambung sebelum fitur ini tidak punya izin unggah. Klik **Tambah akun** pada platformnya (akun yang sama, tidak membuat dobel). Untuk YouTube, hubungkan ulang channel di Pengaturan, lalu pilih channel yang sama.
4. **Izin di portal:** tambahkan scope unggah di bagian A–C di atas. Di Development mode Meta dan Sandbox TikTok, posting ke akun milik tim sendiri bisa dicoba tanpa review; untuk produksi TikTok, scope `video.upload` ikut direview.

### Batas yang perlu diketahui
- Video: MP4, MOV, atau WebM, maksimal 2 GB. Untuk Reels dan TikTok, pakai MP4 (H.264 + AAC) vertikal 9:16.
- TikTok mengambil video dari alamat kita sendiri (`/api/posting/media/…`, bertanda tangan, hanya untuk video itu) karena TikTok hanya menerima alamat dari domain yang sudah diverifikasi. Berkas verifikasi yang sudah ada di situs mencakup ini.
- Instagram dan Facebook mengambil video dari alamat Vercel Blob. Berkas video dihapus otomatis 7 hari setelah diunggah.
- Judul dan deskripsi dikirim ke Instagram, Facebook, dan YouTube. TikTok tidak menerima keterangan lewat mode draf, jadi keterangan ditulis di aplikasinya.
- Demo video untuk review perlu menunjukkan alur Posting: pilih video, centang akun, lihat status Siap/Draf, lalu Tayangkan.
