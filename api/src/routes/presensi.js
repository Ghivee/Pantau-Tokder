const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const presensi = require('../services/presensiService');
const { requireAdmin, requireEditor } = require('../middlewares/sessionAuth');
const { userMutationLimiter } = require('../middlewares/rateLimit');
const { createAuditMiddleware } = require('../utils/auditLog');
const { clientIp } = require('../utils/clientIp');
const push = require('../services/pushService');

// Tells the owner once per network that the office IP seems to have changed.
const kabariIpBaru = async (k) => (!k ? null : push.sekali(`ipkantor:${presensi.todayWib()}:${k.ip}`, () => push.kirim({ admin: true }, {
  title: 'IP Wi-Fi kantor tampaknya berubah',
  body: `${k.orang} karyawan di dalam kantor ditolak dari jaringan baru ${k.ip}. Buka Presensi untuk menyetujuinya.`,
  url: '/presensi', tag: 'ipkantor',
})));

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

function rentang(q) {
  const sampai = q.sampai || presensi.todayWib();
  const dari = q.dari || presensi.todayWib(Date.now() - 30 * 86400000);
  if (!TANGGAL.test(dari) || !TANGGAL.test(sampai)) throw bad(400, 'Format tanggal harus YYYY-MM-DD');
  return { dari, sampai };
}

// Employees see only their own records; the owner sees everyone's (optionally one person).
function siapa(req) {
  if (req.isAdmin) return req.query.editor_id && /^\d+$/.test(req.query.editor_id) ? Number(req.query.editor_id) : null;
  return req.editor.id;
}

// GET /api/presensi/config — the owner gets everything; employees only the rules that affect them
router.get('/config', async (req, res) => {
  try {
    const cfg = await presensi.getConfig();
    const ip = clientIp(req);
    const ip_kantor = presensi.ipTerdaftar(ip, cfg.ips);
    if (req.isAdmin) return res.json({ ...cfg, ip_anda: ip, ip_saran: presensi.ipSaran(ip), ip_kantor, ip_kandidat: await presensi.kandidatIp(cfg) });
    res.json({ ...presensi.untukKaryawan(cfg), ip_anda: ip, ip_kantor });
  } catch (err) {
    fail(res, err);
  }
});

router.put('/config', requireAdmin, createAuditMiddleware('settings', 'presensi_config', () => 'presensi', null, (req) => req.body), async (req, res) => {
  try {
    const cfg = await presensi.saveConfig(req.body);
    const ip = clientIp(req);
    res.json({ ...cfg, ip_anda: ip, ip_saran: presensi.ipSaran(ip), ip_kantor: presensi.ipTerdaftar(ip, cfg.ips) });
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/presensi — an employee checks in or out; the server makes every decision.
router.post('/', requireEditor, userMutationLimiter, async (req, res) => {
  try {
    const row = await presensi.absen(req.editor, req.body, clientIp(req), req.headers['user-agent'], Date.now(), kabariIpBaru);
    res.status(201).json(row);
  } catch (err) {
    fail(res, err);
  }
});

// PUT /api/presensi/ip-kandidat {ip, ganti} — the owner accepts the suggested new office network.
router.put('/ip-kandidat', requireAdmin, createAuditMiddleware('settings', 'presensi_ip_baru', () => 'presensi', null, (req) => req.body), async (req, res) => {
  try {
    const { config, editorIds } = await presensi.pakaiKandidat(String((req.body || {}).ip || ''), !!(req.body || {}).ganti);
    // The people who were refused can try again right away.
    await Promise.all(editorIds.map((id) => push.kirim({ editorId: id }, { title: 'Wi-Fi kantor sudah diperbarui', body: 'Silakan absen lagi dari Wi-Fi kantor.', url: '/presensi', tag: 'absen' })));
    const ip = clientIp(req);
    res.json({ ...config, ip_anda: ip, ip_saran: presensi.ipSaran(ip), ip_kantor: presensi.ipTerdaftar(ip, config.ips), ip_kandidat: null });
  } catch (err) {
    fail(res, err);
  }
});

router.delete('/ip-kandidat', requireAdmin, async (req, res) => {
  try {
    await presensi.abaikanKandidat((req.body || {}).ip);
    res.status(204).end();
  } catch (err) {
    fail(res, err);
  }
});

router.get('/', async (req, res) => {
  try {
    res.json(await presensi.daftar({ ...rentang(req.query), editorId: siapa(req) }));
  } catch (err) {
    fail(res, err);
  }
});

router.get('/ditolak', async (req, res) => {
  try {
    res.json(await presensi.daftarDitolak({ ...rentang(req.query), editorId: siapa(req) }));
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
