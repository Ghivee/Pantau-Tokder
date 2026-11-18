const crypto = require('crypto');
const db = require('./db');

// Additive, idempotent changes only: new tables and columns, never drops.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS settings (key VARCHAR(100) PRIMARY KEY, value TEXT, updated_at TIMESTAMP DEFAULT NOW())`,
  `ALTER TABLE editors ADD COLUMN IF NOT EXISTS peran VARCHAR(20) DEFAULT 'editor'`,
  // Karyawan yang boleh melihat penghasilan (diatur pemilik); selain itu angka penghasilan tidak pernah dikirim.
  `ALTER TABLE editors ADD COLUMN IF NOT EXISTS lihat_penghasilan BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE editors ADD COLUMN IF NOT EXISTS pin VARCHAR(200)`,
  `ALTER TABLE editors ADD COLUMN IF NOT EXISTS jadwal VARCHAR(200) DEFAULT ''`,
  `ALTER TABLE editors ADD COLUMN IF NOT EXISTS target_harian INTEGER DEFAULT 3`,
  `ALTER TABLE editors ADD COLUMN IF NOT EXISTS foto_url TEXT`,
  `ALTER TABLE content ADD COLUMN IF NOT EXISTS channel_id VARCHAR(40)`,
  `ALTER TABLE content ADD COLUMN IF NOT EXISTS channel_nama VARCHAR(150)`,
  `ALTER TABLE content ADD COLUMN IF NOT EXISTS revenue NUMERIC DEFAULT 0`,
  `ALTER TABLE content ADD COLUMN IF NOT EXISTS views INTEGER`,
  `ALTER TABLE content ADD COLUMN IF NOT EXISTS likes INTEGER`,
  `ALTER TABLE content ADD COLUMN IF NOT EXISTS comments INTEGER`,
  `ALTER TABLE content ADD COLUMN IF NOT EXISTS stats_at TIMESTAMP`,
  `ALTER TABLE content ADD COLUMN IF NOT EXISTS retention_source VARCHAR(20)`,
  `CREATE INDEX IF NOT EXISTS content_tanggal_upload_idx ON content (tanggal_upload)`,
  `CREATE INDEX IF NOT EXISTS metrics_snapshot_content_time_idx ON metrics_snapshot (content_id, timestamp DESC)`,
  // Latest numbers live on the content row so the list loads without scanning every snapshot.
  `UPDATE content c SET views = m.views, likes = m.likes, comments = m.comments, stats_at = m.timestamp
   FROM (SELECT DISTINCT ON (content_id) content_id, views, likes, comments, timestamp
         FROM metrics_snapshot ORDER BY content_id, timestamp DESC) m
   WHERE m.content_id = c.id AND c.views IS NULL`,
  `CREATE TABLE IF NOT EXISTS aktivitas (
    id SERIAL PRIMARY KEY,
    editor_id INTEGER REFERENCES editors(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    jam VARCHAR(5) NOT NULL,
    tugas VARCHAR(60) NOT NULL,
    detail TEXT DEFAULT '',
    jumlah INTEGER DEFAULT 1,
    channel_id VARCHAR(40),
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS aktivitas_tanggal_idx ON aktivitas (tanggal)`,
  `CREATE TABLE IF NOT EXISTS channel_daily (
    channel_id VARCHAR(40) NOT NULL,
    tanggal DATE NOT NULL,
    views INTEGER DEFAULT 0,
    menit_tonton NUMERIC DEFAULT 0,
    sub_naik INTEGER DEFAULT 0,
    sub_turun INTEGER DEFAULT 0,
    revenue NUMERIC,
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (channel_id, tanggal)
  )`,
  // Login sessions: the cookie holds only a random token; its hash lives here so it can be revoked.
  `CREATE TABLE IF NOT EXISTS sesi (
    token_hash CHAR(64) PRIMARY KEY,
    tipe VARCHAR(10) NOT NULL,
    editor_id INTEGER REFERENCES editors(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sesi_editor_idx ON sesi (editor_id)`,
  // Failed sign-ins counted in the database, so the limit holds across serverless instances.
  `CREATE TABLE IF NOT EXISTS login_gagal (
    kunci VARCHAR(120) NOT NULL,
    waktu TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS login_gagal_kunci_idx ON login_gagal (kunci, waktu)`,
  `CREATE TABLE IF NOT EXISTS presensi (
    id SERIAL PRIMARY KEY,
    editor_id INTEGER NOT NULL REFERENCES editors(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    jenis VARCHAR(10) NOT NULL,
    waktu TIMESTAMP DEFAULT NOW(),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    akurasi DOUBLE PRECISION,
    jarak DOUBLE PRECISION,
    ip VARCHAR(64),
    telat_menit INTEGER,
    UNIQUE (editor_id, tanggal, jenis)
  )`,
  `CREATE INDEX IF NOT EXISTS presensi_tanggal_idx ON presensi (tanggal)`,
  // Every refused attempt is kept so the owner can spot someone trying to cheat.
  `CREATE TABLE IF NOT EXISTS presensi_ditolak (
    id SERIAL PRIMARY KEY,
    editor_id INTEGER REFERENCES editors(id) ON DELETE CASCADE,
    jenis VARCHAR(10),
    waktu TIMESTAMP DEFAULT NOW(),
    alasan TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    akurasi DOUBLE PRECISION,
    jarak DOUBLE PRECISION,
    ip VARCHAR(64),
    user_agent VARCHAR(300)
  )`,
  `CREATE INDEX IF NOT EXISTS presensi_ditolak_waktu_idx ON presensi_ditolak (waktu DESC)`,
  // When retention was last asked from YouTube for a video that had none, so opening it does not ask again every time.
  `ALTER TABLE content ADD COLUMN IF NOT EXISTS retention_cek TIMESTAMP`,
  `CREATE INDEX IF NOT EXISTS content_channel_idx ON content (channel_id)`,
  // Pay rules per employee. Every amount starts at 0: nothing is paid or cut until the owner sets it.
  `CREATE TABLE IF NOT EXISTS gaji_aturan (
    editor_id INTEGER PRIMARY KEY REFERENCES editors(id) ON DELETE CASCADE,
    gaji_pokok NUMERIC DEFAULT 0,
    tunjangan NUMERIC DEFAULT 0,
    potongan_tetap NUMERIC DEFAULT 0,
    potong_alpa NUMERIC DEFAULT 0,
    potong_izin NUMERIC DEFAULT 0,
    potong_telat NUMERIC DEFAULT 0,
    tarif_lembur NUMERIC DEFAULT 0,
    bonus_video NUMERIC DEFAULT 0,
    bonus_1000_views NUMERIC DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS gaji_penyesuaian (
    id SERIAL PRIMARY KEY,
    editor_id INTEGER NOT NULL REFERENCES editors(id) ON DELETE CASCADE,
    bulan CHAR(7) NOT NULL,
    jumlah NUMERIC NOT NULL,
    keterangan VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS gaji_penyesuaian_bulan_idx ON gaji_penyesuaian (bulan)`,
  // A finalized month is a frozen copy of the calculation: later changes to rules or data do not move it.
  `CREATE TABLE IF NOT EXISTS gaji_final (
    editor_id INTEGER NOT NULL REFERENCES editors(id) ON DELETE CASCADE,
    bulan CHAR(7) NOT NULL,
    rincian JSONB NOT NULL,
    total NUMERIC NOT NULL,
    final_at TIMESTAMP DEFAULT NOW(),
    dibayar_at TIMESTAMP,
    PRIMARY KEY (editor_id, bulan)
  )`,
  // Leave (izin, sakit, cuti) and expense claims an employee asks for and the owner decides on.
  `CREATE TABLE IF NOT EXISTS pengajuan (
    id SERIAL PRIMARY KEY,
    editor_id INTEGER NOT NULL REFERENCES editors(id) ON DELETE CASCADE,
    jenis VARCHAR(10) NOT NULL,
    dari DATE NOT NULL,
    sampai DATE NOT NULL,
    jumlah NUMERIC,
    alasan VARCHAR(300) NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'menunggu',
    catatan VARCHAR(200),
    diputus_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS pengajuan_editor_idx ON pengajuan (editor_id, dari)`,
  // Phones and browsers that asked for notifications. editor_id is NULL for the owner.
  `CREATE TABLE IF NOT EXISTS push_langganan (
    id SERIAL PRIMARY KEY,
    tipe VARCHAR(10) NOT NULL,
    editor_id INTEGER REFERENCES editors(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh VARCHAR(200) NOT NULL,
    auth VARCHAR(100) NOT NULL,
    perangkat VARCHAR(120),
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  // Reminders already sent, so a reminder goes out once however often the scheduler runs.
  `CREATE TABLE IF NOT EXISTS push_terkirim (kunci VARCHAR(120) PRIMARY KEY, waktu TIMESTAMP DEFAULT NOW())`,
  // Lookups by person happen on almost every page.
  `CREATE INDEX IF NOT EXISTS content_editor_idx ON content (editor_id)`,
  `CREATE INDEX IF NOT EXISTS aktivitas_editor_tanggal_idx ON aktivitas (editor_id, tanggal)`,
  `CREATE INDEX IF NOT EXISTS presensi_ditolak_editor_idx ON presensi_ditolak (editor_id, waktu DESC)`,
  // For the daily clean-up of old rows.
  `CREATE INDEX IF NOT EXISTS metrics_snapshot_time_idx ON metrics_snapshot (timestamp)`,
  `CREATE INDEX IF NOT EXISTS push_terkirim_waktu_idx ON push_terkirim (waktu)`,
  // A refusal for the office Wi-Fi while the GPS was fine inside the office: when several people
  // get one from the same new network, the office's public IP has most likely changed.
  `ALTER TABLE presensi_ditolak ADD COLUMN IF NOT EXISTS gps_ok BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE presensi_ditolak ADD COLUMN IF NOT EXISTS ip_jaringan VARCHAR(64)`,
  // TikTok, Instagram and Facebook: one row per connected account, tokens stored encrypted.
  `CREATE TABLE IF NOT EXISTS social_koneksi (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(12) NOT NULL,
    akun_id VARCHAR(80) NOT NULL,
    pemilik_id VARCHAR(80),
    nama VARCHAR(150),
    handle VARCHAR(100),
    avatar TEXT,
    followers INTEGER,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    refresh_expires_at TIMESTAMP,
    scope TEXT,
    status VARCHAR(10) DEFAULT 'aktif',
    galat TEXT,
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (platform, akun_id)
  )`,
  `CREATE TABLE IF NOT EXISTS social_post (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(12) NOT NULL,
    akun_id VARCHAR(80) NOT NULL,
    post_id VARCHAR(120) NOT NULL,
    url TEXT,
    judul VARCHAR(300),
    tanggal TIMESTAMP NOT NULL,
    views INTEGER,
    likes INTEGER,
    comments INTEGER,
    shares INTEGER,
    durasi INTEGER,
    editor_id INTEGER REFERENCES editors(id) ON DELETE SET NULL,
    stats_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (platform, post_id)
  )`,
  // One upload, many platforms: a posting is the video and its text, a target is one account it goes to.
  `CREATE TABLE IF NOT EXISTS posting (
    id SERIAL PRIMARY KEY,
    judul VARCHAR(200) NOT NULL,
    deskripsi TEXT DEFAULT '',
    blob_url TEXT,
    ukuran BIGINT,
    mime VARCHAR(60),
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS posting_target (
    id SERIAL PRIMARY KEY,
    posting_id INTEGER NOT NULL REFERENCES posting(id) ON DELETE CASCADE,
    platform VARCHAR(12) NOT NULL,
    akun_id VARCHAR(80) NOT NULL,
    akun_nama VARCHAR(150),
    status VARCHAR(12) NOT NULL DEFAULT 'diproses',
    ref_id VARCHAR(200),
    hasil_url TEXT,
    galat TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS posting_target_posting_idx ON posting_target (posting_id)`,
  `CREATE INDEX IF NOT EXISTS social_post_tanggal_idx ON social_post (tanggal DESC)`,
  `CREATE INDEX IF NOT EXISTS social_post_akun_idx ON social_post (platform, akun_id)`,
  // Impresi dan CTR per video per hari (laporan reach YouTube), untuk daftar 'Perbaiki dulu'.
  `CREATE TABLE IF NOT EXISTS video_reach (
    video_id VARCHAR(20) NOT NULL,
    channel_id VARCHAR(40) NOT NULL,
    tanggal DATE NOT NULL,
    impresi BIGINT NOT NULL DEFAULT 0,
    ctr NUMERIC(6,3),
    PRIMARY KEY (video_id, tanggal)
  )`,
  `CREATE INDEX IF NOT EXISTS video_reach_channel_idx ON video_reach (channel_id, tanggal)`,
  // Pelacak tautan afiliasi: /go/<kode> mencatat klik per hari lalu meneruskan ke tujuan.
  `CREATE TABLE IF NOT EXISTS tautan (
    kode VARCHAR(16) PRIMARY KEY,
    channel_id VARCHAR(40) NOT NULL,
    label VARCHAR(80) NOT NULL,
    tujuan TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS tautan_klik (
    kode VARCHAR(16) NOT NULL REFERENCES tautan(kode) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    jumlah INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (kode, tanggal)
  )`,
  // Tautan pelacak boleh dikaitkan ke satu video, supaya klik terlihat per video.
  `ALTER TABLE tautan ADD COLUMN IF NOT EXISTS video_id VARCHAR(20)`,
  // Rekap 3 channel: angka yang tidak diberikan YouTube Analytics API (CTR, klik afiliasi) diimpor dari CSV, per channel per hari.
  `CREATE TABLE IF NOT EXISTS channel_metrik (
    channel_id VARCHAR(40) NOT NULL,
    tanggal DATE NOT NULL,
    impresi BIGINT,
    ctr NUMERIC(6,3),
    klik_afiliasi INTEGER,
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (channel_id, tanggal)
  )`,
  // Real-time: total tayangan channel dibaca tiap menit selama Rekap terbuka; selisih antar bacaan = tayangan per jam.
  `CREATE TABLE IF NOT EXISTS channel_snap (
    channel_id VARCHAR(40) NOT NULL,
    waktu TIMESTAMP NOT NULL DEFAULT NOW(),
    views BIGINT NOT NULL,
    subs BIGINT,
    PRIMARY KEY (channel_id, waktu)
  )`,
];

const CONNECTION_CODES = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '57P01', '53300'];

// One-time: the old sync stored made-up retention curves and average view durations when
// YouTube Analytics was not connected. They cannot be told apart from real ones, so all are
// cleared and the sync fills real retention back in for connected channels.
const ONE_TIME = [
  {
    key: 'cleanup_simulasi_retensi_v1',
    sql: `UPDATE content SET retention_data = NULL, avg_view_duration = NULL WHERE retention_source IS NULL`,
  },
];

let ready = null;

// Fingerprint of everything above. A cold start that finds it already stored skips all statements
// (one query instead of dozens, some of them heavy), so the first request after a deploy stays fast.
const VERSION = crypto.createHash('sha1').update(JSON.stringify([STATEMENTS, ONE_TIME])).digest('hex').slice(0, 12);

function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      try {
        const v = await db.query(`SELECT value FROM settings WHERE key = 'schema_versi'`);
        if (v.rows[0] && v.rows[0].value === VERSION) return;
      } catch (e) {
        if (CONNECTION_CODES.includes(e.code)) { ready = null; return; }
        // settings does not exist yet: run everything below.
      }
      let failed = false;
      for (const sql of STATEMENTS) {
        try {
          await db.query(sql);
        } catch (e) {
          // Database unreachable: try again on the next request instead of never.
          if (CONNECTION_CODES.includes(e.code)) { ready = null; return; }
          failed = true;
          console.error('Schema update skipped:', e.message);
        }
      }
      for (const step of ONE_TIME) {
        try {
          const done = await db.query('SELECT 1 FROM settings WHERE key = $1', [step.key]);
          if (done.rows.length) continue;
          await db.query(step.sql);
          await db.query(`INSERT INTO settings (key, value, updated_at) VALUES ($1, 'selesai', NOW()) ON CONFLICT (key) DO NOTHING`, [step.key]);
        } catch (e) {
          failed = true;
          console.error('One-time step skipped:', step.key, e.message);
        }
      }
      // Only a fully applied schema is remembered; otherwise the next cold start tries again.
      if (!failed) await db.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ('schema_versi', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [VERSION]
      ).catch((e) => console.error('Schema version not saved:', e.message));
    })();
  }
  return ready;
}

module.exports = { ensureSchema };
