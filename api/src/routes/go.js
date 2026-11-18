const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Alamat publik pelacak tautan afiliasi: /go/<kode> mencatat satu klik (per hari, WIB) lalu meneruskan ke tujuan.
// Pratinjau tautan dan robot tidak dihitung. Kegagalan mencatat tidak boleh menahan pengunjung.
const ROBOT = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slurp|headless|curl|python-requests/i;

router.get('/:kode', async (req, res) => {
  try {
    const kode = String(req.params.kode || '').toLowerCase();
    if (!/^[a-z0-9]{3,16}$/.test(kode)) return res.status(404).type('text').send('Tautan tidak ditemukan');
    const r = await db.query('SELECT tujuan FROM tautan WHERE kode = $1', [kode]);
    if (!r.rows[0]) return res.status(404).type('text').send('Tautan tidak ditemukan');
    if (!ROBOT.test(req.get('user-agent') || '') && req.method === 'GET') {
      db.query(
        `INSERT INTO tautan_klik (kode, tanggal, jumlah) VALUES ($1, (NOW() AT TIME ZONE 'UTC' + INTERVAL '7 hours')::date, 1)
         ON CONFLICT (kode, tanggal) DO UPDATE SET jumlah = tautan_klik.jumlah + 1`, [kode]).catch((e) => console.warn('klik tidak tercatat:', e.message));
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.redirect(302, r.rows[0].tujuan);
  } catch (err) {
    console.error('go', err.message);
    return res.status(503).type('text').send('Sedang tidak bisa dibuka, coba lagi sebentar lagi');
  }
});

module.exports = router;
