const db = require('../config/db');
const { bad } = require('../utils/httpError');
const { todayWib } = require('./presensiService');

// Leave and expense claims. Employees ask; only the owner approves or refuses.
const JENIS = { izin: 'Izin', sakit: 'Sakit', cuti: 'Cuti', klaim: 'Klaim biaya' };
const CUTI = ['izin', 'sakit', 'cuti'];
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const KOLOM = `id, editor_id, jenis, to_char(dari, 'YYYY-MM-DD') AS dari, to_char(sampai, 'YYYY-MM-DD') AS sampai,
  jumlah::float AS jumlah, alasan, status, catatan, diputus_at, created_at`;

const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const validDate = (d) => TANGGAL.test(d) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;

function rangeDays(dari, sampai) {
  const out = [];
  for (let d = dari; d <= sampai && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}
const isWorkday = (d, cfg) => cfg.hari_kerja.includes(new Date(d + 'T00:00:00Z').getUTCDay()) && !cfg.libur.includes(d);
const workdaysIn = (dari, sampai, cfg) => rangeDays(dari, sampai).filter((d) => isWorkday(d, cfg));

function validasi(body) {
  const b = body || {};
  const jenis = String(b.jenis || '');
  if (!JENIS[jenis]) throw bad(400, 'Pilih jenis pengajuan: izin, sakit, cuti atau klaim biaya');
  const dari = String(b.dari || '');
  const sampai = jenis === 'klaim' ? dari : String(b.sampai || b.dari || '');
  if (!validDate(dari) || !validDate(sampai)) throw bad(400, 'Tanggal harus diisi dengan benar');
  if (sampai < dari) throw bad(400, 'Tanggal selesai tidak boleh sebelum tanggal mulai');
  const now = todayWib();
  if (dari < addDays(now, -60)) throw bad(400, 'Pengajuan paling lama untuk 60 hari ke belakang');
  if (sampai > addDays(now, jenis === 'klaim' ? 0 : 180)) throw bad(400, jenis === 'klaim' ? 'Tanggal klaim tidak boleh di masa depan' : 'Pengajuan paling jauh 180 hari ke depan');
  if (rangeDays(dari, sampai).length > 60) throw bad(400, 'Satu pengajuan paling lama 60 hari');
  const alasan = String(b.alasan || '').trim();
  if (alasan.length < 3) throw bad(400, jenis === 'klaim' ? 'Tulis untuk apa biaya ini' : 'Tulis alasannya');
  if (alasan.length > 300) throw bad(400, 'Alasan maksimal 300 karakter');
  let jumlah = null;
  if (jenis === 'klaim') {
    jumlah = Math.round(Number(b.jumlah));
    if (!Number.isFinite(jumlah) || jumlah < 1000 || jumlah > 100000000) throw bad(400, 'Jumlah klaim harus Rp1.000 sampai Rp100.000.000');
  }
  return { jenis, dari, sampai, jumlah, alasan };
}

// Approved leave days this calendar year, counting workdays only.
async function cutiTerpakai(editorId, tahun, cfg, kecuali = null) {
  const r = await db.query(
    `SELECT to_char(dari, 'YYYY-MM-DD') AS dari, to_char(sampai, 'YYYY-MM-DD') AS sampai FROM pengajuan
     WHERE editor_id = $1 AND jenis = 'cuti' AND status = 'disetujui' AND sampai >= $2 AND dari <= $3 AND id IS DISTINCT FROM $4`,
    [editorId, tahun + '-01-01', tahun + '-12-31', kecuali]
  );
  return r.rows.reduce((s, x) => s + workdaysIn(x.dari < tahun + '-01-01' ? tahun + '-01-01' : x.dari, x.sampai > tahun + '-12-31' ? tahun + '-12-31' : x.sampai, cfg).length, 0);
}

async function ajukan(editor, body, cfg) {
  const p = validasi(body);
  if (CUTI.includes(p.jenis)) {
    if (!workdaysIn(p.dari, p.sampai, cfg).length) throw bad(400, 'Tanggal yang dipilih bukan hari kerja');
    const bentrok = await db.query(
      `SELECT jenis FROM pengajuan WHERE editor_id = $1 AND jenis = ANY($2) AND status <> 'ditolak' AND dari <= $4 AND sampai >= $3 LIMIT 1`,
      [editor.id, CUTI, p.dari, p.sampai]
    );
    if (bentrok.rows.length) throw bad(409, `Sudah ada pengajuan ${JENIS[bentrok.rows[0].jenis].toLowerCase()} di tanggal itu`);
  }
  if (p.jenis === 'cuti') {
    const tahun = p.dari.slice(0, 4);
    if (p.sampai.slice(0, 4) !== tahun) throw bad(400, 'Pisahkan cuti yang melewati pergantian tahun menjadi dua pengajuan');
    const sisa = cfg.jatah_cuti - (await cutiTerpakai(editor.id, tahun, cfg));
    const minta = workdaysIn(p.dari, p.sampai, cfg).length;
    if (minta > sisa) throw bad(400, `Sisa cuti ${tahun} tinggal ${Math.max(0, sisa)} hari kerja, yang diminta ${minta} hari`);
  }
  const r = await db.query(
    `INSERT INTO pengajuan (editor_id, jenis, dari, sampai, jumlah, alasan) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${KOLOM}`,
    [editor.id, p.jenis, p.dari, p.sampai, p.jumlah, p.alasan]
  );
  return r.rows[0];
}

async function daftar({ editorId } = {}) {
  const params = [addDays(todayWib(), -120)];
  let sql = `SELECT ${KOLOM} FROM pengajuan WHERE (sampai >= $1 OR status = 'menunggu')`;
  if (editorId) { params.push(editorId); sql += ' AND editor_id = $2'; }
  return (await db.query(sql + ' ORDER BY created_at DESC LIMIT 300', params)).rows;
}

async function sisaCuti(cfg, editorId = null) {
  const tahun = todayWib().slice(0, 4);
  const awal = tahun + '-01-01', akhir = tahun + '-12-31';
  const [eds, rows] = await Promise.all([
    db.query(`SELECT id FROM editors WHERE status <> 'nonaktif'${editorId ? ' AND id = $1' : ''}`, editorId ? [editorId] : []),
    db.query(
      `SELECT editor_id, to_char(dari, 'YYYY-MM-DD') AS dari, to_char(sampai, 'YYYY-MM-DD') AS sampai FROM pengajuan
       WHERE jenis = 'cuti' AND status = 'disetujui' AND sampai >= $1 AND dari <= $2`,
      [awal, akhir]
    ),
  ]);
  const out = {};
  eds.rows.forEach((e) => { out[e.id] = { jatah: cfg.jatah_cuti, terpakai: 0 }; });
  rows.rows.forEach((x) => { if (out[x.editor_id]) out[x.editor_id].terpakai += workdaysIn(x.dari < awal ? awal : x.dari, x.sampai > akhir ? akhir : x.sampai, cfg).length; });
  return out;
}

module.exports = { JENIS, CUTI, KOLOM, validasi, ajukan, daftar, sisaCuti, cutiTerpakai, rangeDays, workdaysIn, isWorkday, addDays, validDate };
