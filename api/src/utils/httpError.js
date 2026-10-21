// Turns an error into an HTTP answer the app can show to people, and logs the detail.
function fail(res, err, fallback = 'Terjadi kesalahan di server. Coba lagi sebentar lagi.') {
  const code = err && err.code;
  const msg = (err && err.message) || '';
  if (err && err.status && err.expose) return res.status(err.status).json({ error: msg });
  if (code === '23505') return res.status(409).json({ error: 'Data yang sama sudah ada (misalnya kode karyawan sudah dipakai).' });
  if (code === '23503') return res.status(400).json({ error: 'Data terkait tidak ditemukan.' });
  if (['22P02', '22007', '22008', '22003'].includes(code)) return res.status(400).json({ error: 'Format data tidak valid.' });
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '57P01', '53300'].includes(code) || /Koneksi database|connect|timeout/i.test(msg)) {
    console.error('Database unavailable:', msg);
    return res.status(503).json({ error: 'Database sedang tidak bisa dihubungi. Coba lagi sebentar lagi.' });
  }
  console.error(err);
  return res.status(500).json({ error: fallback });
}

// An error whose message is safe to show as is.
function bad(status, message) {
  const e = new Error(message);
  e.status = status;
  e.expose = true;
  return e;
}

module.exports = { fail, bad };
