# Rencana pengembangan — Reel Watch (Sistem Monitoring Performa Editor)

Dokumen ini adalah panduan eksekusi lengkap untuk membangun backend dan menghubungkannya ke frontend yang sudah ada. Ditulis supaya bisa dieksekusi bertahap, baik sendiri maupun dibantu AI coding assistant (Claude Code, Cursor, dll).

---

## 1. Ringkasan sistem

**Tujuan:** memantau performa konten (views, likes, comments) yang diupload editor ke YouTube, Instagram, dan Facebook dari satu akun/page milik perusahaan, lalu mengaitkan tiap konten ke editor yang mengerjakannya.

**Cara identifikasi editor:** setiap editor punya kode unik (mis. `ED-RN`) yang wajib dicantumkan di caption/deskripsi. Sistem scan otomatis membaca caption dan mencocokkan kode tersebut.

**Stack yang dipakai:**
- Backend: Node.js + Express
- Database: PostgreSQL (disarankan lewat Supabase untuk kemudahan hosting + akses data mentah)
- Cron job: node-cron (jalan di proses backend yang sama)
- Frontend: HTML/CSS/JS statis yang sudah dibuat (tidak perlu diubah strukturnya, hanya diarahkan ke API)
- Hosting: Railway atau Render untuk backend, Vercel/Netlify/static hosting untuk frontend

---

## 2. Struktur project

```
reel-watch-backend/
├── src/
│   ├── config/
│   │   └── db.js                 # koneksi PostgreSQL (pool)
│   ├── integrations/
│   │   ├── youtube.js            # fetch data dari YouTube Data API v3
│   │   ├── instagram.js          # fetch data dari Instagram Graph API
│   │   └── facebook.js           # fetch data dari Facebook Graph API
│   ├── services/
│   │   ├── scanService.js        # logika scan + cocokkan kode editor di caption
│   │   ├── metricsService.js     # simpan snapshot metrics
│   │   └── editorService.js      # CRUD editor
│   ├── routes/
│   │   ├── editors.js
│   │   ├── content.js
│   │   ├── metrics.js
│   │   └── scan.js
│   ├── jobs/
│   │   └── cronScan.js           # penjadwalan scan otomatis (node-cron)
│   ├── middleware/
│   │   └── errorHandler.js
│   └── app.js                    # setup express, routing
├── migrations/
│   └── 001_init.sql              # skema database awal
├── .env.example
├── package.json
└── server.js                     # entry point
```

---

## 3. Skema database (PostgreSQL)

Simpan sebagai `migrations/001_init.sql`, jalankan sekali di awal.

```sql
CREATE TABLE editors (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  kode_identifikasi VARCHAR(20) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'aktif',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE content (
  id SERIAL PRIMARY KEY,
  editor_id INTEGER REFERENCES editors(id) ON DELETE SET NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('youtube','instagram','facebook')),
  post_id VARCHAR(100) NOT NULL,
  url TEXT,
  judul TEXT,
  caption_raw TEXT,
  tanggal_upload TIMESTAMP,
  status_identifikasi VARCHAR(20) DEFAULT 'unmatched' CHECK (status_identifikasi IN ('matched','unmatched')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(platform, post_id)
);

CREATE TABLE metrics_snapshot (
  id SERIAL PRIMARY KEY,
  content_id INTEGER REFERENCES content(id) ON DELETE CASCADE,
  "timestamp" TIMESTAMP DEFAULT NOW(),
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0
);

CREATE TABLE scan_log (
  id SERIAL PRIMARY KEY,
  waktu_scan TIMESTAMP DEFAULT NOW(),
  platform VARCHAR(20),
  jumlah_post_baru INTEGER DEFAULT 0,
  jumlah_unmatched INTEGER DEFAULT 0
);

CREATE INDEX idx_content_editor ON content(editor_id);
CREATE INDEX idx_metrics_content ON metrics_snapshot(content_id);
```

---

## 4. Setup akun & API eksternal (lakukan sebelum coding)

### YouTube Data API v3
1. Buka [Google Cloud Console](https://console.cloud.google.com) → buat project baru
2. Aktifkan **YouTube Data API v3** di API Library
3. Buat **API Key** di Credentials
4. Simpan sebagai `YOUTUBE_API_KEY` di `.env`

### Facebook & Instagram Graph API
1. Pastikan akun Instagram perusahaan sudah **Business/Creator** dan terhubung ke **Facebook Page**
2. Buka [Meta for Developers](https://developers.facebook.com) → buat App tipe Business
3. Tambahkan produk **Instagram Graph API**
4. Generate **Page Access Token** via Graph API Explorer dengan permission: `pages_read_engagement`, `instagram_basic`, `instagram_manage_insights`
5. Tukar token jangka pendek jadi **long-lived token** (60 hari)
6. Simpan sebagai `FB_PAGE_ACCESS_TOKEN`, `FB_PAGE_ID`, `IG_BUSINESS_ACCOUNT_ID` di `.env`

### Database
1. Buat project di [Supabase](https://supabase.com) (atau instance PostgreSQL sendiri)
2. Jalankan `migrations/001_init.sql` lewat SQL editor Supabase
3. Simpan connection string sebagai `DATABASE_URL` di `.env`

### `.env.example`
```
DATABASE_URL=postgresql://user:password@host:5432/reelwatch
YOUTUBE_API_KEY=
YOUTUBE_CHANNEL_ID=
FB_PAGE_ACCESS_TOKEN=
FB_PAGE_ID=
IG_BUSINESS_ACCOUNT_ID=
PORT=3000
SCAN_INTERVAL_HOURS=6
```

---

## 5. Endpoint API yang perlu dibangun

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/editors` | daftar semua editor + ringkasan performa |
| POST | `/api/editors` | tambah editor baru (nama, kode identifikasi) |
| PUT | `/api/editors/:id` | update nama/kode editor |
| DELETE | `/api/editors/:id` | hapus editor (konten terkait jadi `editor_id = null`) |
| GET | `/api/content` | daftar konten, support query filter `?editor_id=&platform=&status=` |
| GET | `/api/content/:id` | detail satu konten + histori metrics |
| POST | `/api/content/:id/assign` | tandai manual editor untuk konten unmatched (body: `editor_id`) |
| GET | `/api/metrics/summary` | ringkasan total views/likes/comments, support filter tanggal |
| GET | `/api/metrics/trend` | data tren mingguan untuk grafik |
| POST | `/api/scan` | trigger scan manual (dipanggil tombol "Sinkronkan sekarang") |
| GET | `/api/scan/logs` | histori proses scan (untuk debugging) |

---

## 6. Logika inti: proses scan otomatis

Alur di `scanService.js`, dijalankan oleh cron job maupun endpoint `/api/scan`:

1. **Ambil data terbaru per platform**
   - YouTube: `GET /youtube/v3/search` (channel milik sendiri) → dapat list video baru → `GET /youtube/v3/videos?part=snippet,statistics` untuk detail + statistik
   - Instagram: `GET /{ig-business-id}/media` → list post terbaru → `GET /{media-id}?fields=caption,like_count,comments_count` per post, lalu `GET /{media-id}/insights?metric=impressions,reach` untuk views
   - Facebook: `GET /{page-id}/posts` → list post terbaru → `GET /{post-id}/insights?metric=post_impressions,post_engaged_users`

2. **Untuk tiap post/video baru (belum ada di tabel `content`)**
   - Insert ke `content` dengan `post_id`, `url`, `judul`, `caption_raw`, `tanggal_upload`
   - Cocokkan `caption_raw` terhadap daftar `kode_identifikasi` semua editor (regex sederhana, case-insensitive)
   - Kalau cocok → set `editor_id` dan `status_identifikasi = 'matched'`
   - Kalau tidak cocok → biarkan `editor_id = null`, `status_identifikasi = 'unmatched'`

3. **Untuk semua post yang sudah ada di database (baru maupun lama)**
   - Ambil statistik terbaru (views, likes, comments)
   - Insert baris baru ke `metrics_snapshot` (bukan update — supaya histori tren tersimpan)

4. **Catat hasil scan**
   - Insert ke `scan_log`: jumlah post baru, jumlah unmatched

Contoh regex pencocokan kode (di Node.js):
```js
function matchEditorCode(captionText, editors) {
  if (!captionText) return null;
  const found = editors.find(e =>
    captionText.toUpperCase().includes(e.kode_identifikasi.toUpperCase())
  );
  return found ? found.id : null;
}
```

---

## 7. Cron job

Di `jobs/cronScan.js`, jalankan otomatis sesuai `SCAN_INTERVAL_HOURS`:

```js
const cron = require('node-cron');
const { runFullScan } = require('../services/scanService');

// contoh: tiap 6 jam
cron.schedule('0 */6 * * *', async () => {
  console.log('Menjalankan scan terjadwal...');
  await runFullScan();
});
```

---

## 8. Menghubungkan ke frontend yang sudah ada

Di file `dashboard-monitoring-editor-full.html`, ganti bagian data dummy di `<script>`:

```js
// SEBELUM (dummy):
let editors = [ { id: 1, nama: "Rina", kode: "ED-RN" }, ... ];
let content = [ ... ];

// SESUDAH (dari API):
let editors = [];
let content = [];

async function loadData() {
  const [editorsRes, contentRes] = await Promise.all([
    fetch('https://api-domain-kamu.com/api/editors').then(r => r.json()),
    fetch('https://api-domain-kamu.com/api/content').then(r => r.json()),
  ]);
  editors = editorsRes;
  content = contentRes;
  renderAll();
}
loadData(); // ganti renderAll() yang dipanggil langsung di akhir file
```

Tombol "Sinkronkan sekarang" tinggal diarahkan ke:
```js
document.getElementById("refreshBtn").addEventListener("click", async () => {
  showToast("Memulai sinkronisasi...");
  await fetch('https://api-domain-kamu.com/api/scan', { method: 'POST' });
  await loadData();
  showToast("Sinkronisasi selesai");
});
```

Aksi tambah editor, hapus editor, dan assign editor unmatched juga tinggal diarahkan ke endpoint yang sesuai di bagian 5, menggantikan manipulasi array lokal.

---

## 9. Urutan eksekusi (milestone)

Kerjakan berurutan, tiap tahap bisa dites sebelum lanjut:

1. **Setup project kosong** — `npm init`, install `express`, `pg`, `dotenv`, `node-cron`, `axios`
2. **Setup database** — jalankan migration, tes koneksi dari `db.js`
3. **CRUD editor** — bangun `editorService.js` + route `/api/editors`, tes pakai Postman/curl
4. **Integrasi YouTube dulu** — paling gampang, tidak perlu App Review. Pastikan bisa fetch statistik video nyata
5. **Simpan ke database** — sambungkan hasil fetch YouTube ke `content` + `metrics_snapshot`
6. **Logika pencocokan kode editor** — tes dengan caption dummy dan asli
7. **Integrasi Instagram & Facebook** — setelah YouTube terbukti jalan, tambahkan dua platform ini
8. **Endpoint scan manual + cron job**
9. **Endpoint summary & trend** untuk chart dashboard
10. **Sambungkan frontend** — ganti data dummy dengan `fetch()` ke API
11. **Deploy** — backend ke Railway/Render, set environment variables, cron tetap jalan di server (bukan serverless function, karena butuh proses yang hidup terus)

---

## 10. Hal yang perlu diantisipasi

### 10.1 Data & perilaku platform
- **Instagram Reels/Stories**: caption kadang tidak selalu lengkap ke-fetch tergantung tipe post — tes langsung dengan akun asli sebelum asumsi semua tipe post seragam. Stories hilang setelah 24 jam, jadi kalau editor upload Stories, insight-nya harus ditarik cepat sebelum kedaluwarsa di sisi Meta.
- **Rate limit API**: YouTube API v3 punya kuota harian (10.000 unit/hari secara default) — cukup untuk skala 10-30 konten/minggu, tapi hindari scan terlalu sering (per jam) tanpa alasan kuat. Meta Graph API juga punya rate limit per app per jam — kalau scan gagal karena limit, retry dengan backoff, jangan langsung retry berkali-kali beruntun.
- **Konten yang dihapus dari platform**: pertimbangkan penanganan kalau video/post dihapus tapi masih ada di database (tandai status `deleted` alih-alih hapus baris, supaya histori metrics tidak hilang).
- **Duplikasi saat scan ulang**: constraint `UNIQUE(platform, post_id)` di skema sudah mencegah insert konten ganda — pastikan logic insert pakai `ON CONFLICT DO NOTHING` atau cek dulu sebelum insert.
- **Insight yang delay**: metrik Instagram/Facebook Insights kadang butuh beberapa jam untuk muncul setelah post baru diupload — jangan anggap angka 0 di scan pertama sebagai final, itu wajar untuk konten yang baru saja naik.

### 10.2 Keamanan kredensial & akses
- **Jangan pernah commit `.env` ke git.** Tambahkan `.env` ke `.gitignore` sejak commit pertama. Kalau token/API key pernah ter-commit, anggap sudah bocor — segera revoke dan generate ulang, jangan cuma dihapus dari commit berikutnya (riwayat git tetap menyimpannya).
- **Simpan semua token di environment variables**, bukan hardcode di kode. Untuk deployment, gunakan fitur "Environment Variables" bawaan Railway/Render — jangan taruh nilai token di file yang ikut ter-deploy.
- **Batasi API Key YouTube** di Google Cloud Console: set "Application restrictions" (HTTP referrer atau IP) dan "API restrictions" (hanya izinkan YouTube Data API v3), supaya kalau key bocor, dampaknya terbatas.
- **Prinsip akses minimal (least privilege)** untuk Meta Access Token: minta permission sesuai kebutuhan saja (`pages_read_engagement`, `instagram_basic`, `instagram_manage_insights`) — jangan minta permission publish/write kalau backend cuma perlu baca data.
- **Rotasi token terjadwal**: long-lived token Meta bertahan 60 hari — buat reminder kalender atau (lebih baik) job otomatis yang refresh token sebelum expired, dan kirim notifikasi kalau refresh gagal.
- **Jangan expose endpoint scan tanpa autentikasi.** `/api/scan` yang bisa dipicu manual sebaiknya dilindungi API key sederhana atau token admin, supaya orang luar tidak bisa memicu scan berulang-ulang dan menghabiskan kuota API kamu.

### 10.3 Keamanan aplikasi & data
- **Autentikasi untuk dashboard**: saat ini frontend belum ada login — sebelum dipakai serius, tambahkan minimal satu lapis autentikasi (misal login sederhana dengan email/password, atau API key di header) supaya tidak sembarang orang yang tahu URL bisa melihat data performa editor.
- **CORS**: batasi `Access-Control-Allow-Origin` di Express hanya ke domain frontend kamu, jangan `*`, supaya API tidak bisa dipanggil sembarang website lain.
- **Validasi input**: semua endpoint yang menerima body (`POST /api/editors`, `POST /api/content/:id/assign`, dst) harus divalidasi — cek tipe data, panjang string, dan `editor_id` yang valid sebelum masuk ke query database.
- **SQL Injection**: selalu gunakan parameterized query (`pg` library sudah mendukung ini secara native lewat `$1, $2, ...`), jangan pernah gabungkan input user langsung ke string SQL.
- **Rate limiting endpoint publik**: pasang middleware seperti `express-rate-limit` supaya endpoint tidak bisa dibanjiri request bertubi-tubi (baik dari luar maupun bug di frontend sendiri).
- **HTTPS wajib** untuk backend production — Railway/Render biasanya sudah otomatis menyediakan ini, tapi pastikan frontend juga selalu memanggil URL `https://`, bukan `http://`.
- **Backup database berkala**: kalau pakai Supabase, aktifkan backup otomatis (biasanya tersedia bahkan di tier gratis dengan retensi terbatas); kalau self-host Postgres, jadwalkan `pg_dump` berkala ke storage terpisah.

### 10.4 Keandalan sistem (reliability)
- **Cron job yang gagal diam-diam**: tambahkan logging/alerting kalau `runFullScan()` melempar error — minimal catat ke `scan_log` dengan status gagal, idealnya kirim notifikasi (email/Telegram/Slack) ke kamu supaya tidak baru sadar seminggu kemudian data berhenti update.
- **Idempotency scan**: pastikan scan yang dijalankan dua kali berturut-turut (misal manual + cron bertabrakan) tidak menghasilkan data ganda atau snapshot metrics yang salah — gunakan lock sederhana (flag "sedang scan") kalau perlu.
- **Timeout & retry untuk panggilan API eksternal**: set timeout wajar (misal 10 detik) untuk tiap request ke YouTube/Meta, dan retry maksimal 2-3 kali dengan jeda, supaya satu platform yang lambat tidak membuat seluruh proses scan macet.
- **Monitoring uptime backend**: pakai layanan gratis seperti UptimeRobot untuk memantau apakah backend masih hidup, terutama kalau hosting yang dipakai punya kebiasaan "sleep" saat idle (tier gratis Render misalnya).

### 10.5 Etika & kepatuhan
- **Sesuai Terms of Service platform**: pastikan cara scan yang dipakai (API resmi, bukan scraping HTML) tetap dalam batas wajar penggunaan API YouTube/Meta — pemakaian API resmi sesuai kuota jauh lebih aman dibanding scraping langsung yang berisiko akun/App diblokir.
- **Transparansi ke editor**: karena performa dipakai untuk evaluasi kerja, sebaiknya editor tahu bahwa sistem ini ada dan bagaimana cara kerjanya (termasuk soal kode identifikasi wajib di caption) — menghindari kesan "diam-diam diawasi" yang bisa menurunkan kepercayaan tim.
- **Data pribadi di database**: kalau suatu saat menyimpan data tambahan editor (nomor kontak dsb), perlakukan sesuai praktik perlindungan data yang wajar — batasi siapa saja yang punya akses ke database production.

## 11. Referensi API resmi

- YouTube Data API v3: https://developers.google.com/youtube/v3/docs
- Instagram Graph API: https://developers.facebook.com/docs/instagram-api
- Facebook Graph API (Page Insights): https://developers.facebook.com/docs/graph-api