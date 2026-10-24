import { requireAnyAuth, requireAdmin } from '../../src/middlewares/sessionAuth.js';
import { createAuditMiddleware } from '../../src/utils/auditLog.js';
import db from '../../src/config/db.js';
import { getChannelIds, getChannelNames, saveChannels } from '../../src/services/channelService.js';

const auditUpdate = createAuditMiddleware('channel', 'update_channels', (req, body) => JSON.stringify(body?.channels || []));

async function handler(req, res) {
  if (req.method === 'GET') {
    await new Promise((resolve, reject) => {
      requireAnyAuth(req, res, (err) => err ? reject(err) : resolve());
    }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });

    try {
      const [ids, names, seen] = await Promise.all([
        getChannelIds(),
        getChannelNames(),
        db.query(
          `SELECT channel_id, MAX(channel_nama) AS nama, COUNT(*)::int AS jumlah_video
           FROM content WHERE channel_id IS NOT NULL GROUP BY channel_id`
        ),
      ]);
      const byId = Object.fromEntries(seen.rows.map((r) => [r.channel_id, r]));
      return res.json(ids.map((id) => ({
        id,
        nama: names[id] || (byId[id] && byId[id].nama) || id,
        jumlah_video: (byId[id] && byId[id].jumlah_video) || 0,
      })));
    } catch (err) {
      return res.status(500).json({ error: 'Gagal mengambil channel' });
    }
  }

  if (req.method === 'PUT') {
    await new Promise((resolve, reject) => {
      requireAdmin(req, res, (err) => err ? reject(err) : resolve());
    }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });

    await new Promise((resolve, reject) => auditUpdate(req, res, (err) => err ? reject(err) : resolve())).catch(() => {});

    try {
      const inputs = Array.isArray((req.body || {}).channels) ? req.body.channels : [];
      const list = await saveChannels(inputs);
      return res.json(list);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;