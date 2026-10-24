import { adminPassword, createSessionPayload, setSessionCookie } from '../../src/middlewares/sessionAuth.js';
import { requireAdmin } from '../../src/middlewares/sessionAuth.js';
import db from '../../src/config/db.js';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  // Apply admin auth
  await new Promise((resolve, reject) => {
    requireAdmin(req, res, (err) => err ? reject(err) : resolve());
  }).catch(() => { return res.status(401).json({ error: 'Hanya pemilik yang bisa mengganti password' }); });
  
  const baru = String((req.body || {}).baru || '');
  if (baru.length < 8) return res.status(400).json({ error: 'Password baru minimal 8 karakter' });
  
  try {
    await db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('admin_password', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [baru]
    );
    const session = createSessionPayload({ type: 'admin', password: baru });
    setSessionCookie(res, session);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal menyimpan password' });
  }
}

export default handler;