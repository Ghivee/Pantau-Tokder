import { createSessionPayload, setSessionCookie, verifyPin } from '../../src/middlewares/sessionAuth.js';
import db from '../../src/config/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { editor_id, pin } = req.body || {};
  if (!editor_id || !pin) return res.status(400).json({ error: 'Pilih nama dan isi PIN' });
  
  try {
    const result = await db.query(
      `SELECT id, nama, peran, pin, foto_url FROM editors WHERE id = $1 AND status = 'aktif'`,
      [editor_id]
    );
    const row = result.rows[0];
    if (!row || !row.pin) return res.status(401).json({ error: 'PIN belum diatur untuk karyawan ini. Minta pemilik mengaturnya.' });
    if (!verifyPin(pin, row.pin)) return res.status(401).json({ error: 'PIN salah' });
    
    const session = createSessionPayload({ type: 'karyawan', id: row.id, nama: row.nama, peran: row.peran || 'editor', pin });
    setSessionCookie(res, session);
    return res.json({ id: row.id, nama: row.nama, peran: row.peran || 'editor', foto_url: row.foto_url });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memverifikasi PIN' });
  }
}