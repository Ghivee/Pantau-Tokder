const express = require('express');
const router = express.Router();
const { fail } = require('../utils/httpError');
const push = require('../services/pushService');
const { userMutationLimiter } = require('../middlewares/rateLimit');

// GET /api/push — the public key the browser needs, and how many devices this person has on
router.get('/', async (req, res) => {
  try {
    const [k, st] = await Promise.all([push.kunci(), push.status(req)]);
    res.json({ publicKey: k.publicKey, ...st });
  } catch (err) {
    fail(res, err);
  }
});

router.post('/langganan', userMutationLimiter, async (req, res) => {
  try {
    await push.simpan(req, req.body && req.body.subscription, req.body && req.body.perangkat);
    res.status(201).json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

router.delete('/langganan', async (req, res) => {
  try {
    await push.hapus(req.body && req.body.endpoint);
    res.status(204).end();
  } catch (err) {
    fail(res, err);
  }
});

// A test message to this person's own devices.
router.post('/coba', userMutationLimiter, async (req, res) => {
  try {
    const n = await push.kirim(req.isAdmin ? { admin: true } : { editorId: req.editor.id }, { title: 'Notifikasi Tokder aktif', body: 'Contoh pesan: notifikasi di perangkat ini sudah berjalan.', url: '/' });
    res.json({ terkirim: n });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
