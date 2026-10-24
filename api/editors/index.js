import { requireAnyAuth, requireAdmin } from '../../src/middlewares/sessionAuth.js';
import editorService from '../../src/services/editorService.js';
import { createAuditMiddleware } from '../../src/utils/auditLog.js';

const auditCreate = createAuditMiddleware('editor', 'create', (req, body) => body?.id);
const auditUpdate = createAuditMiddleware('editor', 'update', (req) => req.query.id, (req) => req.body);
const auditDelete = createAuditMiddleware('editor', 'delete', (req) => req.query.id);

async function handler(req, res) {
  // Apply auth middleware
  const authMiddleware = req.method === 'GET' ? requireAnyAuth : requireAdmin;
  await new Promise((resolve, reject) => {
    authMiddleware(req, res, (err) => err ? reject(err) : resolve());
  }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });

  if (req.method === 'GET') {
    try {
      const editors = await editorService.getAllEditors();
      return res.json(editors);
    } catch (err) {
      return res.status(500).json({ error: 'Gagal mengambil data karyawan' });
    }
  }

  if (req.method === 'POST') {
    await new Promise((resolve, reject) => auditCreate(req, res, (err) => err ? reject(err) : resolve())).catch(() => {});
    try {
      const { nama, kode, extra } = validate(req.body);
      const editor = await editorService.addEditor(nama, kode, extra);
      return res.status(201).json(editor);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function validate(body) {
  const b = body || {};
  const nama = String(b.nama || '').trim();
  const kode = String(b.kode || '').trim().toUpperCase().replace(/^#/, '');
  if (!nama || nama.length > 100) throw new Error('Nama wajib diisi (maksimal 100 karakter)');
  if (!/^[A-Z0-9]{2,10}$/.test(kode)) throw new Error('Kode harus 2–10 huruf/angka, misal AL');
  if (b.peran !== undefined && !['editor', 'terbatas'].includes(b.peran)) throw new Error('Peran tidak dikenal');
  if (b.status !== undefined && !['aktif', 'nonaktif'].includes(b.status)) throw new Error('Status tidak dikenal');
  if (b.target_harian !== undefined) {
    const t = Number(b.target_harian);
    if (!Number.isInteger(t) || t < 1 || t > 50) throw new Error('Target harian harus 1–50 video');
  }
  if (b.foto_url && !/^https:\/\/\S+$/i.test(b.foto_url)) throw new Error('Link foto harus diawali https://');
  if (b.pin && !/^\d{4,12}$/.test(String(b.pin))) throw new Error('PIN harus 4–12 angka');
  if (b.jadwal && String(b.jadwal).split(/[\s,;]+/).filter(Boolean).some((x) => !/^([01]?\d|2[0-3])[:.][0-5]\d$/.test(x))) {
    throw new Error('Jadwal harus jam WIB seperti 06:00, 12:30 (pisahkan dengan koma)');
  }
  return { nama, kode, extra: b };
}

export default handler;