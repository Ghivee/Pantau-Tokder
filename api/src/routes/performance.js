const express = require('express');
const router = express.Router();
const { fail, bad } = require('../utils/httpError');
const { requireAnyAuth, requireAdmin } = require('../middlewares/sessionAuth');
const { computeDailyScore, computePeriodScore, getAllEditorScores, todayWib, addDays } = require('../services/performanceService');

// GET /api/performance/daily?editor_id=1&day=2024-01-15
router.get('/daily', requireAnyAuth, async (req, res) => {
  try {
    const editorId = req.isAdmin ? Number(req.query.editor_id) : (req.editor && req.editor.id);
    const day = req.query.day || todayWib();
    
    if (!editorId) return res.status(400).json({ error: 'editor_id diperlukan' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ error: 'Format hari harus YYYY-MM-DD' });
    
    // Non-admin can only see their own score
    if (!req.isAdmin && editorId !== req.editor.id) {
      return res.status(403).json({ error: 'Tidak bisa melihat skor karyawan lain' });
    }

    const result = await computeDailyScore(editorId, day);
    if (!result) return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
    
    res.json(result);
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/performance/period?editor_id=1&days=7
router.get('/period', requireAnyAuth, async (req, res) => {
  try {
    const editorId = req.isAdmin ? Number(req.query.editor_id) : (req.editor && req.editor.id);
    const days = Math.min(90, Math.max(1, parseInt(req.query.days || '7', 10)));
    
    if (!editorId) return res.status(400).json({ error: 'editor_id diperlukan' });
    
    if (!req.isAdmin && editorId !== req.editor.id) {
      return res.status(403).json({ error: 'Tidak bisa melihat skor karyawan lain' });
    }

    const result = await computePeriodScore(editorId, days);
    if (!result) return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
    
    res.json(result);
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/performance/all?days=7 — Admin only, get all editors' period scores
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days || '7', 10)));
    const results = await getAllEditorScores(days);
    res.json({ days, editors: results });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/performance/leaderboard?days=7 — Admin only, ranked scores
router.get('/leaderboard', requireAdmin, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days || '7', 10)));
    const results = await getAllEditorScores(days);
    
    const ranked = results
      .filter(r => r.skor != null)
      .sort((a, b) => b.skor - a.skor)
      .map((r, i) => ({ rank: i + 1, ...r }));
    
    res.json({ days, leaderboard: ranked });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;