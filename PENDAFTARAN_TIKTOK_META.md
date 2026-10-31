# Pendaftaran TikTok & Meta untuk Pantau Tokder

Kode integrasinya sudah ada (menu **Sosmed**). Yang tersisa adalah mendaftarkan app di portal masing-masing dan mengisi kunci di Vercel. Ikuti urutan ini.

Alamat dasar di bawah memakai `https://pantautokder.vercel.app`. Kalau nanti pindah ke domain sendiri, ganti semua alamat, isi variabel `PUBLIC_URL` di Vercel dengan domain baru, dan daftarkan ulang berkas verifikasi TikTok.

## Alamat yang sama di semua portal

| Isian | Nilai |
|---|---|
| Redirect URI (OAuth) | `https://pantautokder.vercel.app/api/social/callback` |
| Privacy Policy URL | `https://pantautokder.vercel.app/privacy.html` |
| Terms of Service URL | `https://pantautokder.vercel.app/terms.html` |
| Data Deletion Instructions URL | `https://pantautokder.vercel.app/data-deletion.html` |
| Data Deletion Request Callback URL (Meta) | `https://pantautokder.vercel.app/api/social/meta/data-deletion` |
| Deauthorize Callback URL (Meta) | `https://pantautokder.vercel.app/api/social/meta/deauthorize` |
| Ikon | `tokderlogo_1024x1024.png` (1024×1024) |
| Email kontak | `tokodeeres@gmail.com` |

## A. TikTok (developers.tiktok.com)

1. Daftar/login → **Manage apps → Connect an app**. Tipe: organisasi atau perorangan sesuai kenyataan.
2. Isi nama (jangan memuat kata "TikTok"), ikon, kategori *Business/Productivity*, deskripsi (di bawah), URL Privacy dan Terms.
3. **Add products**: *Login Kit* dan *Display API*. Jangan tambah Content Posting API.
4. **Login Kit → Redirect URI**: alamat di tabel. Platform: *Web*, URL situs `https://pantautokder.vercel.app`.
5. **Scopes** (hanya tiga): `user.info.basic`, `user.info.stats`, `video.list`.
6. **URL properties → URL prefix** `https://pantautokder.vercel.app/`, verifikasi memakai berkas `tiktokjd9X….txt` yang sudah ada di situs. Buka URL berkasnya di browser dulu, baru klik Verify.
7. Di mode **Sandbox**: tambahkan akun TikTok channel Anda sebagai *target user*, lalu uji Hubungkan di menu Sosmed.
8. Salin **Client key** dan **Client secret** ke Vercel: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`. Deploy ulang.
9. Rekam demo video (lihat bagian D), lalu **Submit for review** dengan penjelasan per scope.

Deskripsi app (Inggris, siap tempel):
> Pantau Tokder is an internal dashboard for the Tokder chili-farming video team. The account owner connects the team's own TikTok account with Login Kit to read, in read-only mode, the profile name, follower count and the list of the account's own videos with view, like, comment and share counts. These numbers are shown next to the team's YouTube, Instagram and Facebook numbers so the owner can track each editor's output and the channel's growth. The app never posts, edits or deletes content and never reads other users' data.

Penjelasan per scope (kolom review):
- `user.info.basic`: show the connected account's name and avatar so the owner knows which account is connected.
- `user.info.stats`: show follower and like totals in the growth overview.
- `video.list`: list the account's own videos with view/like/comment/share counts for the performance table.

## B. Instagram (developers.facebook.com)

1. **Create app** → tipe *Business* (atau *Other → Business*). Tambahkan produk **Instagram → API setup with Instagram login**.
2. **App settings → Basic**: ikon, Privacy Policy URL, Terms of Service URL, kategori, **App Domains** `pantautokder.vercel.app`, **User data deletion**: pilih *Data deletion request URL* = alamat callback di tabel (atau *Instruction URL* = `data-deletion.html`).
3. Instagram → **Business login settings**: Redirect URL = alamat di tabel; Deauthorize dan Data deletion callback = alamat di tabel.
4. **App roles**: tambahkan akun Facebook Anda sebagai Admin, dan untuk tiap akun Instagram channel: **Instagram Testers** (Roles → Instagram Testers), lalu terima undangannya di Instagram (Setelan → Apps and websites → Tester invites).
5. Akun Instagram channel harus **Professional** (Business atau Creator).
6. Salin **Instagram app ID** dan **Instagram app secret** (bukan App ID utama) ke Vercel: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`.
7. Tetap di **Development mode**: cukup untuk akun milik Anda dan tidak butuh App Review. Review dan Business Verification baru perlu bila akun lain di luar tim ikut tersambung.

## C. Facebook Pages (app Meta yang sama atau terpisah)

1. Tambahkan produk **Facebook Login for Business** (atau Facebook Login). Valid OAuth Redirect URI = alamat di tabel.
2. Izin yang dipakai: `pages_show_list`, `pages_read_engagement`, `read_insights`. Di Development mode izin ini bekerja untuk Admin/Developer/Tester app.
3. Akun Facebook yang dipakai Hubungkan harus mengelola Page tersebut (peran Page admin).
4. Salin **App ID** dan **App secret** utama ke Vercel: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`. `FACEBOOK_APP_SECRET` juga memverifikasi callback penghapusan data dari Meta.

## Variabel di Vercel

`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`. Opsional: `PUBLIC_URL` (domain sendiri) dan `META_GRAPH_VERSION` (bawaan `v23.0`). Deploy ulang setelah menambah variabel.

## D. Demo video untuk review (3–4 menit, Inggris, 1080p)

1. Tampilkan alamat `pantautokder.vercel.app` di bilah browser. Masuk sebagai pemilik.
2. Buka menu **Sosmed**, klik **Hubungkan** pada platform yang direview.
3. Tampilkan layar izin TikTok/Meta secara utuh dengan daftar izinnya (jangan di-skip), setujui.
4. Kembali ke app: tunjukkan nama akun, pengikut, tabel posting dengan views/suka/komentar. Sebut tiap scope dan di layar mana datanya dipakai.
5. Klik **Putuskan** dan tunjukkan datanya hilang. Lalu buka `/privacy.html` dan `/data-deletion.html`.
6. Beri teks atau narasi: "Read-only. The app never posts or modifies content."

## E. Daftar periksa sebelum submit

- [ ] Menu Sosmed menampilkan data asli dari akun Anda sendiri di Sandbox/Development.
- [ ] Hanya scope di atas yang diminta; deskripsi, kebijakan privasi, dan video konsisten.
- [ ] URL privacy, terms, deletion, dan berkas `.txt` TikTok terbuka tanpa login (cek di jendela penyamaran).
- [ ] Callback Meta merespons: kirim `signed_request` palsu harus mendapat HTTP 400 (bukan 404/500).
- [ ] Token tersimpan terenkripsi; tombol Putuskan menghapus akun dan posting-nya.
