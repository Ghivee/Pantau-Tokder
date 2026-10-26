const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { fail } = require('../utils/httpError');

// Numbers for the Performa and Tren pages that the video list does not carry:
// a short summary of each retention curve, and how many views each video gained recently
// (from the stored sync snapshots; a video without an older snapshot has no gain to show).

const near = (pts, p) => pts.reduce((a, b) => (Math.abs(b.percent_duration - p) < Math.abs(a.percent_duration - p) ? b : a)).retention;

function ringkasRetensi(raw) {
  let pts = raw;
  if (typeof pts === 'string') { try { pts = JSON.parse(pts); } catch (e) { return null; } }
  if (!Array.isArray(pts)) return null;
  pts = pts.filter((d) => d && Number.isFinite(+d.percent_duration) && Number.isFinite(+d.retention)).map((d) => ({ percent_duration: +d.percent_duration, retention: +d.retention }));
  if (pts.length < 3) return null;
  return { awal: Math.round(near(pts, 10)), tengah: Math.round(near(pts, 50)), akhir: Math.round(near(pts, 100)) };
}

router.get('/', async (req, res) => {
  try {
    const [ret, naik] = await Promise.all([
      db.query(`SELECT id, retention_data FROM content WHERE retention_data IS NOT NULL AND tanggal_upload > NOW() - INTERVAL '180 days'`),
      db.query(`
        SELECT c.id, c.views AS sekarang, c.stats_at,
               h.views AS v1, h.timestamp AS t1, w.views AS v7, w.timestamp AS t7
        FROM content c
        LEFT JOIN LATERAL (SELECT views, timestamp FROM metrics_snapshot m
                           WHERE m.content_id = c.id AND m.timestamp <= c.stats_at - INTERVAL '20 hours'
                           ORDER BY m.timestamp DESC LIMIT 1) h ON TRUE
        LEFT JOIN LATERAL (SELECT views, timestamp FROM metrics_snapshot m
                           WHERE m.content_id = c.id AND m.timestamp <= c.stats_at - INTERVAL '6 days'
                           ORDER BY m.timestamp DESC LIMIT 1) w ON TRUE
        WHERE c.stats_at > NOW() - INTERVAL '3 days' AND c.views IS NOT NULL`),
    ]);
    const jam = (a, b) => Math.round((new Date(a) - new Date(b)) / 3600000);
    res.json({
      retensi: ret.rows.map((r) => ({ id: r.id, ...ringkasRetensi(r.retention_data) })).filter((r) => r.tengah != null),
      naik: naik.rows.filter((r) => r.v1 != null || r.v7 != null).map((r) => ({
        id: r.id,
        hari: r.v1 != null ? { naik: Math.max(0, r.sekarang - r.v1), jam: jam(r.stats_at, r.t1) } : null,
        minggu: r.v7 != null ? { naik: Math.max(0, r.sekarang - r.v7), jam: jam(r.stats_at, r.t7) } : null,
      })),
      dihitung_at: new Date().toISOString(),
    });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
module.exports.ringkasRetensi = ringkasRetensi;
