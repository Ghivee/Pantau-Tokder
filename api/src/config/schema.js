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
];

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

function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      if (typeof db.isMock === 'function' && db.isMock()) return;
      for (const sql of STATEMENTS) {
        try {
          await db.query(sql);
        } catch (e) {
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
          console.error('One-time step skipped:', step.key, e.message);
        }
      }
    })();
  }
  return ready;
}

module.exports = { ensureSchema };
