// The office calendar: opening hours per weekday and the days off. One place, so presensi
// (lateness, reminders), payroll (working days, overtime), leave and the daily video target
// all agree on which days count.

// Index 0 = Sunday. null = closed.
const JADWAL_DEFAULT = [
  null,
  { masuk: '08:00', pulang: '16:00' },
  { masuk: '08:00', pulang: '16:00' },
  { masuk: '08:00', pulang: '16:00' },
  { masuk: '08:00', pulang: '16:00' },
  { masuk: '08:00', pulang: '15:00' },
  { masuk: '08:00', pulang: '15:00' },
];

// Hari libur nasional (tanggal merah) from the SKB 3 Menteri for each year (setneg.go.id).
// Add the next year here when its SKB is published (usually in September).
const LIBUR_NASIONAL = {
  '2026-01-01': 'Tahun Baru Masehi',
  '2026-01-16': 'Isra Mikraj',
  '2026-02-17': 'Tahun Baru Imlek',
  '2026-03-19': 'Hari Suci Nyepi',
  '2026-03-21': 'Idulfitri',
  '2026-03-22': 'Idulfitri',
  '2026-04-03': 'Wafat Yesus Kristus',
  '2026-04-05': 'Paskah',
  '2026-05-01': 'Hari Buruh',
  '2026-05-14': 'Kenaikan Yesus Kristus',
  '2026-05-27': 'Iduladha',
  '2026-05-31': 'Hari Raya Waisak',
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-06-16': 'Tahun Baru Islam',
  '2026-08-17': 'Hari Kemerdekaan',
  '2026-08-25': 'Maulid Nabi',
  '2026-12-25': 'Natal',
  '2027-01-01': 'Tahun Baru Masehi',
  '2027-01-05': 'Isra Mikraj',
  '2027-02-06': 'Tahun Baru Imlek',
  '2027-03-08': 'Hari Suci Nyepi',
  '2027-03-10': 'Idulfitri',
  '2027-03-11': 'Idulfitri',
  '2027-03-26': 'Wafat Yesus Kristus',
  '2027-03-28': 'Paskah',
  '2027-05-01': 'Hari Buruh',
  '2027-05-06': 'Kenaikan Yesus Kristus',
  '2027-05-17': 'Iduladha',
  '2027-05-20': 'Hari Raya Waisak',
  '2027-06-01': 'Hari Lahir Pancasila',
  '2027-06-06': 'Tahun Baru Islam',
  '2027-08-15': 'Maulid Nabi',
  '2027-08-17': 'Hari Kemerdekaan',
  '2027-12-25': 'Natal',
  '2027-12-26': 'Isra Mikraj',
};

// Cuti bersama: optional for private companies, so the owner switches it on.
const CUTI_BERSAMA = {
  '2026-02-16': 'Cuti bersama Imlek',
  '2026-03-18': 'Cuti bersama Nyepi',
  '2026-03-20': 'Cuti bersama Idulfitri',
  '2026-03-23': 'Cuti bersama Idulfitri',
  '2026-03-24': 'Cuti bersama Idulfitri',
  '2026-05-15': 'Cuti bersama Kenaikan Yesus Kristus',
  '2026-05-28': 'Cuti bersama Iduladha',
  '2026-12-24': 'Cuti bersama Natal',
  '2027-02-05': 'Cuti bersama Imlek',
  '2027-03-09': 'Cuti bersama Idulfitri',
  '2027-03-12': 'Cuti bersama Idulfitri',
  '2027-03-15': 'Cuti bersama Idulfitri',
  '2027-03-25': 'Cuti bersama Wafat Yesus Kristus',
  '2027-05-18': 'Cuti bersama Iduladha',
  '2027-05-19': 'Cuti bersama Waisak',
  '2027-12-24': 'Cuti bersama Natal',
};

const JAM = /^([01]\d|2[0-3]):[0-5]\d$/;
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const keMenit = (jam) => { const [h, m] = String(jam).split(':').map(Number); return h * 60 + m; };
const hariDalamMinggu = (d) => new Date(d + 'T00:00:00Z').getUTCDay();

// Cleans the weekly hours the owner typed; throws a readable message.
function validasiJadwal(input, bad) {
  if (!Array.isArray(input) || input.length !== 7) throw bad(400, 'Jam kerja harus diisi untuk 7 hari');
  const NAMA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const out = input.map((x, i) => {
    if (!x) return null;
    const masuk = String(x.masuk || '').replace('.', ':');
    const pulang = String(x.pulang || '').replace('.', ':');
    if (!JAM.test(masuk) || !JAM.test(pulang)) throw bad(400, `Jam kerja ${NAMA[i]} harus format JJ:MM, misal 08:00`);
    if (keMenit(pulang) <= keMenit(masuk)) throw bad(400, `Jam pulang ${NAMA[i]} harus setelah jam masuk`);
    return { masuk, pulang };
  });
  if (!out.some(Boolean)) throw bad(400, 'Pilih minimal satu hari kerja');
  return out;
}

function validasiLibur(input, bad) {
  const list = [...new Set((Array.isArray(input) ? input : String(input || '').split(/[\s,;]+/)).map((x) => String(x).trim()).filter(Boolean))].sort();
  const salah = list.find((d) => !TANGGAL.test(d) || Number.isNaN(Date.parse(d + 'T00:00:00Z')));
  if (salah) throw bad(400, `Tanggal libur "${salah}" tidak valid. Pakai format YYYY-MM-DD`);
  if (list.length > 100) throw bad(400, 'Maksimal 100 tanggal libur kantor');
  return list;
}

// Every day off by date with its name: national holidays, cuti bersama when switched on,
// and the office's own days off.
function daftarLibur(cfg) {
  const out = { ...LIBUR_NASIONAL };
  if (cfg.cuti_bersama) Object.assign(out, CUTI_BERSAMA);
  (cfg.libur_kantor || []).forEach((d) => { if (!out[d]) out[d] = 'Libur kantor'; });
  return out;
}

// Opening hours on a date, or null when the office is closed (weekly day off or holiday).
function jamPada(cfg, tanggal, libur = daftarLibur(cfg)) {
  if (libur[tanggal]) return null;
  return (cfg.jadwal || JADWAL_DEFAULT)[hariDalamMinggu(tanggal)] || null;
}

// The shape payroll and leave already use: weekdays worked and dates off.
function kalenderGaji(cfg) {
  const libur = daftarLibur(cfg);
  return { hari_kerja: (cfg.jadwal || JADWAL_DEFAULT).map((x, i) => (x ? i : null)).filter((x) => x != null), libur: Object.keys(libur).sort(), libur_nama: libur };
}

module.exports = { JADWAL_DEFAULT, LIBUR_NASIONAL, CUTI_BERSAMA, validasiJadwal, validasiLibur, daftarLibur, jamPada, kalenderGaji, keMenit };
