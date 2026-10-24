const { Pool, types } = require('pg');

// Timestamps are stored as UTC wall-clock time (TIMESTAMP without zone). Read them as UTC
// whatever the server's own time zone is, and keep DATE values as plain YYYY-MM-DD text.
types.setTypeParser(1114, (v) => new Date(v.replace(' ', 'T') + 'Z'));
types.setTypeParser(1082, (v) => v);
try { require('dotenv').config(); } catch (e) { /* .env not present */ }

let isMock = false;
let pool = null;

const dbUrl = process.env.DATABASE_URL || '';
const isPlaceholder = !dbUrl || dbUrl.includes('user:password') || dbUrl.includes('host:5432');

if (dbUrl && !isPlaceholder) {
  pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  // Test koneksi ke database saat server berjalan
  pool.connect((err, client, release) => {
    if (err) {
      console.error('❌ Koneksi Database Gagal:', err.message);
      console.log('Mengalihkan ke mode dummy/mock.');
      isMock = true;
    } else {
      console.log('✅ Database berhasil terkoneksi!');
      release();
    }
  });
} else {
  console.log("DATABASE_URL belum diatur. Menggunakan data dummy lokal.");
  isMock = true;
}

// In-Memory Mock Store for Local Development & Demo
const now = new Date();
const todayStr = new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const daysAgo = (n) => new Date(now.getTime() + 7 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);

const mockStore = {
  settings: new Map([
    ['admin_password', 'admin123'],
    ['youtube_channel_ids', 'UC1wIvd8HotnZe0KENzHj2kQ,UCzT5qFGfREJM11U81VbVhsw,UCn9o9wh8IaSPUsGmXeA9qDQ'],
  ]),
  editors: [
    {
      id: 1,
      nama: 'Alivia',
      kode_identifikasi: 'AL',
      status: 'aktif',
      peran: 'editor',
      target_harian: 3,
      jadwal: '06:00, 07:00, 12:00',
      foto_url: '',
      pin: null,
      created_at: new Date(now.getTime() - 30 * 86400000).toISOString(),
    },
    {
      id: 2,
      nama: 'Deni',
      kode_identifikasi: 'DE',
      status: 'aktif',
      peran: 'terbatas',
      target_harian: 3,
      jadwal: '06:00, 12:00, 18:00',
      foto_url: '',
      pin: null,
      created_at: new Date(now.getTime() - 30 * 86400000).toISOString(),
    },
  ],
  channels: [
    { id: 'UC1wIvd8HotnZe0KENzHj2kQ', nama: 'Tokder', handle: '@tokder-tv' },
    { id: 'UCzT5qFGfREJM11U81VbVhsw', nama: 'Budidaya Cabe', handle: '@BudidayaCabeTV' },
    { id: 'UCn9o9wh8IaSPUsGmXeA9qDQ', nama: 'Harga Cabe Hari Ini', handle: '@hargacabehariini' },
  ],
  content: [
    {
      id: 1,
      post_id: 'sample_vid_1',
      platform: 'youtube',
      url: 'https://youtube.com',
      judul: 'Cara Merawat Cabai Rawit Agar Berbuah Lebat #AL',
      tanggal_upload: `${daysAgo(0)}T06:10:00Z`,
      editor_id: 1,
      status_identifikasi: 'matched',
      tipe_video: 'video',
      duration_secs: 480,
      channel_id: 'UC1wIvd8HotnZe0KENzHj2kQ',
      channel_nama: 'Tokder',
      revenue: 12.5,
      views: 3420,
      likes: 215,
      comments: 38,
      retention_data: [100, 85, 78, 70, 65, 60, 58, 55, 52, 50],
      retention_source: 'analytics',
    },
    {
      id: 2,
      post_id: 'sample_vid_2',
      platform: 'youtube',
      url: 'https://youtube.com',
      judul: 'Trik Rahasia Semai Benih Cepat Tumbuh #AL',
      tanggal_upload: `${daysAgo(0)}T07:05:00Z`,
      editor_id: 1,
      status_identifikasi: 'matched',
      tipe_video: 'short',
      duration_secs: 58,
      channel_id: 'UCzT5qFGfREJM11U81VbVhsw',
      channel_nama: 'Budidaya Cabe',
      revenue: 3.2,
      views: 12500,
      likes: 890,
      comments: 64,
      retention_data: [100, 92, 88, 85, 80],
      retention_source: 'analytics',
    },
    {
      id: 3,
      post_id: 'sample_vid_3',
      platform: 'youtube',
      url: 'https://youtube.com',
      judul: 'Update Harga Cabe Rawit Merah Terkini #DE',
      tanggal_upload: `${daysAgo(0)}T12:00:00Z`,
      editor_id: 2,
      status_identifikasi: 'matched',
      tipe_video: 'video',
      duration_secs: 320,
      channel_id: 'UCn9o9wh8IaSPUsGmXeA9qDQ',
      channel_nama: 'Harga Cabe Hari Ini',
      revenue: 8.4,
      views: 5120,
      likes: 310,
      comments: 42,
      retention_data: null,
      retention_source: null,
    },
    {
      id: 4,
      post_id: 'sample_vid_4',
      platform: 'youtube',
      url: 'https://youtube.com',
      judul: 'Tips Pupuk Susulan Cabai Musim Hujan #AL',
      tanggal_upload: `${daysAgo(1)}T06:05:00Z`,
      editor_id: 1,
      status_identifikasi: 'matched',
      tipe_video: 'video',
      duration_secs: 540,
      channel_id: 'UC1wIvd8HotnZe0KENzHj2kQ',
      channel_nama: 'Tokder',
      revenue: 15.8,
      views: 7800,
      likes: 450,
      comments: 55,
      retention_data: [100, 88, 80, 72, 68, 62, 59],
      retention_source: 'analytics',
    },
    {
      id: 5,
      post_id: 'sample_vid_5',
      platform: 'youtube',
      url: 'https://youtube.com',
      judul: 'Atasi Hama Patek dan Lalat Buah #DE',
      tanggal_upload: `${daysAgo(1)}T12:15:00Z`,
      editor_id: 2,
      status_identifikasi: 'matched',
      tipe_video: 'video',
      duration_secs: 420,
      channel_id: 'UCzT5qFGfREJM11U81VbVhsw',
      channel_nama: 'Budidaya Cabe',
      revenue: 9.1,
      views: 4300,
      likes: 280,
      comments: 29,
      retention_data: null,
      retention_source: null,
    },
    {
      id: 6,
      post_id: 'sample_vid_6',
      platform: 'youtube',
      url: 'https://youtube.com',
      judul: 'Hasil Panen Cabe Rawit Petikan Ke-5',
      tanggal_upload: `${daysAgo(2)}T08:00:00Z`,
      editor_id: null,
      status_identifikasi: 'unmatched',
      tipe_video: 'short',
      duration_secs: 45,
      channel_id: 'UC1wIvd8HotnZe0KENzHj2kQ',
      channel_nama: 'Tokder',
      revenue: 1.5,
      views: 8900,
      likes: 620,
      comments: 41,
      retention_data: null,
      retention_source: null,
    },
  ],
  aktivitas: [
    {
      id: 1,
      editor_id: 1,
      tanggal: daysAgo(0),
      jam: '08:30',
      tugas: 'Riset harga cabai',
      detail: 'Cek harga pasar induk kramat jati',
      jumlah: 1,
      channel_id: 'UCn9o9wh8IaSPUsGmXeA9qDQ',
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      editor_id: 1,
      tanggal: daysAgo(0),
      jam: '10:00',
      tugas: 'Buat thumbnail',
      detail: 'Thumbnail video pupuk organik',
      jumlah: 2,
      channel_id: 'UC1wIvd8HotnZe0KENzHj2kQ',
      created_at: new Date().toISOString(),
    },
  ],
  channel_daily: [
    {
      channel_id: 'UC1wIvd8HotnZe0KENzHj2kQ',
      tanggal: daysAgo(0),
      views: 4200,
      menit_tonton: 18500,
      sub_naik: 45,
      sub_turun: 3,
      revenue: 14.2,
    },
    {
      channel_id: 'UCzT5qFGfREJM11U81VbVhsw',
      tanggal: daysAgo(0),
      views: 13500,
      menit_tonton: 26400,
      sub_naik: 98,
      sub_turun: 8,
      revenue: 4.8,
    },
    {
      channel_id: 'UCn9o9wh8IaSPUsGmXeA9qDQ',
      tanggal: daysAgo(0),
      views: 5800,
      menit_tonton: 14200,
      sub_naik: 32,
      sub_turun: 2,
      revenue: 9.6,
    },
    {
      channel_id: 'UC1wIvd8HotnZe0KENzHj2kQ',
      tanggal: daysAgo(1),
      views: 8200,
      menit_tonton: 32000,
      sub_naik: 60,
      sub_turun: 5,
      revenue: 18.5,
    },
    {
      channel_id: 'UCzT5qFGfREJM11U81VbVhsw',
      tanggal: daysAgo(1),
      views: 4900,
      menit_tonton: 16800,
      sub_naik: 35,
      sub_turun: 4,
      revenue: 10.2,
    },
  ],
  affiliate_goals: [
    {
      id: 1,
      bulan: todayStr.slice(0, 7),
      target_omset: 500,
      tercapai: 215.5,
      created_at: new Date().toISOString(),
    },
  ],
  scan_log: [
    {
      id: 1,
      waktu_scan: new Date(now.getTime() - 10 * 60000).toISOString(),
      created_at: new Date(now.getTime() - 10 * 60000).toISOString(),
      status: 'sukses',
    },
  ],
};

async function mockQuery(text, params = []) {
  const q = String(text || '').trim();

  // Settings SELECT
  if (/SELECT\s+[\s\S]*FROM\s+settings\s+WHERE\s+key\s*=\s*\$1/is.test(q)) {
    const val = mockStore.settings.get(params[0]);
    return { rows: val !== undefined ? [{ value: val }] : [] };
  }

  // Settings INSERT/UPDATE
  if (/INSERT\s+INTO\s+settings/is.test(q)) {
    mockStore.settings.set(params[0], params[1]);
    return { rows: [{ key: params[0], value: params[1] }] };
  }

  // Editors SELECT ALL
  if (/SELECT\s+[\s\S]*FROM\s+editors\s+ORDER\s+BY\s+id\s+ASC/is.test(q)) {
    const rows = mockStore.editors.map((e) => ({
      ...e,
      punya_pin: !!e.pin,
    }));
    return { rows };
  }

  // Editors SELECT by ID
  if (/SELECT\s+[\s\S]*FROM\s+editors\s+WHERE\s+id\s*=\s*\$1/is.test(q)) {
    const found = mockStore.editors.find((e) => e.id === Number(params[0]));
    return { rows: found ? [{ ...found, punya_pin: !!found.pin }] : [] };
  }

  // Editors INSERT
  if (/INSERT\s+INTO\s+editors/is.test(q)) {
    const newId = mockStore.editors.length ? Math.max(...mockStore.editors.map((e) => e.id)) + 1 : 1;
    const item = {
      id: newId,
      nama: params[0],
      kode_identifikasi: params[1],
      peran: params[2] || 'editor',
      jadwal: params[3] || '',
      target_harian: parseInt(params[4], 10) || 3,
      foto_url: params[5] || null,
      pin: params[6] || null,
      status: 'aktif',
      created_at: new Date().toISOString(),
    };
    mockStore.editors.push(item);
    return { rows: [{ ...item, punya_pin: !!item.pin }] };
  }

  // Editors UPDATE
  if (/UPDATE\s+editors\s+SET/is.test(q)) {
    const id = Number(params[params.length - 1]);
    const found = mockStore.editors.find((e) => e.id === id);
    if (found) {
      if (params[0]) found.nama = params[0];
      if (params[1]) found.kode_identifikasi = params[1];
    }
    return { rows: found ? [{ ...found, punya_pin: !!found.pin }] : [] };
  }

  // Editors DELETE
  if (/DELETE\s+FROM\s+editors\s+WHERE\s+id\s*=\s*\$1/is.test(q)) {
    mockStore.editors = mockStore.editors.filter((e) => e.id !== Number(params[0]));
    mockStore.content.forEach((c) => {
      if (c.editor_id === Number(params[0])) c.editor_id = null;
    });
    return { rows: [] };
  }

  // Content SELECT List
  if (/SELECT\s+[\s\S]*FROM\s+content/is.test(q)) {
    // Check if single content by ID
    const singleMatch = q.match(/WHERE\s+id\s*=\s*\$1/i);
    if (singleMatch) {
      const c = mockStore.content.find((x) => x.id === Number(params[0]));
      return { rows: c ? [{ ...c, punya_retensi: !!c.retention_data }] : [] };
    }

    // Check group by channel
    if (/GROUP\s+BY\s+channel_id/is.test(q)) {
      const counts = {};
      mockStore.content.forEach((c) => {
        if (!c.channel_id) return;
        if (!counts[c.channel_id]) counts[c.channel_id] = { channel_id: c.channel_id, nama: c.channel_nama, jumlah_video: 0 };
        counts[c.channel_id].jumlah_video++;
      });
      return { rows: Object.values(counts) };
    }

    let rows = [...mockStore.content].sort((a, b) => new Date(b.tanggal_upload) - new Date(a.tanggal_upload));
    return { rows: rows.map((c) => ({ ...c, punya_retensi: !!c.retention_data })) };
  }

  // Content ASSIGN
  if (/UPDATE\s+content\s+SET\s+editor_id\s*=\s*\$1/is.test(q)) {
    const editorId = Number(params[0]);
    const contentId = Number(params[params.length - 1]);
    const c = mockStore.content.find((x) => x.id === contentId);
    if (c) {
      c.editor_id = editorId;
      c.status_identifikasi = 'matched';
    }
    return { rows: c ? [c] : [] };
  }

  // Aktivitas SELECT
  if (/SELECT\s+[\s\S]*FROM\s+aktivitas/is.test(q)) {
    return { rows: [...mockStore.aktivitas] };
  }

  // Aktivitas INSERT
  if (/INSERT\s+INTO\s+aktivitas/is.test(q)) {
    const newId = mockStore.aktivitas.length ? Math.max(...mockStore.aktivitas.map((a) => a.id)) + 1 : 1;
    const item = {
      id: newId,
      editor_id: Number(params[0]),
      tanggal: String(params[1]).slice(0, 10),
      jam: String(params[2]),
      tugas: String(params[3]),
      detail: String(params[4] || ''),
      jumlah: Number(params[5] || 1),
      channel_id: params[6] || null,
      created_at: new Date().toISOString(),
    };
    mockStore.aktivitas.push(item);
    return { rows: [item] };
  }

  // Aktivitas DELETE
  if (/DELETE\s+FROM\s+aktivitas\s+WHERE\s+id\s*=\s*\$1/is.test(q)) {
    mockStore.aktivitas = mockStore.aktivitas.filter((a) => a.id !== Number(params[0]));
    return { rows: [] };
  }

  // Channel Daily SELECT
  if (/SELECT\s+[\s\S]*FROM\s+channel_daily/is.test(q)) {
    return { rows: [...mockStore.channel_daily] };
  }

  // Affiliate Goals SELECT
  if (/SELECT\s+[\s\S]*FROM\s+affiliate_goals/is.test(q)) {
    const bulan = params[0] || todayStr.slice(0, 7);
    const found = mockStore.affiliate_goals.find((g) => g.bulan === bulan);
    return { rows: found ? [found] : [] };
  }

  // Affiliate Goals INSERT / UPDATE
  if (/INSERT\s+INTO\s+affiliate_goals/is.test(q)) {
    const bulan = params[0];
    const target = Number(params[1]);
    const tercapai = Number(params[2]);
    let found = mockStore.affiliate_goals.find((g) => g.bulan === bulan);
    if (found) {
      found.target_omset = target;
      found.tercapai = tercapai;
    } else {
      found = { id: mockStore.affiliate_goals.length + 1, bulan, target_omset: target, tercapai, created_at: new Date().toISOString() };
      mockStore.affiliate_goals.push(found);
    }
    return { rows: [found] };
  }

  // Scan log SELECT
  if (/SELECT\s+[\s\S]*FROM\s+scan_log/is.test(q)) {
    return { rows: [...mockStore.scan_log] };
  }

  // Fallback for generic SELECT/INSERT
  return { rows: [] };
}

const query = async (text, params) => {
  if (isMock || !pool) {
    return mockQuery(text, params);
  }
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('Database query error, falling back to mock:', err.message);
    return mockQuery(text, params);
  }
};

module.exports = { query, isMock: () => isMock, pool };
