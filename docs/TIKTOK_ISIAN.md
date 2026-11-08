# Isian TikTok for Developers (siap tempel)

App: **PantauTokder** → tab *App details*. Semua teks di bawah dalam bahasa Inggris karena dibaca reviewer TikTok.
Hitungan karakter sudah dicek terhadap batas formulir.

## Basic information
| Kolom | Isi |
|---|---|
| App icon | `docs/ikon-app/ikon-app-1024x1024.png` (1024×1024, PNG) |
| App name | PantauTokder (sudah terisi) |
| Category | Business (sudah terisi) |
| Description (maks 120, sekarang 103) | `Internal dashboard for the Tokder team to track its own TikTok stats and send its own videos as drafts.` |
| Terms of Service URL | `https://pantautokder.vercel.app/terms.html` |
| Privacy Policy URL | `https://pantautokder.vercel.app/privacy.html` |
| Platforms | centang **Web** saja |
| Web/Desktop URL | `https://pantautokder.vercel.app` |

## Products dan Scopes
Tambahkan **hanya**: Login Kit, Display API, Content Posting API. Jangan tambah Share Kit, Research API, dan lainnya; produk atau scope yang tidak didemokan memperlambat review.
- Login Kit → Redirect URI: `https://pantautokder.vercel.app/api/social/callback`
- Scopes: `user.info.basic`, `user.info.stats`, `video.list`, `video.upload`
- Content Posting API: aktifkan hanya upload ke inbox/draf. Jangan minta Direct Post / `video.publish`.

## App review: kolom penjelasan (maks 1000, sekarang 932)
```
Pantau Tokder is a private dashboard used only by the Tokder chili-farming video team. The owner signs in at https://pantautokder.vercel.app, opens Sosmed and clicks Connect to link the team's own TikTok account.
Login Kit: the owner authorizes the team's own account; no one else can sign in with TikTok.
user.info.basic: shows the connected account's name and avatar so the owner knows which account is linked.
user.info.stats: shows follower and like totals in the growth overview.
video.list: lists the account's own videos with view, like, comment and share counts (Display API).
video.upload: the owner uploads a video in the dashboard and sends it to their TikTok inbox as a draft (Content Posting API, upload mode). The owner writes the caption and taps Post in the TikTok app. Nothing is published automatically.
The app never reads other users' data or edits/deletes content. Disconnect deletes the stored tokens and data.
```

## URL properties
URL prefix `https://pantautokder.vercel.app/` → verifikasi memakai berkas `tiktokjd9XqluD7dqKG7b7fH4hjbKxkho4xpnU.txt` (sudah tayang).

## Demo video
Format mp4/mov, maksimal 5 berkas @ 50 MB. Wajib memakai **Sandbox** (app belum pernah disetujui) dan domain di bilah browser harus `pantautokder.vercel.app`.
Rekam layar Mac: `Cmd+Shift+5` → Record Entire Screen (atau QuickTime → File → New Screen Recording). Mulai dari bilah alamat yang terlihat. Jika berkas >50 MB, kecilkan di QuickTime (File → Export As → 1080p) atau potong per bagian.

Urutan adegan (3–4 menit, beri teks atau suara berbahasa Inggris):
1. Tunjukkan bilah alamat `pantautokder.vercel.app`, halaman depan, lalu klik tautan Privacy dan Terms.
2. Masuk sebagai pemilik → menu **Sosmed** → klik **Hubungkan** di TikTok.
3. Layar izin TikTok: tampilkan **utuh** dengan keempat izin, jangan dilewati, lalu Authorize.
4. Kembali ke app: tunjukkan nama akun dan avatar (`user.info.basic`), pengikut dan suka (`user.info.stats`), tabel video dengan views/suka/komentar/bagikan (`video.list`). Sebutkan scope tiap kali datanya muncul.
5. **Posting sekali upload**: pilih video MP4, centang TikTok, kirim; tunjukkan status Draf. Buka aplikasi TikTok di HP (rekam layar HP, tempel di video) dan tunjukkan draf masuk di inbox, tulis keterangan, tekan Post → `video.upload`.
6. Klik **Putuskan** dan tunjukkan datanya hilang. Tutup dengan `/data-deletion.html`.
