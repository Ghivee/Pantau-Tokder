import { analyticsChannels, chName, editorById } from '../core/data.js';
import { PAGES } from '../core/registry.js';
import { S } from '../core/state.js';
import { daysBack } from '../core/stats.js';
import { esc } from '../lib/dom.js';
import { addDays, idr, nf, pct, rpOrDash, signed, sum, tglPendek, today } from '../lib/format.js';
import { bantuan, bulanLabel } from './shared.js';
import { avatar, vidCell } from '../ui/bits.js';
import { icon } from '../ui/icons.js';

PAGES.monetisasi = function () {
  const rows = S.content;
  const month = today().slice(0, 7);
  const revDaily = S.daily.filter((d) => d.revenue != null);
  const hasDaily = revDaily.length > 0;
  const latest = revDaily.reduce((m, d) => (d.tanggal > m ? d.tanggal : m), '');
  const d28 = latest ? daysBack(28, latest) : [], p28 = latest ? daysBack(28, addDays(d28[0], -1)) : [];
  const revIn = (ds) => sum(revDaily.filter((d) => ds.includes(d.tanggal)), (d) => d.revenue);
  const revMonth = sum(revDaily.filter((d) => d.tanggal.slice(0, 7) === month), (d) => d.revenue);
  const withRev = rows.filter((c) => c.revenue != null);
  const hasVid = withRev.length > 0;
  const by = (keyFn, nameFn) => {
    const m = new Map();
    withRev.forEach((c) => { const k = keyFn(c); m.set(k, (m.get(k) || 0) + (c.revenue || 0)); });
    return [...m.entries()].map(([k, v]) => ({ k, nama: nameFn(k), v })).sort((a, b) => b.v - a.v);
  };
  const perEditor = by((c) => (editorById(c.editor_id) ? c.editor_id : 0), (k) => (k ? editorById(k).nama : 'Belum dikenali'));
  const perCh = by((c) => c._ch, chName);
  const maxE = Math.max(...perEditor.map((x) => x.v), 0.01), maxC = Math.max(...perCh.map((x) => x.v), 0.01);
  // NUMERIC columns arrive as text ("0"), so they are turned into numbers before any comparison.
  const g0 = S.goal || {};
  const g = { ...g0, target_omset: +g0.target_omset || 0, tercapai: +g0.tercapai || 0 };
  const gp = g.target_omset ? Math.min(1, g.tercapai / g.target_omset) : null;
  const chans = analyticsChannels();
  const noRev = '<div class="empty"><b>Belum ada angka pendapatan</b>Muncul setelah channel tersambung ke YouTube Analytics dan sudah dimonetisasi.</div>';
  const ch28 = p28.length && revIn(p28) ? Math.round(((revIn(d28) - revIn(p28)) / revIn(p28)) * 100) : null;
  return `
      <header class="head"><div><h1>Pendapatan</h1><p>Pendapatan iklan adalah <b>perkiraan dari YouTube Analytics</b> dalam rupiah (dikonversi YouTube dengan kurs harian), angka yang sama dengan di YouTube Studio; pembayaran akhir AdSense bisa sedikit berbeda. Omzet afiliasi berasal dari laporan CSV yang diimpor atau diisi manual oleh pemilik.</p></div><div class="tools">${bantuan('pendapatan')}</div></header>
      <section class="kpis">
        <div class="kpi"><span class="l">Iklan bulan ini</span><span class="v">${hasDaily ? rpOrDash(revMonth) : '—'}</span><span class="d">${hasDaily ? 'semua video, sampai ' + tglPendek(latest) : 'belum ada data channel'}</span></div>
        <div class="kpi"><span class="l">Iklan 28 hari</span><span class="v">${hasDaily ? rpOrDash(revIn(d28)) : '—'}</span><span class="d ${ch28 == null ? '' : ch28 >= 0 ? 'ok' : 'bad'}">${ch28 == null ? 'belum ada pembanding' : signed(ch28, (v) => nf.format(v) + '%') + ' dari 28 hari sebelumnya'}</span></div>
        <div class="kpi"><span class="l">Total per video tercatat</span><span class="v">${hasVid ? rpOrDash(sum(withRev, (c) => c.revenue)) : '—'}</span><span class="d">${hasVid ? nf.format(withRev.filter((c) => c.revenue > 0).length) + ' video menghasilkan, seumur video' : 'belum ada data per video'}</span></div>
        <div class="kpi"><span class="l">Omzet afiliasi bulan ini</span><span class="v">${idr(g.tercapai)}</span><span class="d">${g.impor && g.impor.bulan.includes(month) ? 'dari impor ' + esc(g.impor.sumber) : 'diisi manual'} · ${g.target_omset ? 'target ' + idr(g.target_omset) : 'target belum diatur'}</span></div>
      </section>
      <section class="card"><div class="card-h"><h2>Sumber angka</h2></div>
        <div class="checklist">${chans.map((c) => { const r = revDaily.filter((d) => d.channel_id === c.id); const ok = c.connected && r.length > 0; return `<div class="ck"><span class="st ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '!'}</span><div><b>${esc(c.nama)}</b><div>${!c.connected ? (r.length ? `Tidak tersambung lagi ke YouTube Analytics. Angka yang tampil adalah data lama sampai ${tglPendek(r.reduce((m, d) => (d.tanggal > m ? d.tanggal : m), ''))}; hubungkan ulang di Pengaturan.` : 'Belum tersambung ke YouTube Analytics: pendapatannya tidak terbaca.') : r.length ? `Pendapatan terbaca, ${rpOrDash(sum(r.filter((d) => d.tanggal.slice(0, 7) === month), (d) => d.revenue))} bulan ini.` : 'Tersambung, tapi YouTube tidak mengirim angka pendapatan (channel belum dimonetisasi atau akun tidak punya akses pendapatan).'}</div></div></div>`; }).join('') || '<div class="empty">Belum ada channel.</div>'}</div>
      </section>
      <div class="grid-2">
        <section class="card"><div class="card-h"><h2>Target omzet afiliasi</h2><div class="tools"><button class="btn sm" data-act="impor-afiliasi">${icon('download')}Impor CSV</button><button class="btn sm" data-act="goal">Ubah</button></div></div>
          <div class="goal-v">${gp == null ? idr(g.tercapai) : pct(gp)}</div><div class="goal-bar"><i style="width:${(gp || 0) * 100}%"></i></div>
          <div class="muted">${gp == null ? 'Target bulan ini belum diatur. Klik Ubah untuk mengisinya.' : `${idr(g.tercapai)} dari ${idr(g.target_omset)} · sisa ${idr(Math.max(0, g.target_omset - g.tercapai))}`}</div>
          <p class="muted fs-125 mt-10">${g.impor ? `Impor terakhir: ${esc(g.impor.sumber)}, ${esc(g.impor.file)} (${g.impor.bulan.map(bulanLabel).join(', ')}), ${new Date(g.impor.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}.` : 'Belum pernah diimpor. Isi manual lewat Ubah, atau impor laporan komisi CSV dari dashboard afiliasi.'}</p></section>
        <section class="card"><div class="card-h"><h2>Per karyawan</h2><p>Jumlah pendapatan seumur video buatan tiap orang.</p></div>${hasVid ? `<div class="rank">${perEditor.map((x) => `<div class="rank-row">${avatar(editorById(x.k), 'sm')}<div class="tx"><b>${esc(x.nama)}</b><div class="bar"><i style="width:${(x.v / maxE) * 100}%"></i></div></div><b>${rpOrDash(x.v)}</b></div>`).join('')}</div>` : noRev}</section>
        <section class="card"><div class="card-h"><h2>Per channel</h2><p>Jumlah pendapatan seumur video yang tercatat.</p></div>${hasVid ? `<div class="rank">${perCh.map((x) => `<div class="rank-row"><span></span><div class="tx"><b>${esc(x.nama)}</b><div class="bar"><i style="width:${(x.v / maxC) * 100}%"></i></div></div><b>${rpOrDash(x.v)}</b></div>`).join('')}</div>` : noRev}</section>
        <section class="card"><div class="card-h"><h2>Video dengan pendapatan tertinggi</h2></div>
          ${withRev.some((c) => c.revenue > 0) ? `<div class="table-wrap"><table class="t"><tbody>${[...withRev].filter((c) => c.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 8).map((c) => `<tr class="click" data-act="video" data-id="${c.id}"><td>${vidCell(c)}</td><td class="num"><b>${rpOrDash(c.revenue)}</b></td></tr>`).join('')}</tbody></table></div>` : noRev}</section>
      </div>`;
};
