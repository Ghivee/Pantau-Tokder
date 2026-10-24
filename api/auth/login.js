import { createSessionPayload, setSessionCookie } from '../../src/middlewares/sessionAuth.js';
import { adminPassword } from '../../src/middlewares/sessionAuth.js';
import db from '../../src/config/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password is required' });

  try {
    const result = await db.query(`SELECT value FROM settings WHERE key = 'admin_password'`);
    const correctPassword = result.rows.length > 0 && result.rows[0].value ? result.rows[0].value : 'admin123';
    
    if (password === correctPassword) {
      const session = createSessionPayload({ type: 'admin', password });
      setSessionCookie(res, session);
      return res.json({ success: true, message: 'Login berhasil', role: 'admin' });
    }
    return res.status(401).json({ error: 'Password salah' });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memverifikasi password' });
  }
}