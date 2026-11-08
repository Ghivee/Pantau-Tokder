import { activeEditors, editorById } from './data.js';
import { S } from './state.js';
import { sum, today } from '../lib/format.js';
import { hariPresensi, jamWib } from '../pages/presensi.js';
import { kontenRows } from '../pages/shared.js';
import { toast } from '../ui/bits.js';

// A CSV that opens in Excel and Google Sheets (UTF-8 with BOM).
function unduhCsv(nama, head, rows) {
  // A text cell starting with = + - @ would run as a formula in Excel/Sheets: prefix it with a quote.
  const q = (v) => { if (typeof v === 'number') return String(v); let x = String(v ?? ''); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return '"' + x.replace(/"/g, '""') + '"'; };
  const csv = [head, ...rows].map((r) => r.map(q).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nama + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportCsv() {
  unduhCsv('konten-tokder-' + today(), ['Tanggal', 'Jam (WIB)', 'Channel', 'Pembuat', 'Judul', 'Jenis', 'Views', 'Like', 'Komentar', 'Durasi (detik)', 'URL'],
    kontenRows().map((c) => [c._day, c._jam, c._chNama, (editorById(c.editor_id) || {}).nama || '', c.judul, c.tipe_video, c.views, c.likes, c.comments, c.duration_secs, c.url]));
}

export function exportGaji() {
  const b = S.gajiBulan;
  const G = S.gajiCache[b];
  if (!G || !G.list) return toast('Data gaji belum termuat', true);
  const nilai = (r, label) => sum(r.baris.filter((x) => x.label === label), (x) => x.jumlah);
  unduhCsv('gaji-tokder-' + b, ['Bulan', 'Karyawan', 'Status', 'Hadir', 'Tidak hadir', 'Izin', 'Sakit', 'Cuti', 'Telat (kali)', 'Telat (menit)', 'Lembur (menit)', 'Video', 'Target video', 'Gaji pokok', 'Tunjangan', 'Tambahan lain', 'Potongan', 'Total', 'Dibayar'],
    G.list.map((r) => {
      const pokok = nilai(r, 'Gaji pokok'), tunj = nilai(r, 'Tunjangan');
      const plus = sum(r.baris.filter((x) => x.jumlah > 0), (x) => x.jumlah) - pokok - tunj;
      const minus = sum(r.baris.filter((x) => x.jumlah < 0), (x) => x.jumlah);
      return [b, r.nama, r.dibayar_at ? 'Dibayar' : r.status === 'final' ? 'Final' : 'Perkiraan', r.hari.hadir, r.hari.alpa, r.hari.izin, r.hari.sakit, r.hari.cuti, r.hari.telat, r.hari.telat_menit, r.hari.lembur_menit,
        r.video.jumlah, r.video.target, pokok, tunj, plus, minus, r.total, r.dibayar_at ? String(r.dibayar_at).slice(0, 10) : ''];
    }));
}

export function exportPresensi() {
  const P = S.presensi;
  if (!P || !P.rows) return toast('Data presensi belum termuat', true);
  const hari = [...new Set(P.rows.map((r) => r.tanggal))].sort().reverse();
  const rows = [];
  hari.forEach((d) => activeEditors().forEach((e) => {
    const h = hariPresensi(P.rows, e.id, d);
    if (h.masuk || h.pulang) rows.push([d, e.nama, jamWib(h.masuk && h.masuk.waktu), jamWib(h.pulang && h.pulang.waktu), h.masuk ? h.masuk.telat_menit || 0 : '', h.masuk && h.masuk.jarak != null ? Math.round(h.masuk.jarak) : '']);
  }));
  unduhCsv('presensi-tokder-' + today(), ['Tanggal', 'Karyawan', 'Masuk', 'Pulang', 'Telat (menit)', 'Jarak (m)'], rows);
}
