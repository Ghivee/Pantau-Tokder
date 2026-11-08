import { jamKerja, ketLibur } from '../core/calendar.js';
import { PAGES } from '../core/registry.js';
import { TOL, TUGAS, slotsOf, targetOf } from '../core/rules.js';
import { S, me } from '../core/state.js';
import { dayStats } from '../core/stats.js';
import { esc } from '../lib/dom.js';
import { idr, nf, nowJam, tglPanjang, toMin, today } from '../lib/format.js';
import { hariPresensi, jamWib, statusPresensi } from './presensi.js';
import { bulanLabel, notifCard } from './shared.js';
import { icon } from '../ui/icons.js';

// One screen with everything an employee needs today: check in, the upload schedule,
// tasks left, and anything waiting on them. The rest of the menu is for looking back.
PAGES['hari-ini'] = function () {
  const e = me();
  if (!e) return '<section class="card empty"><b>Masuk sebagai karyawan</b></section>';
  const d = today();
  const st = dayStats(e, d);
  const P = S.presensi && S.presensi.config ? S.presensi : null;
  const cfg = P && P.config;
  const h = P ? hariPresensi(P.rows, e.id, d) : {};
  const now = toMin(nowJam());
  const jamHariIni = jamKerja(d);
  const salam = now < 660 ? 'Selamat pagi' : now < 900 ? 'Selamat siang' : now < 1080 ? 'Selamat sore' : 'Selamat malam';

  // Check-in: the one action that matters first thing.
  const absenLangkah = !cfg ? '' : !cfg.siap
    ? '<p class="muted" style="margin:0">Presensi belum diatur pemilik.</p>'
    : !jamHariIni && !h.masuk ? `<p style="margin:0"><b>Hari ini libur: ${esc(ketLibur(d))}.</b> Tidak perlu absen. Bila tetap bekerja, absen seperti biasa dan dihitung lembur.</p><div class="tools" style="margin-top:10px"><button class="btn" data-act="absen" data-jenis="masuk">${icon('pin')}Tetap absen masuk</button></div><p class="muted" id="absen-status" role="status" style="margin:10px 0 0;font-size:13px"></p>`
    : h.pulang ? `<p style="margin:0">Masuk <b class="mono">${jamWib(h.masuk.waktu)}</b> · pulang <b class="mono">${jamWib(h.pulang.waktu)}</b>. Absen hari ini lengkap.</p>`
    : `<div class="tools">${h.masuk
        ? `<button class="btn primary big" data-act="absen" data-jenis="pulang">${icon('out')}Absen pulang</button><span class="muted">Masuk ${jamWib(h.masuk.waktu)}${jamHariIni ? ' · jadwal pulang ' + esc(jamHariIni.pulang) : ''}</span>`
        : `<button class="btn primary big" data-act="absen" data-jenis="masuk">${icon('pin')}Absen masuk</button><span class="muted">Jam kerja hari ini ${esc(jamHariIni.masuk)}–${esc(jamHariIni.pulang)}</span>`}</div>
        <p class="muted" id="absen-status" role="status" style="margin:10px 0 0;font-size:13px">${cfg.ip_kantor ? 'Tersambung ke Wi-Fi kantor.' : 'Belum tersambung ke Wi-Fi kantor. Sambungkan dulu, matikan data seluler dan VPN.'} Nyalakan GPS.</p>`;

  // Upload schedule: each slot done, due now, or later.
  const slots = slotsOf(e);
  const target = targetOf(e);
  const terpakai = new Set(st.vids.map((v) => v._slot));
  const jadwal = slots.length ? slots.map((x) => {
    const v = st.vids.find((y) => y._slot === x);
    const cls = v ? (v._tepat ? 'ok' : 'warn') : toMin(x) + TOL < now ? 'bad' : toMin(x) - 60 <= now ? 'due' : '';
    const ket = v ? (v._tepat ? 'Tayang ' + v._jam : 'Telat · ' + v._jam) : toMin(x) + TOL < now ? 'Terlewat' : toMin(x) - 60 <= now ? 'Sebentar lagi' : 'Nanti';
    return `<li class="${cls}"><b class="mono">${x}</b><span>${ket}</span></li>`;
  }).join('') : '';
  const lepas = st.vids.filter((v) => !terpakai.has(v._slot) || !v._slot);

  // Tasks besides uploads, against the full-day target.
  const tugas = jamHariIni ? TUGAS.map((t) => ({ t, butuh: t.target(target, 1), sudah: st.done(t.nama) })).filter((x) => x.butuh > 0) : [];

  // Waiting on someone.
  const aju = S.pengajuan ? S.pengajuan.list.filter((p) => p.editor_id === e.id) : [];
  const tunggu = aju.filter((p) => p.status === 'menunggu').length;
  const putus = aju.filter((p) => p.status !== 'menunggu' && p.diputus_at && Date.now() - new Date(p.diputus_at).getTime() < 3 * 86400000);
  const G = S.gajiCache[d.slice(0, 7)];
  const gajiSaya = G && G.list ? G.list.find((r) => r.editor_id === e.id) : null;

  return `
      <header class="head"><div><h1>${salam}, ${esc(e.nama.split(' ')[0])}</h1><p class="muted">${tglPanjang(d)}</p></div></header>
      <section class="card today-hero">
        <div class="card-h"><h2>Presensi</h2>${cfg ? statusPresensi(h, cfg, d) : ''}</div>
        ${P ? absenLangkah : '<p class="muted" style="margin:0">Data presensi belum termuat. <a href="/presensi">Buka Presensi</a></p>'}
      </section>
      <div class="grid-2">
        <section class="card">
          <div class="card-h"><h2>Video hari ini</h2><span class="pill ${st.n >= target ? 'ok' : ''}">${jamHariIni ? st.n + ' / ' + target : st.n + ' · libur'}</span></div>
          ${!jamHariIni ? '<p class="muted" style="margin:0">Hari libur: tidak ada target video. Video yang tetap tayang tetap tercatat.</p>' : slots.length ? `<ul class="slots">${jadwal}</ul>` : `<p class="muted" style="margin:0">Belum ada jadwal tayang. Minta pemilik mengisinya di menu Tim.</p>`}
          ${lepas.length ? `<p class="muted" style="margin:10px 0 0;font-size:13px">${lepas.length} video di luar jadwal juga terhitung.</p>` : ''}
          <p class="muted" style="margin:10px 0 0;font-size:13px">Tulis <b class="mono">#${esc(e.kode_identifikasi || '')}</b> di deskripsi. Video muncul paling lama 1 jam setelah tayang.</p>
        </section>
        <section class="card">
          <div class="card-h"><h2>Tugas lain</h2><button class="btn sm" data-act="catat" data-id="${e.id}">${icon('plus')}Catat</button></div>
          ${tugas.length ? '' : '<p class="muted" style="margin:0">Tidak ada target tugas hari ini.</p>'}<ul class="todo">${tugas.map((x) => `<li class="${x.sudah >= x.butuh ? 'done' : ''}"><span class="tick" aria-hidden="true">${x.sudah >= x.butuh ? '✓' : ''}</span><span>${esc(x.t.nama)}</span><b class="num">${nf.format(x.sudah)} / ${nf.format(x.butuh)}</b></li>`).join('')}</ul>
        </section>
      </div>
      <section class="kpis">
        <a class="kpi" href="/harian"><span class="l">Skor ${st.partial ? 'sementara' : 'hari ini'}</span><span class="v">${st.skor ?? '—'} ${st.nilai ? `<span class="grade ${st.nilai}">${st.nilai}</span>` : ''}</span><span class="d">Lihat rinciannya →</span></a>
        <a class="kpi ${tunggu ? 'alert' : ''}" href="/pengajuan"><span class="l">Izin & klaim</span><span class="v">${tunggu}</span><span class="d">${tunggu ? 'menunggu keputusan' : putus.length ? putus.map((p) => (p.status === 'disetujui' ? 'disetujui' : 'ditolak')).join(', ') + ' baru-baru ini' : 'tidak ada yang menunggu'}</span></a>
        <a class="kpi" href="/gaji"><span class="l">Gaji ${bulanLabel(d.slice(0, 7)).split(' ')[0]}</span><span class="v">${gajiSaya && gajiSaya.aturan_diisi ? idr(gajiSaya.total) : '—'}</span><span class="d">${!gajiSaya ? 'belum termuat' : !gajiSaya.aturan_diisi ? 'aturan gaji belum diisi pemilik' : gajiSaya.dibayar_at ? 'sudah dibayar' : gajiSaya.status === 'final' ? 'sudah final' : 'perkiraan sampai hari ini'}</span></a>
      </section>
      ${S.notif && !S.notif.aktif ? notifCard() : ''}`;
};
