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
