import { analyticsChannels, chColor, jamMenit } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { S, isAdmin, lihatUang } from '../core/state.js';
import { daysBack } from '../core/stats.js';
import { $, $$, esc } from '../lib/dom.js';
import { addDays, durasi, fmt, median, nf, pct, rpOrDash, signed, sum, tglPanjang, tglPendek, today } from '../lib/format.js';
import { drawSparkbars, drawStacked } from '../ui/charts.js';
import { icon } from '../ui/icons.js';

PAGES.analytics = function () {
    const chans = analyticsChannels();
    const latest = S.daily.reduce((m, d) => (d.tanggal > m ? d.tanggal : m), '');
    const end = latest || addDays(today(), -2);
    const days = daysBack(S.anPeriode, end);
    const prev = daysBack(S.anPeriode, addDays(days[0], -1));
    const pick = (ids, ds) => S.daily.filter((d) => ids.includes(d.channel_id) && ds.includes(d.tanggal));
    const tot = (list) => ({
      views: sum(list, (d) => d.views), menit: sum(list, (d) => d.menit_tonton),
      naik: sum(list, (d) => d.sub_naik), turun: sum(list, (d) => d.sub_turun),
      rev: list.some((d) => d.revenue != null) ? sum(list, (d) => d.revenue || 0) : null,
    });
    const ids = chans.map((c) => c.id);
    const cur = tot(pick(ids, days)), pv = tot(pick(ids, prev));
    const has = pick(ids, days).length > 0;
    const show = (txt) => (has ? txt : '—');
    const change = (a, b) => {
      if (!b) return `<span class="d">belum ada pembanding</span>`;
      const x = Math.round(((a - b) / Math.abs(b)) * 100);
      return `<span class="d ${x >= 0 ? 'ok' : 'bad'}">${signed(x, (v) => nf.format(v) + '%')} dari ${S.anPeriode} hari sebelumnya</span>`;
    };
    const avgDur = (t) => (t.views ? durasi(Math.round((t.menit * 60) / t.views)) : '—');
    const showRev = lihatUang() && cur.rev != null;
    const nConn = chans.filter((c) => c.connected).length;
    const missing = chans.filter((c) => !c.connected);
    return `
        <header class="head">
          <div><h1>Analytics</h1><p><b>${nConn}</b> dari ${chans.length} channel tersambung ke YouTube Analytics. ${latest ? 'Angka sampai ' + tglPanjang(latest) + '; YouTube biasanya terlambat 2–3 hari.' : 'Belum ada angka tersimpan.'}</p></div>
          <div class="tools"><div class="seg" role="group" aria-label="Periode">
            ${[7, 28, 90].map((n) => `<button data-act="an-periode" data-v="${n}" aria-pressed="${S.anPeriode === n}">${n} hari</button>`).join('')}
          </div></div>
        </header>
        ${missing.length ? `<section class="card" style="border-color:var(--warn)"><div class="card-h"><h2>${missing.length} channel belum tersambung</h2><p>${isAdmin() ? 'Klik Hubungkan, login dengan akun tokodeeres@gmail.com, lalu pilih channel yang sesuai di layar Google. Ulangi untuk tiap channel.' : 'Minta pemilik menghubungkannya di Pengaturan.'}</p></div>
          <div class="tools">${missing.map((c) => isAdmin() ? `<a class="btn" href="/api/auth/google">${icon('plus')}Hubungkan ${esc(c.nama)}</a>` : `<span class="pill warn">${esc(c.nama)}</span>`).join('')}</div></section>` : ''}
        <section class="kpis" aria-label="Total ${S.anPeriode} hari">
          <div class="kpi"><span class="l">Views</span><span class="v">${show(fmt(cur.views))}</span>${has ? change(cur.views, pv.views) : '<span class="d">belum ada data</span>'}</div>
          <div class="kpi"><span class="l">Jam tonton</span><span class="v">${show(jamMenit(cur.menit))}</span>${has ? change(cur.menit, pv.menit) : ''}</div>
          <div class="kpi"><span class="l">Subscriber bersih</span><span class="v ${cur.naik - cur.turun < 0 ? 'bad' : ''}">${show(signed(cur.naik - cur.turun))}</span>${has ? `<span class="d">+${nf.format(cur.naik)} baru, −${nf.format(cur.turun)} berhenti</span>` : ''}</div>
          <div class="kpi"><span class="l">Rata-rata ditonton</span><span class="v mono" style="font-size:24px">${show(avgDur(cur))}</span><span class="d">menit:detik per view</span></div>
          ${showRev ? `<div class="kpi"><span class="l">Perkiraan pendapatan</span><span class="v">${rpOrDash(cur.rev)}</span>${change(cur.rev, pv.rev)}</div>` : ''}
        </section>
        ${strategiHtml(days, chans)}
        <section class="card" id="kartu-views-harian">
          <div class="card-h"><h2>Views harian per channel</h2><p>Semua video di channel, termasuk video lama.</p></div>
          <div class="chart-legend">${chans.map((c) => `<span><i style="background:${chColor(c.id)}"></i>${esc(c.nama)}</span>`).join('')}</div>
          ${has ? '<div class="chart minh-230" id="an-chart"></div>' : '<div class="empty"><b>Belum ada angka dari YouTube Analytics</b>Hubungkan channel di Pengaturan, lalu klik Sinkronkan sekarang.</div>'}
        </section>
        <div class="grid-3">${chans.map((c) => {
          const t = tot(pick([c.id], days)), p = tot(pick([c.id], prev));
          return `<section class="card" id="an-${esc(c.id)}">
            <div class="card-h"><h2><span class="ed"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${chColor(c.id)}"></i>${esc(c.nama)}</span></h2>${c.connected ? '<span class="pill ok">Tersambung</span>' : '<span class="pill warn">Belum tersambung</span>'}</div>
            ${t.views || t.menit ? `
              <div class="minis" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
                <div class="mini"><h3>Views</h3><div class="v">${fmt(t.views)}</div>${change(t.views, p.views)}</div>
                <div class="mini"><h3>Jam tonton</h3><div class="v">${jamMenit(t.menit)}</div><div class="d">${avgDur(t)} per view</div></div>
                <div class="mini"><h3>Subscriber bersih</h3><div class="v">${signed(t.naik - t.turun)}</div><div class="d">+${nf.format(t.naik)} / −${nf.format(t.turun)}</div></div>
                ${lihatUang() && t.rev != null ? `<div class="mini"><h3>Pendapatan</h3><div class="v">${rpOrDash(t.rev)}</div>${change(t.rev, p.rev)}</div>` : `<div class="mini"><h3>Video baru</h3><div class="v">${nf.format(S.content.filter((x) => x._ch === c.id && days.includes(x._day)).length)}</div><div class="d">di periode ini</div></div>`}
              </div>
              <div class="chart an-spark mt-12" data-ch="${esc(c.id)}"></div>`
            : `<div class="empty"><b>${c.connected ? 'Menunggu data' : 'Belum ada data'}</b>${c.connected ? 'Klik Sinkronkan sekarang di Pengaturan.' : 'Hubungkan channel ini di Pengaturan.'}</div>`}
          </section>`;
        }).join('')}</div>
        <section class="card">
          <div class="card-h"><h2>Perbandingan channel</h2><p>${S.anPeriode} hari sampai ${latest ? tglPendek(latest) : '—'}.</p></div>
          <div class="table-wrap"><table class="t stack"><thead><tr><th>Channel</th><th class="num">Views</th><th class="num">Jam tonton</th><th class="num">Ditonton / view</th><th class="num">Sub baru</th><th class="num">Berhenti</th><th class="num">Bersih</th>${showRev ? '<th class="num">Pendapatan</th>' : ''}<th class="num">Video baru</th></tr></thead><tbody>
            ${chans.map((c) => { const t = tot(pick([c.id], days)); if (!pick([c.id], days).length) return `<tr><td class="full"><span class="ed"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${chColor(c.id)}"></i>${esc(c.nama)}</span></td><td colspan="${showRev ? 8 : 7}" class="muted full">Belum ada data${c.connected ? '' : ' · belum tersambung'}</td></tr>`; return `<tr><td class="full"><b><span class="ed"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${chColor(c.id)}"></i>${esc(c.nama)}</span></b></td><td class="num" data-label="Views">${nf.format(t.views)}</td><td class="num" data-label="Jam tonton">${jamMenit(t.menit)}</td><td class="num mono" data-label="Ditonton / view">${avgDur(t)}</td><td class="num" data-label="Sub baru">${nf.format(t.naik)}</td><td class="num" data-label="Berhenti">${nf.format(t.turun)}</td><td class="num" data-label="Bersih">${signed(t.naik - t.turun)}</td>${showRev ? `<td class="num" data-label="Pendapatan">${t.rev == null ? '—' : rpOrDash(t.rev)}</td>` : ''}<td class="num" data-label="Video baru">${nf.format(S.content.filter((x) => x._ch === c.id && days.includes(x._day)).length)}</td></tr>`; }).join('')}
          </tbody></table></div>
        </section>`;
  };

// Revenue and growth advice computed from the channels' own numbers. A rule shows only when
// there is enough data behind it, and each one states the numbers it is based on.
function strategiHtml(days, chans) {
  const admin = lihatUang();
  const out = [];
  const money = rpOrDash;
  const period = S.anPeriode + ' hari';
  const recent = (n) => S.content.filter((c) => c._age >= 2 && c._age <= n);
  const dayRows = (id) => S.daily.filter((d) => d.channel_id === id && days.includes(d.tanggal));

  // 1. Channels not yet sending revenue numbers
  if (admin) {
    chans.filter((c) => !c.connected).forEach((c) => out.push({
      impact: 1e9, title: `Sambungkan YouTube Analytics ${esc(c.nama)}`,
      why: 'Tanpa sambungan, pendapatan, jam tonton dan retensi channel ini tidak terbaca, jadi saran di bawah tidak menghitungnya.',
      act: 'Pengaturan → Hubungkan, login tokodeeres@gmail.com, pilih channel ini.',
    }));
    chans.filter((c) => c.connected && dayRows(c.id).length >= 7 && dayRows(c.id).every((d) => d.revenue == null)).forEach((c) => out.push({
      impact: 9e8, title: `${esc(c.nama)} belum menghasilkan pendapatan iklan`,
      why: `YouTube tidak mengirim angka pendapatan untuk channel ini selama ${period}, padahal views-nya ${fmt(sum(dayRows(c.id), (d) => d.views))}.`,
      act: 'Cek YouTube Studio → Hasilkan uang. Syarat umum Program Partner: 1.000 subscriber dan 4.000 jam tonton publik dalam 12 bulan, atau 10 juta views Shorts dalam 90 hari.',
    }));
  }

  // 2. Revenue per 1,000 views by channel
  if (admin) {
    const rpm = chans.map((c) => { const r = dayRows(c.id); const v = sum(r, (d) => d.views); const rev = r.some((d) => d.revenue != null) ? sum(r, (d) => d.revenue || 0) : null; return { c, v, rev, rpm: rev != null && v >= 1000 ? (rev / v) * 1000 : null }; }).filter((x) => x.rpm != null);
    if (rpm.length >= 2) {
      rpm.sort((a, b) => b.rpm - a.rpm);
      const hi = rpm[0], lo = rpm[rpm.length - 1];
      if (lo.rpm > 0 ? hi.rpm / lo.rpm >= 1.5 : hi.rpm > 0) {
        out.push({
          impact: (hi.rpm - lo.rpm) * lo.v / 1000,
          title: `${esc(hi.c.nama)} paling menguntungkan per view`,
          why: `Pendapatan per 1.000 views (${period}): ` + rpm.map((x) => `${esc(x.c.nama)} <b>${money(x.rpm)}</b>`).join(' · ') + '.',
          act: `Arahkan penonton ${esc(lo.c.nama)} ke ${esc(hi.c.nama)} lewat layar akhir, kartu dan playlist, dan tambah slot jadwal di ${esc(hi.c.nama)} bila tim sanggup.`,
        });
      }
    }
  }

  // 3. Long videos vs Shorts
  if (admin) {
    const vids = recent(90).filter((c) => c.revenue != null && c.views >= 100);
    const by = (t) => { const v = vids.filter((c) => c.tipe_video === t); return { n: v.length, rpm: sum(v, (c) => c.views) ? (sum(v, (c) => c.revenue) / sum(v, (c) => c.views)) * 1000 : 0 }; };
    const L = by('long'), Sh = by('short');
    if (L.n >= 3 && Sh.n >= 3 && L.rpm >= Sh.rpm * 1.5) {
      const topShorts = vids.filter((c) => c.tipe_video === 'short').sort((a, b) => b.views - a.views).slice(0, 2);
      const shareLong = L.n / (L.n + Sh.n);
      out.push({
        impact: (L.rpm - Sh.rpm) * sum(topShorts, (c) => c.views) / 1000 + 1,
        title: `Video panjang menghasilkan ${(L.rpm / Math.max(Sh.rpm, 0.0001)).toFixed(1).replace('.', ',')}× lebih banyak per view`,
        why: `Per 1.000 views: video panjang <b>${money(L.rpm)}</b> (${L.n} video), Shorts <b>${money(Sh.rpm)}</b> (${Sh.n} video), 90 hari terakhir. Video panjang baru ${pct(shareLong)} dari upload.`,
        act: `Buat versi panjang (8 menit atau lebih, supaya bisa dipasang iklan tengah) dari Shorts terlaris: ${topShorts.map((c) => '“' + esc(c.judul) + '”').join(', ')}. Di Shorts-nya, tautkan video panjang tersebut.`,
      });
    } else if (L.n >= 3 && Sh.n >= 3 && Sh.rpm >= L.rpm * 1.5) {
      out.push({
        impact: 1, title: 'Shorts menghasilkan lebih banyak per view daripada video panjang',
        why: `Per 1.000 views: Shorts <b>${money(Sh.rpm)}</b> (${Sh.n} video), video panjang <b>${money(L.rpm)}</b> (${L.n} video), 90 hari terakhir.`,
        act: 'Pertahankan porsi Shorts, dan pendekkan video panjang yang retensinya turun cepat.',
      });
    }
  }

  // 4. Topics that earn (owner) or draw views (everyone) the most
  {
    const vids = recent(90).filter((c) => (admin ? c.revenue != null : true));
    const metric = (c) => (admin ? c.revenue : c.views);
    const overall = median(vids.map(metric));
    const groups = {};
    vids.forEach((c) => { if (c._topik !== 'Lainnya') (groups[c._topik] ||= []).push(c); });
    const best = Object.entries(groups).filter(([, l]) => l.length >= 3).map(([t, l]) => ({ t, l, m: median(l.map(metric)) })).sort((a, b) => b.m - a.m)[0];
    if (best && overall > 0 && best.m / overall >= 1.3) {
      const top = best.l.reduce((a, b) => (metric(b) > metric(a) ? b : a));
      out.push({
        impact: admin ? (best.m - overall) * 10 : 0.5,
        title: `Perbanyak topik “${esc(best.t)}”`,
        why: admin
          ? `Median pendapatan per video topik ini <b>${money(best.m)}</b>, sedangkan median semua video ${money(overall)} (${best.l.length} video, 90 hari).`
          : `Median views per video topik ini <b>${fmt(best.m)}</b>, sedangkan median semua video ${fmt(overall)} (${best.l.length} video, 90 hari).`,
        act: `Jadikan topik ini menu tetap di jadwal mingguan. Contoh terbaik: “${esc(top.judul)}” (${esc(top._chNama)}).`,
      });
    }
  }

  // 5. Best publishing time per channel
  chans.forEach((c) => {
    const vids = recent(60).filter((x) => x._ch === c.id);
    const med = median(vids.map((x) => x.views));
    if (vids.length < 9 || !med) return;
    const buckets = {};
    vids.forEach((x) => { const h = Math.floor(+x._jam.slice(0, 2) / 3) * 3; (buckets[h] ||= []).push(x.views); });
    const best = Object.entries(buckets).filter(([, l]) => l.length >= 3).map(([h, l]) => ({ h: +h, n: l.length, m: median(l) })).sort((a, b) => b.m - a.m)[0];
    if (!best || best.m / med < 1.25 || best.n / vids.length > 0.6) return;
    const hh = (h) => String(h).padStart(2, '0') + ':00';
    out.push({
      impact: ((best.m - med) * (vids.length - best.n)) / 1e6 + 0.3,
      title: `${esc(c.nama)}: tayang di jam ${hh(best.h)}–${hh(best.h + 3)} lebih ramai`,
      why: `Median views video yang tayang di jam itu <b>${fmt(best.m)}</b>, sedangkan median channel ${fmt(med)} (${best.n} dari ${vids.length} video, 60 hari).`,
      act: 'Geser satu slot jadwal karyawan ke jam ini (menu Karyawan → Ubah → Jadwal tayang).',
    });
  });

  // 6. Days without uploads
  chans.forEach((c) => {
    const rows = dayRows(c.id);
    const upDays = new Set(S.content.filter((x) => x._ch === c.id).map((x) => x._day));
    const withUp = rows.filter((d) => upDays.has(d.tanggal)), without = rows.filter((d) => !upDays.has(d.tanggal));
    if (withUp.length < 4 || without.length < 4) return;
    const a = sum(withUp, (d) => d.views) / withUp.length, b = sum(without, (d) => d.views) / without.length;
    if (!b || a / b < 1.1) return;
    out.push({
      impact: ((a - b) * without.length) / 1e6 + 0.2,
      title: `${esc(c.nama)}: jangan ada hari tanpa upload`,
      why: `Hari dengan upload rata-rata <b>${fmt(a)}</b> views, hari tanpa upload ${fmt(b)} (${Math.round((1 - b / a) * 100)}% lebih rendah). Ada ${without.length} hari kosong dalam ${period}.`,
      act: 'Pastikan minimal satu video tiap hari. Siapkan stok 2–3 video untuk hari libur atau saat karyawan berhalangan.',
    });
  });

  const list = out.sort((a, b) => b.impact - a.impact).slice(0, 6);
  return `<section class="card" id="kartu-strategi">
      <div class="card-h"><h2>${admin ? 'Strategi menaikkan pendapatan' : 'Strategi menaikkan views'}</h2><p>Dihitung dari data channel Anda sendiri, diurutkan dari dampak terbesar. Saran hanya muncul bila datanya cukup.${admin ? '' : ' Masuk sebagai pemilik untuk saran berbasis pendapatan.'}</p></div>
      ${list.length ? `<ol class="advice">${list.map((x) => `<li><div class="t"><b>${x.title}</b><div class="why">${x.why}</div><div class="act">${icon('bulb')}<span>${x.act}</span></div></div></li>`).join('')}</ol>`
        : '<div class="empty"><b>Belum cukup data untuk saran</b>Butuh setidaknya beberapa minggu angka YouTube Analytics dan video berumur 2 hari atau lebih.</div>'}
    </section>`;
}

AFTER.analytics = function () {
    const chans = analyticsChannels();
    const latest = S.daily.reduce((m, d) => (d.tanggal > m ? d.tanggal : m), '') || addDays(today(), -2);
    const days = daysBack(S.anPeriode, latest);
    const val = (id, d) => (S.daily.find((x) => x.channel_id === id && x.tanggal === d) || {}).views || 0;
    const box = $('#an-chart');
    if (box) drawStacked(box, { days, series: chans.map((c) => ({ name: c.nama, color: chColor(c.id), values: days.map((d) => val(c.id, d)) })), label: 'Views harian per channel' });
    $$('.an-spark').forEach((el) => drawSparkbars(el, days.map((d) => val(el.dataset.ch, d)), chColor(el.dataset.ch)));
  };
