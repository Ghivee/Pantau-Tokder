const db = require('../config/db');
const presensi = require('./presensiService');
const push = require('./pushService');
const kalender = require('./kalenderService');

// Reminder for people who have not checked in, sent once per person per day between
// 10 minutes after the late limit and 3 hours after opening time, on working days only.
async function pengingatAbsen(now = Date.now()) {
  const pcfg = await presensi.getConfig();
  if (!pcfg.siap) return 0;
  const hari = presensi.todayWib(now);
  const jam = kalender.jamPada(pcfg, hari);
  if (!jam) return 0;
  const menit = presensi.menitWib(now);
  const buka = kalender.keMenit(jam.masuk);
  if (menit < buka + pcfg.toleransi + 10 || menit > buka + 180) return 0;
  const r = await db.query(
    `SELECT e.id, e.nama FROM editors e
     WHERE e.status <> 'nonaktif' AND e.pin IS NOT NULL AND e.pin <> ''
       AND NOT EXISTS (SELECT 1 FROM presensi p WHERE p.editor_id = e.id AND p.tanggal = $1 AND p.jenis = 'masuk')
       AND NOT EXISTS (SELECT 1 FROM pengajuan q WHERE q.editor_id = e.id AND q.status = 'disetujui' AND q.jenis <> 'klaim' AND $1 BETWEEN q.dari AND q.sampai)
       AND EXISTS (SELECT 1 FROM push_langganan s WHERE s.editor_id = e.id)`,
    [hari]
  );
  let n = 0;
  for (const e of r.rows) {
    const sent = await push.sekali(`absen:${hari}:${e.id}`, () => push.kirim({ editorId: e.id }, {
      title: 'Belum absen masuk', body: `${e.nama}, jam masuk ${jam.masuk}. Absen dari Wi-Fi kantor, atau ajukan izin bila berhalangan.`, url: '/presensi', tag: 'absen',
    }));
    if (sent) n++;
  }
  return n;
}

module.exports = { pengingatAbsen };
