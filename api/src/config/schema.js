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
];

let ready = null;

function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      for (const sql of STATEMENTS) {
        try {
          await db.query(sql);
        } catch (e) {
          console.error('Schema update skipped:', e.message);
        }
      }
    })();
  }
  return ready;
}

module.exports = { ensureSchema };
