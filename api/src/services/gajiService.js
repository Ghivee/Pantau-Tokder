const db = require('../config/db');
const { bad } = require('../utils/httpError');
const presensi = require('./presensiService');
const { rangeDays, isWorkday, addDays, validDate } = require('./pengajuanService');

// Monthly pay from real records only: presensi (attendance, lateness, overtime), approved leave
// and claims, the videos each person published, the owner's rules and manual adjustments.
// A month can be finalized: the calculation is then stored as is and no longer moves.

const CONFIG_KEY = 'gaji_config';
const DEFAULTS = { hari_kerja: [1, 2, 3, 4, 5, 6], libur: [], jatah_cuti: 12 };
const ATURAN = ['gaji_pokok', 'tunjangan', 'potongan_tetap', 'potong_alpa', 'potong_izin', 'potong_telat', 'tarif_lembur', 'bonus_video', 'bonus_1000_views'];
const BULAN = /^\d{4}-(0[1-9]|1[0-2])$/;
const LEMBUR_MIN = 30; // minutes after closing time before it counts as overtime
const LEMBUR_MAKS = 6 * 60; // a forgotten check-out cannot become a whole night of overtime

const keMenit = (jam) => { const [h, m] = String(jam).split(':').map(Number); return h * 60 + m; };
const wibDate = (t) => new Date(new Date(t).getTime() + 7 * 3600 * 1000);
const tglWib = (t) => wibDate(t).toISOString().slice(0, 10);
const menitWib = (t) => { const d = wibDate(t); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const akhirBulan = (b) => new Date(Date.UTC(+b.slice(0, 4), +b.slice(5, 7), 0)).toISOString().slice(0, 10);

async function getConfig() {
  const r = await db.query('SELECT value FROM settings WHERE key = $1', [CONFIG_KEY]);
  let saved = {};
  try { saved = r.rows[0] ? JSON.parse(r.rows[0].value) : {}; } catch (e) { saved = {}; }
  return { ...DEFAULTS, ...saved, tersimpan: !!r.rows[0] };
}

function validasiConfig(b = {}) {
  const hari = [...new Set((Array.isArray(b.hari_kerja) ? b.hari_kerja : []).map(Number))].filter((x) => Number.isInteger(x) && x >= 0 && x <= 6).sort();
  if (!hari.length) throw bad(400, 'Pilih minimal satu hari kerja');
  const libur = [...new Set((Array.isArray(b.libur) ? b.libur : String(b.libur || '').split(/[\s,;]+/)).map((x) => String(x).trim()).filter(Boolean))].sort();
  const salah = libur.find((d) => !validDate(d));
  if (salah) throw bad(400, `Tanggal libur "${salah}" tidak valid. Pakai format YYYY-MM-DD`);
  if (libur.length > 100) throw bad(400, 'Maksimal 100 tanggal libur');
  const jatah = Number(b.jatah_cuti);
  if (!Number.isInteger(jatah) || jatah < 0 || jatah > 60) throw bad(400, 'Jatah cuti harus 0–60 hari per tahun');
  return { hari_kerja: hari, libur, jatah_cuti: jatah };
}

function validasiAturan(b = {}) {
  const out = {};
  for (const k of ATURAN) {
    const v = b[k] === '' || b[k] == null ? 0 : Number(b[k]);
    if (!Number.isFinite(v) || v < 0 || v > 1e10) throw bad(400, 'Nilai gaji harus angka 0 atau lebih');
    out[k] = Math.round(v);
  }
  return out;
}

// The calculation for one person and one month. Pure, so it can be tested and re-run exactly.
function hitung({ bulan, editor, aturan, cfg, jam, presensiRows, cuti, klaim, penyesuaian, videos, mulaiPresensi, now = Date.now() }) {
  const a = { ...Object.fromEntries(ATURAN.map((k) => [k, 0])), ...(aturan || {}) };
  ATURAN.forEach((k) => { a[k] = Number(a[k]) || 0; });
  const awal = bulan + '-01', akhir = akhirBulan(bulan), hariIni = tglWib(now);
  const selesai = hariIni > akhir;
  const sampai = selesai ? akhir : hariIni;
  const dibuat = editor.created_at ? tglWib(editor.created_at) : awal;
  const presensiDipakai = !!mulaiPresensi && mulaiPresensi <= sampai;
  // Attendance counts only from the day presensi was first used and the person joined.
  const mulai = [awal, dibuat, presensiDipakai ? mulaiPresensi : awal].sort().pop();

  const masuk = new Map(), pulang = new Map();
  presensiRows.forEach((p) => (p.jenis === 'masuk' ? masuk : pulang).set(p.tanggal, p));
  const libur = new Map();
  cuti.forEach((c) => rangeDays(c.dari, c.sampai).forEach((d) => { if (!libur.has(d)) libur.set(d, c.jenis); }));

  const h = { kerja: 0, hadir: 0, alpa: 0, izin: 0, sakit: 0, cuti: 0, telat: 0, telat_menit: 0, lembur_menit: 0, alpa_tanggal: [] };
  rangeDays(mulai, akhir).forEach((d) => {
    if (!isWorkday(d, cfg)) return;
    if (d > sampai) return;
    if (masuk.has(d)) { h.kerja++; h.hadir++; return; }
    if (libur.has(d)) { h.kerja++; h[libur.get(d)]++; return; }
    // Today is not an absence until the day is over.
    if (d === hariIni || !presensiDipakai) return;
    h.kerja++; h.alpa++; h.alpa_tanggal.push(d);
  });
  masuk.forEach((p) => { if (p.telat_menit > 0) { h.telat++; h.telat_menit += p.telat_menit; } });
  pulang.forEach((p) => {
    const lebih = menitWib(p.waktu) - keMenit(jam.pulang);
    if (lebih >= LEMBUR_MIN) h.lembur_menit += Math.min(lebih, LEMBUR_MAKS);
  });

  // Video target follows the working days the person was expected in (approved leave excluded).
  const hariWajib = presensiDipakai ? h.hadir + h.alpa : rangeDays(mulai, sampai).filter((d) => d !== hariIni && isWorkday(d, cfg) && !libur.has(d)).length;
  const v = { jumlah: videos.length, target: (Number(editor.target_harian) || 0) * hariWajib, views: videos.reduce((s, x) => s + (Number(x.views) || 0), 0) };
  const lebihVideo = Math.max(0, v.jumlah - v.target);

  const baris = [];
  const add = (label, jumlah, ket = '', tampil = true) => { if (tampil) baris.push({ label, jumlah: Math.round(jumlah), ket }); };
  add('Gaji pokok', a.gaji_pokok);
  add('Tunjangan', a.tunjangan, '', a.tunjangan > 0);
  add('Lembur', (h.lembur_menit / 60) * a.tarif_lembur, `${Math.floor(h.lembur_menit / 60)} jam ${h.lembur_menit % 60} menit × Rp${a.tarif_lembur.toLocaleString('id-ID')}/jam`, a.tarif_lembur > 0 && h.lembur_menit > 0);
  add('Bonus video di atas target', lebihVideo * a.bonus_video, `${lebihVideo} video lebih dari target ${v.target}`, a.bonus_video > 0);
  add('Bonus views', Math.floor(v.views / 1000) * a.bonus_1000_views, `${v.views.toLocaleString('id-ID')} views video bulan ini`, a.bonus_1000_views > 0);
  klaim.forEach((k) => add('Klaim: ' + k.alasan, Number(k.jumlah) || 0, k.dari));
  penyesuaian.forEach((p) => add(p.keterangan, Number(p.jumlah), 'penyesuaian pemilik'));
  add('Potongan tidak hadir', -h.alpa * a.potong_alpa, `${h.alpa} hari tanpa absen dan tanpa izin`, a.potong_alpa > 0 && h.alpa > 0);
  add('Potongan izin', -h.izin * a.potong_izin, `${h.izin} hari izin`, a.potong_izin > 0 && h.izin > 0);
  add('Potongan telat', -h.telat * a.potong_telat, `${h.telat} kali telat, total ${h.telat_menit} menit`, a.potong_telat > 0 && h.telat > 0);
  add('Potongan tetap', -a.potongan_tetap, 'BPJS, kasbon, dll.', a.potongan_tetap > 0);
  const kotor = baris.reduce((s, b) => s + b.jumlah, 0);

  return {
    bulan, editor_id: editor.id, nama: editor.nama,
    periode: { dari: mulai, sampai, selesai }, presensi_dipakai: presensiDipakai,
    hari: h, video: v, aturan: a, aturan_diisi: ATURAN.some((k) => a[k] > 0),
    baris, total: Math.max(0, kotor), minus: kotor < 0,
    dihitung_at: new Date(now).toISOString(),
  };
}

// All data for one month in a few queries, then the calculation per person.
async function hitungBulan(bulan, { editorId = null, now = Date.now() } = {}) {
  if (!BULAN.test(bulan)) throw bad(400, 'Bulan harus berformat YYYY-MM');
  const awal = bulan + '-01', akhir = akhirBulan(bulan);
  const only = editorId ? ' AND editor_id = $3' : '';
  const p = editorId ? [awal, akhir, editorId] : [awal, akhir];
  const [cfg, pcfg, eds, aturan, pres, mulai, peng, peny, vids, fin] = await Promise.all([
    getConfig(),
    presensi.getConfig(),
    db.query(`SELECT id, nama, target_harian, status, created_at FROM editors${editorId ? ' WHERE id = $1' : ''} ORDER BY id`, editorId ? [editorId] : []),
    db.query(`SELECT * FROM gaji_aturan${editorId ? ' WHERE editor_id = $1' : ''}`, editorId ? [editorId] : []),
    db.query(`SELECT editor_id, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, jenis, waktu, telat_menit FROM presensi WHERE tanggal BETWEEN $1 AND $2${only}`, p),
    db.query(`SELECT to_char(MIN(tanggal), 'YYYY-MM-DD') AS d FROM presensi`),
    db.query(`SELECT editor_id, jenis, to_char(dari, 'YYYY-MM-DD') AS dari, to_char(sampai, 'YYYY-MM-DD') AS sampai, jumlah::float AS jumlah, alasan
              FROM pengajuan WHERE status = 'disetujui' AND dari <= $2 AND sampai >= $1${only}`, p),
    db.query(`SELECT id, editor_id, jumlah::float AS jumlah, keterangan, created_at FROM gaji_penyesuaian WHERE bulan = $1${editorId ? ' AND editor_id = $2' : ''} ORDER BY id`, editorId ? [bulan, editorId] : [bulan]),
    db.query(`SELECT editor_id, views FROM content WHERE editor_id IS NOT NULL
              AND (tanggal_upload + INTERVAL '7 hours')::date BETWEEN $1 AND $2${only}`, p),
    db.query(`SELECT editor_id, rincian, total::float AS total, final_at, dibayar_at FROM gaji_final WHERE bulan = $1${editorId ? ' AND editor_id = $2' : ''}`, editorId ? [bulan, editorId] : [bulan]),
  ]);
  const by = (rows, id) => rows.filter((r) => r.editor_id === id);
  const finals = Object.fromEntries(fin.rows.map((r) => [r.editor_id, r]));
  const list = [];
  for (const e of eds.rows) {
    const f = finals[e.id];
    if (f) {
      const rincian = typeof f.rincian === 'string' ? JSON.parse(f.rincian) : f.rincian;
      list.push({ ...rincian, status: 'final', final_at: f.final_at, dibayar_at: f.dibayar_at, penyesuaian: by(peny.rows, e.id) });
      continue;
    }
    if (e.status === 'nonaktif') continue;
    const r = hitung({
      bulan, editor: e, cfg, jam: { masuk: pcfg.jam_masuk, pulang: pcfg.jam_pulang, toleransi: pcfg.toleransi },
      aturan: aturan.rows.find((x) => x.editor_id === e.id),
      presensiRows: by(pres.rows, e.id),
      cuti: by(peng.rows, e.id).filter((x) => x.jenis !== 'klaim'),
      // A claim belongs to the month of its date.
      klaim: by(peng.rows, e.id).filter((x) => x.jenis === 'klaim' && x.dari.slice(0, 7) === bulan),
      penyesuaian: by(peny.rows, e.id),
      videos: by(vids.rows, e.id),
      mulaiPresensi: mulai.rows[0] && mulai.rows[0].d,
      now,
    });
    list.push({ ...r, status: 'draf', penyesuaian: by(peny.rows, e.id) });
  }
  return { bulan, config: cfg, list };
}

async function isFinal(editorId, bulan) {
  const r = await db.query('SELECT 1 FROM gaji_final WHERE editor_id = $1 AND bulan = $2', [editorId, bulan]);
  return r.rows.length > 0;
}

// Months touched by a date range, to refuse changes that would land in a finalized month.
async function bulanFinalDalam(editorId, dari, sampai) {
  const r = await db.query(
    `SELECT bulan FROM gaji_final WHERE editor_id = $1 AND bulan BETWEEN $2 AND $3 ORDER BY bulan LIMIT 1`,
    [editorId, dari.slice(0, 7), sampai.slice(0, 7)]
  );
  return r.rows[0] ? r.rows[0].bulan : null;
}

async function finalkan(bulan, editorIds, now = Date.now()) {
  if (!BULAN.test(bulan)) throw bad(400, 'Bulan harus berformat YYYY-MM');
  if (bulan > tglWib(now).slice(0, 7)) throw bad(400, 'Bulan yang belum berjalan tidak bisa difinalkan');
  const { list } = await hitungBulan(bulan, { now });
  const pilih = list.filter((x) => x.status === 'draf' && (!editorIds || editorIds.includes(x.editor_id)));
  if (!pilih.length) throw bad(409, 'Tidak ada gaji draf yang bisa difinalkan untuk bulan ini');
  const done = [];
  for (const r of pilih) {
    const { penyesuaian, status, ...rincian } = r;
    const q = await db.query(
      `INSERT INTO gaji_final (editor_id, bulan, rincian, total) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING editor_id`,
      [r.editor_id, bulan, JSON.stringify(rincian), r.total]
    );
    if (q.rows.length) done.push(r.editor_id);
  }
  return done;
}

async function bukaLagi(bulan, editorId) {
  const r = await db.query('DELETE FROM gaji_final WHERE editor_id = $1 AND bulan = $2 AND dibayar_at IS NULL RETURNING editor_id', [editorId, bulan]);
  if (!r.rows.length) {
    if (await isFinal(editorId, bulan)) throw bad(409, 'Gaji ini sudah ditandai dibayar. Batalkan tanda dibayar dulu.');
    throw bad(404, 'Gaji bulan ini belum final');
  }
}

async function tandaiDibayar(bulan, editorId, dibayar) {
  const r = await db.query(
    `UPDATE gaji_final SET dibayar_at = ${dibayar ? 'NOW()' : 'NULL'} WHERE editor_id = $1 AND bulan = $2 RETURNING dibayar_at`,
    [editorId, bulan]
  );
  if (!r.rows.length) throw bad(409, 'Finalkan gaji dulu sebelum menandai dibayar');
  return r.rows[0];
}

module.exports = {
  ATURAN, DEFAULTS, CONFIG_KEY, BULAN, getConfig, validasiConfig, validasiAturan, hitung, hitungBulan,
  isFinal, bulanFinalDalam, finalkan, bukaLagi, tandaiDibayar, akhirBulan, tglWib, addDays,
};
