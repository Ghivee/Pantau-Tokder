const db = require('../config/db');
const { hashPin } = require('../middlewares/sessionAuth');

// Never send the PIN hash to the browser.
const PUBLIC_COLUMNS = `id, nama, kode_identifikasi, status, created_at, peran, jadwal, target_harian, foto_url,
  (pin IS NOT NULL AND pin <> '') AS punya_pin`;

function cleanJadwal(jadwal) {
  if (jadwal == null) return null;
  return String(jadwal)
    .split(/[\s,;]+/)
    .map((s) => s.trim().replace('.', ':'))
    .filter((s) => /^\d{1,2}:\d{2}$/.test(s))
    .map((s) => s.padStart(5, '0'))
    .sort()
    .join(',');
}

async function getAllEditors() {
  const result = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM editors ORDER BY id ASC`);
  return result.rows;
}

async function addEditor(nama, kode, extra = {}) {
  const result = await db.query(
    `INSERT INTO editors (nama, kode_identifikasi, peran, jadwal, target_harian, foto_url, pin)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${PUBLIC_COLUMNS}`,
    [
      nama, kode,
      extra.peran === 'terbatas' ? 'terbatas' : 'editor',
      cleanJadwal(extra.jadwal) || '',
      parseInt(extra.target_harian, 10) || 3,
      extra.foto_url || null,
      extra.pin ? hashPin(extra.pin) : null,
    ]
  );
  return result.rows[0];
}

async function updateEditor(id, nama, kode, extra = {}) {
  const sets = ['nama = $1', 'kode_identifikasi = $2'];
  const params = [nama, kode];
  const add = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };
  if (extra.peran !== undefined) add('peran', extra.peran === 'terbatas' ? 'terbatas' : 'editor');
  if (extra.jadwal !== undefined) add('jadwal', cleanJadwal(extra.jadwal) || '');
  if (extra.target_harian !== undefined && extra.target_harian !== '') add('target_harian', parseInt(extra.target_harian, 10) || 3);
  if (extra.foto_url !== undefined) add('foto_url', extra.foto_url || null);
  if (extra.status !== undefined) add('status', extra.status === 'nonaktif' ? 'nonaktif' : 'aktif');
  if (extra.pin) add('pin', hashPin(extra.pin));
  if (extra.hapus_pin) add('pin', null);
  params.push(id);
  const result = await db.query(
    `UPDATE editors SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${PUBLIC_COLUMNS}`,
    params
  );
  return result.rows[0];
}

async function deleteEditor(id) {
  // First, set all content by this editor to unmatched
  await db.query(
    "UPDATE content SET editor_id = NULL, status_identifikasi = 'unmatched' WHERE editor_id = $1",
    [id]
  );
  // Then delete the editor
  await db.query('DELETE FROM editors WHERE id = $1', [id]);
}

module.exports = { getAllEditors, addEditor, updateEditor, deleteEditor };
