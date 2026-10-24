import { parseSessionCookie } from '../../src/middlewares/sessionAuth.js';

export default function handler(req, res) {
  const session = parseSessionCookie(req);
  if (!session) return res.json({ authenticated: false });
  
  if (session.type === 'admin') {
    return res.json({ authenticated: true, type: 'admin' });
  }
  if (session.type === 'karyawan') {
    return res.json({ authenticated: true, type: 'karyawan', id: session.id, nama: session.nama, peran: session.peran });
  }
  return res.json({ authenticated: false });
}