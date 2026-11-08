import { activeEditors, editorById } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { TOL } from '../core/rules.js';
import { S, isAdmin, me } from '../core/state.js';
import { daysBack, periodStats } from '../core/stats.js';
import { $, esc } from '../lib/dom.js';
import { addDays, median, nf, pct, sum, tglPendek, today } from '../lib/format.js';
import { bantuan, kali, loadInsight, peerRatios } from './shared.js';
import { vidCell } from '../ui/bits.js';
import { drawBars } from '../ui/charts.js';
import { icon } from '../ui/icons.js';
import { render } from '../ui/layout.js';

// Views of a video against the median of its channel and type (videos 2–32 days old), as on Harian.
const ratioOf = (c) => { const m = S.medians[c._ch + '|' + c.tipe_video]; return c._age >= 2 && m ? c.views / m : null; };

const retOf = (c) => (S.insight && S.insight.retMap.get(c.id)) || null;

const likeRate = (list) => { const v = sum(list, (c) => c.views); return v >= 300 ? (sum(list, (c) => c.likes) / v) * 1000 : null; };

const avgRet = (list, k) => { const r = list.map(retOf).filter(Boolean); return r.length >= 3 ? { v: sum(r, (x) => x[k]) / r.length, n: r.length } : null; };

// How one person's videos do against the channel and the rest of the team, with advice from their own numbers.
function perfPerson() {
  if (me()) return me();
  return editorById(S.perfEditor) || activeEditors()[0] || S.editors[0] || null;
}

function perfSaran(e, mine, others, st) {
  const out = [];
  const banding = me() ? 'video lain di channel' : 'rekan setim';
  const mature = mine.filter((c) => ratioOf(c) != null);
  const medOf = (l) => median(l.map(ratioOf).filter((r) => r != null));
  // Topics
  const topik = {};
  mature.forEach((c) => { (topik[c._topik] ||= []).push(c); });
  const tl = Object.entries(topik).filter(([t, l]) => l.length >= 2 && t !== 'Lainnya').map(([t, l]) => ({ t, l, r: medOf(l) }));
  const best = [...tl].sort((a, b) => b.r - a.r)[0], worst = [...tl].sort((a, b) => a.r - b.r)[0];
  if (best && best.r >= 1.2) out.push({ good: true, title: `Topik terkuat: ${esc(best.t)}`, why: `Median views video topik ini <b>${kali(best.r)}</b> median channel (${best.l.length} video).`, act: `Buat lagi dengan sudut berbeda. Contoh terbaik: “${esc(best.l.reduce((a, b) => (ratioOf(b) > ratioOf(a) ? b : a)).judul)}”.` });
  if (worst && worst !== best && worst.r <= 0.8) out.push({ title: `Topik ${esc(worst.t)} kurang ditonton`, why: `Median views <b>${kali(worst.r)}</b> median channel (${worst.l.length} video).`, act: 'Coba judul dan thumbnail yang lebih spesifik (angka, masalah nyata petani), atau kurangi topik ini.' });
  // Retention
  const [ra, oa] = [avgRet(mine, 'awal'), avgRet(others, 'awal')];
  if (ra && oa && ra.v < oa.v - 5) out.push({ title: 'Penonton cepat pergi di awal video', why: `Rata-rata yang masih menonton di 10% awal video: <b>${Math.round(ra.v)}%</b>, ${banding} ${Math.round(oa.v)}% (${ra.n} video dengan data retensi).`, act: 'Perkuat 3 detik pertama: langsung tunjukkan hasil atau masalahnya, tanpa pembuka atau logo yang panjang.' });
  else if (ra && oa && ra.v > oa.v + 5) out.push({ good: true, title: 'Pembuka video sudah kuat', why: `Masih menonton di 10% awal: <b>${Math.round(ra.v)}%</b>, ${banding} ${Math.round(oa.v)}%.`, act: 'Pertahankan gaya pembuka ini dan bagikan caranya ke tim.' });
  const [rt, ot] = [avgRet(mine, 'akhir'), avgRet(others, 'akhir')];
  if (rt && ot && rt.v < ot.v - 5) out.push({ title: 'Banyak yang berhenti sebelum akhir', why: `Masih menonton di akhir video: <b>${Math.round(rt.v)}%</b>, ${banding} ${Math.round(ot.v)}%.`, act: 'Pangkas bagian yang berulang, simpan satu informasi penting untuk akhir, dan untuk Shorts buat akhir yang menyambung ke awal supaya ditonton ulang.' });
  // Likes
  const [lm, lo] = [likeRate(mine), likeRate(others)];
  if (lm != null && lo != null && lm < lo * 0.8) out.push({ title: me() ? 'Like per views lebih rendah dari video lain' : 'Like per views lebih rendah dari rekan', why: `<b>${nf.format(Math.round(lm))}</b> like per 1.000 views, ${banding} ${nf.format(Math.round(lo))}.`, act: 'Ajak penonton menekan like atau menjawab pertanyaan di komentar, di tengah video, bukan hanya di akhir.' });
  // Format
  const sh = mature.filter((c) => c.tipe_video === 'short'), lg = mature.filter((c) => c.tipe_video !== 'short');
  if (sh.length >= 3 && lg.length >= 3) {
    const a = medOf(sh), b = medOf(lg);
    if (Math.max(a, b) / Math.max(0.01, Math.min(a, b)) >= 1.4) out.push({ good: true, title: `Lebih kuat di ${a > b ? 'Shorts' : 'video panjang'}`, why: `Dibanding median channel: Shorts <b>${kali(a)}</b> (${sh.length} video), video panjang <b>${kali(b)}</b> (${lg.length} video).`, act: `Ambil lebih banyak jatah ${a > b ? 'Shorts' : 'video panjang'} bila jadwal tim memungkinkan.` });
  }
  // Shorts length
  const dur = { 'di bawah 30 detik': [], '30–59 detik': [], '60 detik atau lebih': [] };
  sh.forEach((c) => { const d = +c.duration_secs || 0; dur[d < 30 ? 'di bawah 30 detik' : d < 60 ? '30–59 detik' : '60 detik atau lebih'].push(c); });
  const dl = Object.entries(dur).filter(([, l]) => l.length >= 3).map(([k, l]) => ({ k, n: l.length, r: medOf(l) })).sort((a, b) => b.r - a.r);
  if (dl.length >= 2 && dl[0].r / Math.max(0.01, dl[dl.length - 1].r) >= 1.3) out.push({ title: `Shorts ${dl[0].k} paling ditonton`, why: dl.map((x) => `${x.k} <b>${kali(x.r)}</b> (${x.n})`).join(' · ') + '.', act: `Arahkan durasi Shorts ke ${dl[0].k}.` });
  // Time of day
  const jam = {};
  mature.forEach((c) => { const h = Math.floor(+c._jam.slice(0, 2) / 3) * 3; (jam[h] ||= []).push(c); });
  const jl = Object.entries(jam).filter(([, l]) => l.length >= 3).map(([h, l]) => ({ h: +h, n: l.length, r: medOf(l) })).sort((a, b) => b.r - a.r);
  if (jl.length >= 2 && jl[0].r / Math.max(0.01, jl[jl.length - 1].r) >= 1.3) {
    const hh = (h) => String(h).padStart(2, '0') + ':00';
    out.push({ title: `Video yang tayang jam ${hh(jl[0].h)}–${hh(jl[0].h + 3)} paling ramai`, why: jl.map((x) => `${hh(x.h)} <b>${kali(x.r)}</b> (${x.n})`).join(' · ') + '.', act: 'Minta pemilik menggeser satu slot jadwal ke jam ini.' });
  }
  // Discipline
  if (st.target && st.n < st.target) out.push({ title: `Kurang ${nf.format(st.target - st.n)} video dari target`, why: `${nf.format(st.n)} dari ${nf.format(st.target)} video dalam ${S.perfPeriode} hari.`, act: 'Siapkan stok 2–3 video jadi supaya jadwal tetap terisi saat ada kendala.' });
  if (st.tepat != null && st.tepat < 0.85) out.push({ title: 'Sering lewat jadwal tayang', why: `Tepat jadwal <b>${pct(st.tepat)}</b>. Telat lebih dari ${TOL} menit dihitung telat.`, act: 'Pakai fitur jadwalkan di YouTube Studio untuk jam tayang yang ditentukan.' });
  return out.sort((a, b) => (a.good ? 1 : 0) - (b.good ? 1 : 0));
}

PAGES.performa = function () {
  const e = perfPerson();
  const n = S.perfPeriode;
  const tools = `<div class="tools">
      ${isAdmin() && S.editors.length ? `<select class="input" id="pf-editor" style="width:auto" aria-label="Karyawan">${S.editors.map((x) => `<option value="${x.id}" ${e && x.id === e.id ? 'selected' : ''}>${esc(x.nama)}</option>`).join('')}</select>` : ''}
      <div class="seg" role="group" aria-label="Periode">${[7, 30, 90].map((d) => `<button data-act="pf-periode" data-v="${d}" aria-pressed="${n === d}">${d} hari</button>`).join('')}</div>
      ${bantuan('performa')}</div>`;
  if (!e) return `<header class="head"><div><h1>Performa video</h1><p>Belum ada karyawan.</p></div>${tools}</header>`;
  const from = addDays(today(), -n + 1);
  const mine = S.content.filter((c) => c.editor_id === e.id && c._day >= from);
  // Owner: the rest of the team. Employee: every other video on the channels (makers not shown).
  const others = S.content.filter((c) => c.editor_id !== e.id && c._day >= from && (me() ? true : c.editor_id && editorById(c.editor_id)));
  const st = periodStats(e, daysBack(n));
  const rM = median(mine.map(ratioOf).filter((r) => r != null)), rO = median(others.map(ratioOf).filter((r) => r != null));
  const tM = avgRet(mine, 'tengah'), tO = avgRet(others, 'tengah');
  const lM = likeRate(mine), lO = likeRate(others);
  const cmp = (a, b, f) => (a == null || b == null ? '' : `<span class="d ${a >= b ? 'ok' : 'bad'}">${me() ? 'video lain' : 'rekan setim'} ${f(b)}</span>`);
  const saran = perfSaran(e, mine, others, st);
  const ranked = mine.filter((c) => ratioOf(c) != null).sort((a, b) => ratioOf(b) - ratioOf(a));
  const loadingRet = !S.insight;
  if (loadingRet) loadInsight();
  const row = (c) => { const r = ratioOf(c), t = retOf(c); return `<tr class="click" data-act="video" data-id="${c.id}"><td class="full">${vidCell(c)}</td><td class="mono" data-label="Tayang">${tglPendek(c._day)} ${c._jam}</td><td class="num" data-label="Views">${nf.format(c.views)}</td><td class="num" data-label="Dibanding median">${r == null ? '<span class="muted">baru</span>' : `<span class="pill ${r >= 1.2 ? 'ok' : r < 0.8 ? 'bad' : ''}">${kali(r)}</span>`}</td><td class="num" data-label="Like / 1.000">${c.views >= 100 ? nf.format(Math.round((c.likes / c.views) * 1000)) : '—'}</td><td class="num" data-label="Retensi tengah">${t ? t.tengah + '%' : '—'}</td></tr>`; };
  const thead = '<thead><tr><th>Video</th><th>Tayang</th><th class="num">Views</th><th class="num">Dibanding median</th><th class="num">Like / 1.000</th><th class="num">Retensi tengah</th></tr></thead>';
  return `
      <header class="head">
        <div><h1>${me() ? 'Performa saya' : 'Performa ' + esc(e.nama)}</h1><p>${n} hari terakhir: <b>${nf.format(mine.length)}</b> video${mine.length ? `, median views <b>${kali(rM)}</b> median channel` : ''}. 1× berarti sama dengan video biasa di channel dan jenis yang sama; di atas 1× berarti lebih ramai.</p></div>
        ${tools}
      </header>
      <section class="kpis">
        <div class="kpi"><span class="l">Video tayang</span><span class="v">${nf.format(st.n)}${st.target ? ` <small>/ ${nf.format(st.target)}</small>` : ''}</span><span class="d">target dari jadwal harian</span></div>
        <div class="kpi"><span class="l">Views dibanding median</span><span class="v ${rM == null ? '' : rM >= 1 ? 'ok' : 'bad'}">${kali(rM)}</span>${cmp(rM, rO, kali) || '<span class="d">video berumur ≥ 2 hari</span>'}</div>
        <div class="kpi"><span class="l">Masih menonton di tengah</span><span class="v">${tM ? Math.round(tM.v) + '%' : loadingRet ? '…' : '—'}</span>${cmp(tM && tM.v, tO && tO.v, (v) => Math.round(v) + '%') || `<span class="d">${tM ? tM.n + ' video dengan retensi' : 'butuh ≥ 3 video dengan retensi'}</span>`}</div>
        <div class="kpi"><span class="l">Like per 1.000 views</span><span class="v">${lM == null ? '—' : nf.format(Math.round(lM))}</span>${cmp(lM, lO, (v) => nf.format(Math.round(v))) || '<span class="d">butuh ≥ 300 views</span>'}</div>
        <div class="kpi"><span class="l">Tepat jadwal</span><span class="v ${st.tepat == null ? '' : st.tepat >= 0.85 ? 'ok' : 'bad'}">${pct(st.tepat)}</span><span class="d">skor rata-rata ${st.skor ?? '—'}</span></div>
      </section>
      <section class="card" id="kartu-saran">
        <div class="card-h"><h2>Yang bisa ditingkatkan</h2><p>Dihitung dari video ${me() ? 'Anda' : esc(e.nama)} sendiri dibanding ${me() ? 'video lain di channel yang sama' : 'channel dan rekan setim'}. Saran hanya muncul bila datanya cukup.</p></div>
        ${saran.length ? `<ol class="advice">${saran.map((x) => `<li><div class="t"><b>${x.good ? '<span class="pill ok">Sudah bagus</span> ' : ''}${x.title}</b><div class="why">${x.why}</div><div class="act">${icon('bulb')}<span>${x.act}</span></div></div></li>`).join('')}</ol>`
          : `<div class="empty"><b>Belum cukup data untuk saran</b>Butuh beberapa video berumur 2 hari atau lebih${S.insight && S.insight.error ? '. Data retensi gagal dimuat: ' + esc(S.insight.error) : ''}.</div>`}
      </section>
      <section class="card" id="kartu-tren-orang">
        <div class="card-h"><h2>Perkembangan 8 minggu</h2><p>Median views video tiap minggu dibanding video lain yang tayang di minggu yang sama (100% = sama). Garis putus-putus: 100%.</p></div>
        <div class="chart" id="pf-chart" style="min-height:190px"></div>
      </section>
      <div class="grid-2">
        <section class="card"><div class="card-h"><h2>Paling berhasil</h2><p>Pelajari judul, thumbnail dan pembukanya.</p></div>
          ${ranked.length ? `<div class="table-wrap"><table class="t stack">${thead}<tbody>${ranked.slice(0, 3).map(row).join('')}</tbody></table></div>` : '<div class="empty"><b>Belum ada video berumur 2 hari</b></div>'}</section>
        <section class="card"><div class="card-h"><h2>Paling kurang</h2><p>Cari bedanya dengan yang berhasil.</p></div>
          ${ranked.length >= 4 ? `<div class="table-wrap"><table class="t stack">${thead}<tbody>${ranked.slice(-3).reverse().map(row).join('')}</tbody></table></div>` : '<div class="empty"><b>Butuh minimal 4 video berumur 2 hari</b></div>'}</section>
      </div>
      <section class="card"><div class="card-h"><h2>Video ${n} hari terakhir</h2><p>${loadingRet ? 'Memuat data retensi…' : 'Retensi tengah: persen penonton yang masih menonton di pertengahan video (YouTube Analytics).'}</p></div>
        ${mine.length ? `<div class="table-wrap"><table class="t stack">${thead}<tbody>${[...mine].sort((a, b) => b.tanggal_upload.localeCompare(a.tanggal_upload)).slice(0, 20).map(row).join('')}</tbody></table></div>${mine.length > 20 ? `<p class="muted" style="font-size:12.5px;margin:10px 0 0">Menampilkan 20 video terbaru dari ${nf.format(mine.length)}. <a href="/konten" data-act="konten-orang" data-id="${e.id}">Lihat semua di Konten</a>.</p>` : ''}` : '<div class="empty"><b>Belum ada video di periode ini</b>Video dikenali dari kode #' + esc(e.kode_identifikasi) + ' di deskripsi.</div>'}
      </section>`;
};

AFTER.performa = () => {
  const sel = $('#pf-editor');
  if (sel) sel.addEventListener('change', () => { S.perfEditor = +sel.value; render(); });
  const e = perfPerson(), box = $('#pf-chart');
  if (!e || !box) return;
  const weeks = Array.from({ length: 8 }, (_, i) => { const end = addDays(today(), -7 * (7 - i)); return { from: addDays(end, -6), end }; });
  const values = weeks.map((w) => {
    const all = S.content.filter((c) => c._day >= w.from && c._day <= w.end && c._age >= 2);
    const r = peerRatios(all);
    const mineR = all.filter((c) => c.editor_id === e.id).map((c) => r.get(c.id)).filter((x) => x != null);
    return mineR.length ? Math.round(median(mineR) * 100) : null;
  });
  drawBars(box, { labels: weeks.map((w) => tglPendek(w.from)), tipLabels: weeks.map((w) => tglPendek(w.from) + ' – ' + tglPendek(w.end)), values, ref: 100, fmtV: (v) => nf.format(Math.round(v)) + '%', label: 'Perkembangan views mingguan' });
};
