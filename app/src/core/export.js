import { activeEditors, editorById } from './data.js';
import { S } from './state.js';
import { tglPanjang } from '../lib/format.js';
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

// Spreadsheet kalender: satu baris per orang per tanggal, mengikuti bulan dan orang yang sedang dipilih.
export function exportKalender() {
  const K = S.kal;
  const D = K && K.data[K.bulan];
  if (!D) return toast('Data kalender belum termuat', true);
  const STATUS = { hadir: 'Hadir', telat: 'Telat', izin: 'Izin', sakit: 'Sakit', cuti: 'Cuti', alpa: 'Tidak hadir', belum: 'Belum absen', libur: 'Libur', '': '' };
  const gabung = (a, f) => a.map(f).join(' | ');
  const adaJejak = D.hari.some((h) => h.lain);
  const kepala = ['Tanggal', 'Hari', 'Nama', 'Status', 'Masuk', 'Pulang', 'Telat (menit)', 'Jarak masuk (m)', 'Absen ditolak', 'Izin dan klaim', 'Jumlah video', 'Views', 'Judul video', 'Unggahan draf', 'Tugas'];
  if (adaJejak) kepala.push('Catatan Jejak', 'Aktivitas pertama', 'Aktivitas terakhir', 'Kali masuk', 'Gagal masuk', 'Peringatan', 'Perangkat', 'Lokasi');
  const kolomJejak = (j) => (adaJejak ? (j ? [j.jumlah, j.awal, j.akhir, j.masuk, j.gagal, j.peringatan, j.perangkat.join(' | '), j.lokasi.join(' | ')] : ['', '', '', '', '', '', '', '']) : []);
  const rows = [];
  D.hari.filter((h) => h.tanggal <= D.hariIni).forEach((h) => {
    const hari = tglPanjang(h.tanggal).split(',')[0];
    h.orang.filter((o) => !K.orang || String(o.id) === K.orang).forEach((o) => {
      rows.push([h.tanggal, hari, (D.orang.find((x) => x.id === o.id) || {}).nama || '', STATUS[o.status], o.masuk ? o.masuk.jam : '', o.pulang ? o.pulang.jam : '', o.masuk ? o.masuk.telat : '', o.masuk && o.masuk.jarak != null ? o.masuk.jarak : '',
        gabung(o.ditolak, (x) => x.jam + ' ' + x.alasan), gabung(o.pengajuan, (x) => x.jenis + ' (' + x.status + ') ' + (x.alasan || '')), o.video.length, sum(o.video, (v) => v.views || 0), gabung(o.video, (v) => v.judul),
        gabung(o.unggah, (u) => u.judul + ' [' + u.tujuan.map((t) => t.platform).join('/') + ']'), gabung(o.tugas, (t) => t.jam + ' ' + t.tugas + (t.detail ? ': ' + t.detail : '')), ...kolomJejak(o.jejak)]);
    });
    if (!K.orang && h.lain) {
      h.lain.jejak.forEach((j) => rows.push([h.tanggal, hari, j.nama, '', '', '', '', '', '', '', '', '', '', '', '', ...kolomJejak(j)]));
      if (h.lain.video.length || h.lain.unggah.length) rows.push([h.tanggal, hari, 'Tanpa pembuat atau pemilik', '', '', '', '', '', '', '', h.lain.video.length, sum(h.lain.video, (v) => v.views || 0), gabung(h.lain.video, (v) => v.judul), gabung(h.lain.unggah, (u) => u.judul), '', ...kolomJejak(null)]);
    }
  });
  unduhCsv('kalender-tokder-' + D.bulan, kepala, rows);
}
