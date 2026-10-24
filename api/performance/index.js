import { requireAnyAuth, requireAdmin } from '../../src/middlewares/sessionAuth.js';
import { computeDailyScore, computePeriodScore, getAllEditorScores, todayWib, addDays } from '../../src/services/performanceService.js';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    req.url.includes('/all') || req.url.includes('/leaderboard') ? requireAdmin(req, res, (err) => err ? reject(err) : resolve()) : requireAnyAuth(req, res, (err) => err ? reject(err) : resolve());
  }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });

  try {
    if (req.url.includes('/daily')) {
      const editorId = req.isAdmin ? Number(req.query.editor_id) : (req.editor && req.editor.id);
      const day = req.query.day || todayWib();
      if (!editorId) return res.status(400).json({ error: 'editor_id diperlukan' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ error: 'Format hari harus YYYY-MM-DD' });
      if (!req.isAdmin && editorId !== req.editor.id) return res.status(403).json({ error: 'Tidak bisa melihat skor karyawan lain' });
      const result = await computeDailyScore(editorId, day);
      if (!result) return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
      return res.json(result);
    }

    if (req.url.includes('/period')) {
      const editorId = req.isAdmin ? Number(req.query.editor_id) : (req.editor && req.editor.id);
      const days = Math.min(90, Math.max(1, parseInt(req.query.days || '7', 10)));
      if (!editorId) return res.status(400).json({ error: 'editor_id diperlukan' });
      if (!req.isAdmin && editorId !== req.editor.id) return res.status(403).json({ error: 'Tidak bisa melihat skor karyawan lain' });
      const result = await computePeriodScore(editorId, days);
      if (!result) return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
      return res.json(result);
    }

    if (req.url.includes('/all')) {
      const days = Math.min(90, Math.max(1, parseInt(req.query.days || '7', 10)));
      const results = await getAllEditorScores(days);
      return res.json({ days, editors: results });
    }

    if (req.url.includes('/leaderboard')) {
      const days = Math.min(90, Math.max(1, parseInt(req.query.days || '7', 10)));
      const results = await getAllEditorScores(days);
      const ranked = results.filter(r => r.skor != null).sort((a, b) => b.skor - a.skor).map((r, i) => ({ rank: i + 1, ...r }));
      return res.json({ days, leaderboard: ranked });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal menghitung skor' });
  }
}

export default handler;