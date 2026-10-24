import { clearSessionCookie } from '../../src/middlewares/sessionAuth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  clearSessionCookie(res);
  return res.json({ success: true, message: 'Logout berhasil' });
}