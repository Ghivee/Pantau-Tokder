const express = require('express');
const axios = require('axios');
const router = express.Router();
const db = require('../config/db');
const { fail, bad } = require('../utils/httpError');
const { requireAdmin, requireAnyAuth } = require('../middlewares/sessionAuth');
const crypto = require('crypto');
const { getChannelIds } = require('../services/channelService');

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const wib = (n = 0) => new Date(Date.now() + 7 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);

// Pemilik dan karyawan membaca rekap dan membuat tautan; impor dan penghapusan tautan hanya pemilik.
router.use(requireAnyAuth);

// Angka harian yang diimpor (CTR, impresi, klik afiliasi) untuk periode yang diminta.
router.get('/', async (req, res) => {
  try {
    const hari = Math.min(366, Math.max(1, parseInt(req.query.hari, 10) || 90));
    const r = await db.query(
      `SELECT channel_id, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, impresi::float AS impresi, ctr::float AS ctr, klik_afiliasi
       FROM channel_metrik WHERE tanggal >= $1 ORDER BY tanggal`, [wib(hari)]);
    const k = await db.query(
      `SELECT t.channel_id, to_char(k.tanggal, 'YYYY-MM-DD') AS tanggal, SUM(k.jumlah)::int AS jumlah
       FROM tautan_klik k JOIN tautan t ON t.kode = k.kode WHERE k.tanggal >= $1 GROUP BY t.channel_id, k.tanggal ORDER BY k.tanggal`, [wib(hari)]);
    res.json({ metrik: r.rows, klik_tautan: k.rows });
  } catch (err) { fail(res, err); }
});

// Tautan afiliasi yang dilacak: daftar dengan klik 7 hari dan total.
router.get('/tautan', async (req, res) => {
  try {
    const r = await db.query(
      `SELECT t.kode, t.channel_id, t.label, t.tujuan, t.created_at,
              COALESCE(SUM(k.jumlah), 0)::int AS total,
              COALESCE(SUM(k.jumlah) FILTER (WHERE k.tanggal >= $1), 0)::int AS tujuh_hari
       FROM tautan t LEFT JOIN tautan_klik k ON k.kode = t.kode GROUP BY t.kode ORDER BY t.created_at DESC`, [wib(6)]);
    res.json({ tautan: r.rows });
  } catch (err) { fail(res, err); }
});

router.post('/tautan', async (req, res) => {
  try {
    const b = req.body || {};
    const ids = await getChannelIds();
    if (!ids.includes(b.channel_id)) throw bad(400, 'Channel tidak dikenal');
    const label = String(b.label || '').trim().slice(0, 80);
    if (!label) throw bad(400, 'Beri nama tautan, misalnya produk atau video-nya');
    let u;
    try { u = new URL(String(b.tujuan || '').trim()); } catch (e) { throw bad(400, 'Tujuan harus berupa alamat lengkap, diawali https://'); }
    if (u.protocol !== 'https:') throw bad(400, 'Tujuan harus diawali https://');
    if (String(u).length > 2000) throw bad(400, 'Alamat tujuan terlalu panjang');
    const n = (await db.query('SELECT COUNT(*)::int AS n FROM tautan')).rows[0].n;
    if (n >= 500) throw bad(400, 'Terlalu banyak tautan; hapus yang tidak terpakai');
    for (let i = 0; i < 5; i++) {
      const kode = crypto.randomBytes(5).toString('base64url').replace(/[-_]/g, 'x').slice(0, 6).toLowerCase();
      const r = await db.query(`INSERT INTO tautan (kode, channel_id, label, tujuan) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING kode, channel_id, label, tujuan, created_at`, [kode, b.channel_id, label, String(u)]);
      if (r.rows[0]) return res.json({ ...r.rows[0], total: 0, tujuh_hari: 0 });
    }
    throw bad(500, 'Gagal membuat kode tautan, coba lagi');
  } catch (err) { fail(res, err); }
});

router.delete('/tautan/:kode', requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM tautan WHERE kode = $1', [String(req.params.kode).slice(0, 16)]);
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

// Mengimpor satu jenis angka untuk satu channel. jenis 'ctr': baris {tanggal, impresi?, ctr}; jenis 'klik': baris {tanggal, klik}.
// Hanya kolom jenis itu yang diganti; kolom jenis lain di hari yang sama tidak disentuh.
router.put('/impor', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const ids = await getChannelIds();
    if (!ids.includes(b.channel_id)) throw bad(400, 'Channel tidak dikenal');
    if (!['ctr', 'klik'].includes(b.jenis)) throw bad(400, 'Jenis impor tidak dikenal');
    const baris = Array.isArray(b.baris) ? b.baris : [];
    if (!baris.length || baris.length > 800) throw bad(400, 'File tidak berisi baris yang bisa dibaca (maksimal 800 hari)');
    const num = (v) => (v == null || v === '' ? null : Number(v));
    for (const r of baris) {
      if (!TANGGAL.test(String(r.tanggal))) throw bad(400, `Tanggal "${r.tanggal}" tidak valid`);
      if (b.jenis === 'ctr') {
        const c = num(r.ctr), i = num(r.impresi);
        if (!Number.isFinite(c) || c < 0 || c > 100) throw bad(400, `CTR tanggal ${r.tanggal} harus 0–100`);
        if (i != null && (!Number.isFinite(i) || i < 0 || i > 1e12)) throw bad(400, `Impresi tanggal ${r.tanggal} tidak valid`);
      } else {
        const k = num(r.klik);
        if (!Number.isFinite(k) || k < 0 || k > 1e9) throw bad(400, `Klik tanggal ${r.tanggal} tidak valid`);
      }
    }
    for (const r of baris) {
      if (b.jenis === 'ctr') {
        await db.query(
          `INSERT INTO channel_metrik (channel_id, tanggal, impresi, ctr) VALUES ($1, $2, $3, $4)
           ON CONFLICT (channel_id, tanggal) DO UPDATE SET impresi = $3, ctr = $4, updated_at = NOW()`,
          [b.channel_id, r.tanggal, num(r.impresi) == null ? null : Math.round(num(r.impresi)), num(r.ctr)]);
      } else {
        await db.query(
          `INSERT INTO channel_metrik (channel_id, tanggal, klik_afiliasi) VALUES ($1, $2, $3)
           ON CONFLICT (channel_id, tanggal) DO UPDATE SET klik_afiliasi = $3, updated_at = NOW()`,
          [b.channel_id, r.tanggal, Math.round(num(r.klik))]);
      }
    }
    res.json({ ok: true, baris: baris.length });
  } catch (err) { fail(res, err); }
});

// Real-time: baca total tayangan tiap channel dari YouTube Data API, simpan sebagai bacaan baru
// (paling sering sekali per 50 detik), lalu kirim bacaan 48 jam terakhir.
router.post('/realtime', async (req, res) => {
  try {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) throw bad(503, 'YOUTUBE_API_KEY belum diisi di Vercel, jadi angka real-time belum bisa dibaca.');
    const ids = await getChannelIds();
    if (ids.length) {
      const terakhir = await db.query(`SELECT EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - MAX(waktu))) AS detik FROM channel_snap WHERE channel_id = ANY($1)`, [ids]);
      const detik = terakhir.rows[0].detik;
      if (detik == null || +detik > 50) {
        const r = await axios.get('https://www.googleapis.com/youtube/v3/channels', { params: { key, id: ids.join(','), part: 'statistics' }, timeout: 15000 });
        for (const c of r.data.items || []) {
          const s = c.statistics || {};
          if (s.viewCount == null) continue;
          await db.query(
            `INSERT INTO channel_snap (channel_id, waktu, views, subs) VALUES ($1, date_trunc('second', NOW() AT TIME ZONE 'UTC'), $2, $3) ON CONFLICT DO NOTHING`,
            [c.id, s.viewCount, s.hiddenSubscriberCount ? null : s.subscriberCount == null ? null : s.subscriberCount]);
        }
        await db.query(`DELETE FROM channel_snap WHERE waktu < (NOW() AT TIME ZONE 'UTC') - INTERVAL '8 days'`);
      }
    }
    const r = await db.query(
      `SELECT channel_id, to_char(waktu, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS waktu, views::float AS views, subs::float AS subs
       FROM channel_snap WHERE channel_id = ANY($1) AND waktu > (NOW() AT TIME ZONE 'UTC') - INTERVAL '48 hours' ORDER BY waktu`, [ids]);
    res.json({ snap: r.rows, sekarang: new Date().toISOString() });
  } catch (err) {
    if (err.response) { console.error('rekap realtime', err.response.data || err.message); return res.status(502).json({ error: 'YouTube belum menjawab. Coba lagi sebentar lagi.' }); }
    fail(res, err);
  }
});

module.exports = router;
