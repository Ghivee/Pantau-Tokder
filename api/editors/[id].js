import { requireAdmin } from '../../src/middlewares/sessionAuth.js';
import editorService from '../../src/services/editorService.js';
import { createAuditMiddleware } from '../../src/utils/auditLog.js';

const auditUpdate = createAuditMiddleware('editor', 'update', (req) => req.query.id, (req) => req.body);
const auditDelete = createAuditMiddleware('editor', 'delete', (req) => req.query.id);

async function handler(req, res) {
  await new Promise((resolve, reject) => {
    requireAdmin(req, res, (err) => err ? reject(err) : resolve());
  }).catch(() => { return res.status(401).json({ error: 'Unauthorized' }); });

  const { id } = req.query;

  if (req.method === 'PUT') {
    await new Promise((resolve, reject) => auditUpdate(req, res, (err) => err ? reject(err) : resolve())).catch(() => {});
    try {
      if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'ID karyawan tidak valid' });
      const { nama, kode, extra } = validate(req.body);
      const editor = await editorService.updateEditor(id, nama, kode, extra);
      if (!editor) return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
      return res.json(editor);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    await new Promise((resolve, reject) => auditDelete(req, res, (err) => err ? reject(err) : resolve())).catch(() => {});
    try {
      await editorService.deleteEditor(id);
      return res.status(204).send();
    } catch (err) {
      return res.status(500).json({ error: 'Gagal menghapus karyawan' });
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