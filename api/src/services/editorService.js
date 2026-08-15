const db = require('../config/db');

async function getAllEditors() {
  const result = await db.query('SELECT * FROM editors ORDER BY id ASC');
  return result.rows;
}

async function addEditor(nama, kode) {
  const result = await db.query(
    'INSERT INTO editors (nama, kode_identifikasi) VALUES ($1, $2) RETURNING *',
    [nama, kode]
  );
  return result.rows[0];
}

async function updateEditor(id, nama, kode) {
  const result = await db.query(
    'UPDATE editors SET nama = $1, kode_identifikasi = $2 WHERE id = $3 RETURNING *',
    [nama, kode, id]
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
