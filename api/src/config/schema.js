const crypto = require('crypto');
const db = require('./db');

// Additive, idempotent changes only: new tables and columns, never drops.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS settings (key VARCHAR(100) PRIMARY KEY, value TEXT, updated_at TIMESTAMP DEFAULT NOW())`,
  `ALTER TABLE editors ADD COLUMN IF NOT EXISTS peran VARCHAR(20) DEFAULT 'editor'`,
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
