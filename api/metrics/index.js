import { requireAnyAuth } from '../../src/middlewares/sessionAuth.js';
import metricsService from '../../src/services/metricsService.js';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    requireAnyAuth(req, res, (err) => err ? reject(err) : resolve());
  }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });

  try {
    if (req.url.includes('/summary')) {
      const summary = await metricsService.getSummary();
      return res.json(summary);
    }
    if (req.url.includes('/trend')) {
      const trend = await metricsService.getTrend();
      return res.json(trend);
    }
    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal mengambil metrik' });
  }
}

export default handler;