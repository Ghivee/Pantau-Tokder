// Kalender aktivitas sebulan: menggabungkan data yang sudah ada (presensi, izin, video, unggahan, tugas) per tanggal
// dan per orang. Karyawan hanya mendapat miliknya sendiri; ringkasan Jejak hanya dihitung untuk pemilik.
const db = require('../config/db');
const presensi = require('./presensiService');
const kalender = require('./kalenderService');
const { bad } = require('../utils/httpError');

const BULAN = /^\d{4}-(0[1-9]|1[0-2])$/;
const WIB = 7 * 3600 * 1000;
const keWib = (v) => new Date(new Date(v).getTime() + WIB).toISOString();
const tanggalWib = (v) => keWib(v).slice(0, 10);
const jamWib = (v) => keWib(v).slice(11, 16);

function tanggalSebulan(bulan) {
  const [y, m] = bulan.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${bulan}-${String(i + 1).padStart(2, '0')}`);
}

// Status kehadiran satu orang pada satu tanggal, mengikuti aturan yang sama dengan hitungan gaji:
// tidak hadir baru dihitung sejak presensi dipakai dan orangnya terdaftar.
function statusHari({ tanggal, hariIni, masuk, izin, buka, mulai }) {
  if (masuk) return masuk.telat_menit > 0 ? 'telat' : 'hadir';
  if (izin) return izin;
  if (!buka) return 'libur';
  if (tanggal > hariIni || !mulai || tanggal < mulai) return '';
  return tanggal === hariIni ? 'belum' : 'alpa';
}

// Ringkasan catatan Jejak satu orang dalam satu hari: cukup untuk melihat sekilas; rinciannya tetap di halaman Jejak.
function ringkasJejak(baris) {
  const unik = (a) => [...new Set(a.filter(Boolean))];
  const urut = baris.map((b) => b.waktu).sort((a, b) => new Date(a) - new Date(b));
  const hitung = (f) => baris.filter(f).length;
  return {
    jumlah: baris.length,
    awal: jamWib(urut[0]),
    akhir: jamWib(urut[urut.length - 1]),
    masuk: hitung((b) => b.jenis === 'masuk' && b.hasil === 'ok'),
    gagal: hitung((b) => b.jenis === 'gagal'),
    sensitif: hitung((b) => b.jenis === 'sensitif'),
    perubahan: hitung((b) => b.jenis === 'perubahan'),
    peringatan: hitung((b) => b.risiko >= 30),
    perangkat: unik(baris.map((b) => (b.browser ? b.browser + (b.os ? ' · ' + b.os : '') : ''))).slice(0, 4),
    lokasi: unik(baris.map((b) => b.kota || b.negara)).slice(0, 4),
  };
}

async function sebulan(bulan, { admin = false, editorId = null, now = Date.now() } = {}) {
  if (!BULAN.test(String(bulan || ''))) throw bad(400, 'Bulan harus berformat YYYY-MM');
  if (!admin && !editorId) throw bad(403, 'Tidak diizinkan');
  const hari = tanggalSebulan(bulan);
  const awal = hari[0], akhir = hari[hari.length - 1], hariIni = tanggalWib(now);
  const p = editorId ? [awal, akhir, editorId] : [awal, akhir];
  const saya = (kolom) => (editorId ? ` AND ${kolom} = $3` : '');
  const wib = (kolom) => `(${kolom} + INTERVAL '7 hours')::date`;
  // Kolom waktu tanpa zona disimpan dalam UTC; jam WIB dihitung di database supaya tidak bergantung zona server.
  const jam = (kolom) => `to_char(${kolom} + INTERVAL '7 hours', 'HH24:MI') AS jam`;

  const [cfg, eds, mulai, pres, tolak, izin, video, unggah, target, tugas, jejak] = await Promise.all([
    presensi.getConfig(),
    db.query(`SELECT id, nama, status, to_char(created_at + INTERVAL '7 hours', 'YYYY-MM-DD') AS dibuat, akun_master FROM editors ${editorId ? 'WHERE id = $1' : `WHERE status = 'aktif'`} ORDER BY id`, editorId ? [editorId] : []),
    db.query(`SELECT to_char(MIN(tanggal), 'YYYY-MM-DD') AS d FROM presensi`),
    db.query(`SELECT editor_id, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, jenis, ${jam('waktu')}, telat_menit, jarak FROM presensi WHERE tanggal BETWEEN $1 AND $2${saya('editor_id')}`, p),
    db.query(`SELECT editor_id, ${wib('waktu')}::text AS tanggal, jenis, ${jam('waktu')}, alasan FROM presensi_ditolak WHERE ${wib('waktu')} BETWEEN $1 AND $2${saya('editor_id')} ORDER BY waktu`, p),
    db.query(`SELECT editor_id, jenis, status, to_char(dari, 'YYYY-MM-DD') AS dari, to_char(sampai, 'YYYY-MM-DD') AS sampai, jumlah::float AS jumlah, alasan
              FROM pengajuan WHERE dari <= $2 AND sampai >= $1 AND status <> 'dibatalkan'${saya('editor_id')} ORDER BY id`, p),
    db.query(`SELECT editor_id, ${wib('tanggal_upload')}::text AS tanggal, ${jam('tanggal_upload')}, judul, url, views, channel_nama, tipe_video
              FROM content WHERE tanggal_upload IS NOT NULL AND ${wib('tanggal_upload')} BETWEEN $1 AND $2${saya('editor_id')} ORDER BY tanggal_upload`, p),
    db.query(`SELECT id, editor_id, ${wib('created_at')}::text AS tanggal, ${jam('created_at')}, judul FROM posting WHERE ${wib('created_at')} BETWEEN $1 AND $2${saya('editor_id')} ORDER BY created_at`, p),
    db.query(`SELECT t.posting_id, t.platform, t.status FROM posting_target t JOIN posting p ON p.id = t.posting_id WHERE ${wib('p.created_at')} BETWEEN $1 AND $2${saya('p.editor_id')} ORDER BY t.id`, p),
    db.query(`SELECT editor_id, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, jam, tugas, detail, jumlah FROM aktivitas WHERE tanggal BETWEEN $1 AND $2${saya('editor_id')} ORDER BY tanggal, jam`, p),
    admin && !editorId
      ? db.query(`SELECT (waktu AT TIME ZONE 'Asia/Jakarta')::date::text AS tanggal, waktu, jenis, hasil, risiko, pengguna_tipe, pengguna_id, pengguna_nama, akun, browser, os, kota, negara
                  FROM jejak WHERE (waktu AT TIME ZONE 'Asia/Jakarta')::date BETWEEN $1 AND $2 AND jenis <> 'sistem' ORDER BY id`, [awal, akhir])
      : Promise.resolve(null),
  ]);

  const libur = kalender.daftarLibur(cfg);
  const mulaiPresensi = mulai.rows[0] && mulai.rows[0].d;
  const orang = eds.rows.map((e) => ({ id: e.id, nama: e.nama, akun: e.akun_master, dibuat: e.dibuat || awal }));
  const idOrang = new Set(orang.map((o) => o.id));
  // Catatan Jejak milik karyawan: dari login Tokder (id karyawan) atau dari Office (akun yang dipetakan).
  const pemilikJejak = (b) => {
    if (b.pengguna_tipe === 'karyawan' && idOrang.has(b.pengguna_id)) return b.pengguna_id;
    const akun = String(b.akun || '').toLowerCase().split('@')[0];
    const cocok = akun && orang.find((o) => o.akun === akun);
    return cocok ? cocok.id : null;
  };

  const petakan = (rows, kunci) => rows.reduce((m, r) => { const k = kunci(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); return m; }, new Map());
  const k = (r) => r.editor_id + '|' + r.tanggal;
  const mPres = petakan(pres.rows, k), mTolak = petakan(tolak.rows, k), mVideo = petakan(video.rows, k), mUnggah = petakan(unggah.rows, k), mTugas = petakan(tugas.rows, k);
  const mTarget = petakan(target.rows, (r) => r.posting_id);
  const mJejak = petakan((jejak ? jejak.rows : []), (b) => { const id = pemilikJejak(b); return id ? id + '|' + b.tanggal : 'lain|' + b.tanggal; });

  const bentukVideo = (v) => ({ jam: v.jam, judul: v.judul, url: v.url, views: v.views, channel: v.channel_nama, tipe: v.tipe_video });
  const bentukUnggah = (u) => ({ jam: u.jam, judul: u.judul, tujuan: (mTarget.get(u.id) || []).map((t) => ({ platform: t.platform, status: t.status })) });

  const hasil = hari.map((tanggal) => {
    const buka = !!kalender.jamPada(cfg, tanggal, libur);
    const daftar = orang.map((o) => {
      const kk = o.id + '|' + tanggal;
      const hadir = mPres.get(kk) || [];
      const masuk = hadir.find((x) => x.jenis === 'masuk'), pulang = hadir.find((x) => x.jenis === 'pulang');
      const pengajuan = izin.rows.filter((x) => x.editor_id === o.id && x.dari <= tanggal && x.sampai >= tanggal);
      const cuti = pengajuan.find((x) => x.status === 'disetujui' && ['izin', 'sakit', 'cuti'].includes(x.jenis));
      const mulaiOrang = mulaiPresensi ? [mulaiPresensi, o.dibuat].sort().pop() : null;
      const baris = {
        id: o.id,
        status: statusHari({ tanggal, hariIni, masuk, izin: cuti && buka ? cuti.jenis : null, buka, mulai: mulaiOrang }),
        masuk: masuk ? { jam: masuk.jam, telat: masuk.telat_menit || 0, jarak: masuk.jarak == null ? null : Math.round(masuk.jarak) } : null,
        pulang: pulang ? { jam: pulang.jam, jarak: pulang.jarak == null ? null : Math.round(pulang.jarak) } : null,
        ditolak: (mTolak.get(kk) || []).map((x) => ({ jam: x.jam, jenis: x.jenis, alasan: x.alasan })),
        // Klaim hanya ditampilkan pada tanggalnya sendiri; izin dan cuti pada setiap tanggal yang dicakup.
        pengajuan: pengajuan.map((x) => ({ jenis: x.jenis, status: x.status, alasan: x.alasan, jumlah: x.jumlah })),
        video: (mVideo.get(kk) || []).map(bentukVideo),
        unggah: (mUnggah.get(kk) || []).map(bentukUnggah),
        tugas: (mTugas.get(kk) || []).map((x) => ({ jam: x.jam, tugas: x.tugas, detail: x.detail, jumlah: x.jumlah })),
      };
      if (jejak) baris.jejak = mJejak.has(kk) ? ringkasJejak(mJejak.get(kk)) : null;
      return baris;
    });
    const out = { tanggal, libur: buka ? null : libur[tanggal] || (new Date(tanggal + 'T00:00:00Z').getUTCDay() === 0 ? 'Minggu' : 'Hari libur'), orang: daftar };
    if (admin && !editorId) {
      const lain = mJejak.get('lain|' + tanggal) || [];
      out.lain = {
        // Video dan unggahan yang tidak terikat pada karyawan mana pun.
        video: video.rows.filter((v) => v.tanggal === tanggal && !idOrang.has(v.editor_id)).map(bentukVideo),
        unggah: unggah.rows.filter((u) => u.tanggal === tanggal && !idOrang.has(u.editor_id)).map(bentukUnggah),
        jejak: [...petakan(lain, (b) => b.pengguna_nama || 'Tidak dikenal')].map(([nama, b]) => ({ nama, ...ringkasJejak(b) })),
      };
    }
    return out;
  });

  return { bulan, hariIni, orang: orang.map((o) => ({ id: o.id, nama: o.nama })), hari: hasil };
}

module.exports = { sebulan, statusHari, ringkasJejak, tanggalSebulan };
