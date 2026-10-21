dash.calc('hari', {
  inputs: ['video', 'tugas'],
  title: 'Rekap harian karyawan',
  description: 'Per karyawan per hari: video tayang, tepat jadwal, tugas lain, dan skor 0–100 (video 35, jadwal 25, views 20, tugas 20).',
  fn: (video, tugas) => {
    const TARGET = 3, TOL = 15, CAP = 1.2;
    const TUGAS = { 'Balas komentar': 30, 'Riset harga cabai': 1, 'Buat thumbnail': 3, 'Cek SEO & tag': 3 };
    const d10 = (s) => String(s).slice(0, 10);
    const mnt = (s) => { const p = String(s).split(':').map(Number); return p[0] * 60 + p[1]; };
    const days = [...new Set([...video, ...tugas].map((r) => d10(r.Tanggal)))].sort();
    const names = [...new Set([...video, ...tugas].map((r) => r.Karyawan))].sort();
    const out = [];
    for (const d of days) {
      const today = video.filter((r) => d10(r.Tanggal) === d);
      for (const k of names) {
        const v = today.filter((r) => r.Karyawan === k);
        const n = v.length;
        const tepat = v.filter((r) => mnt(r.Jam_Tayang) - mnt(r.Jadwal) <= TOL).length;
        const ratios = v.map((r) => {
          const same = today.filter((x) => x.Channel === r.Channel);
          const avg = same.reduce((s, x) => s + Number(x.Views), 0) / same.length;
          return avg ? Number(r.Views) / avg : 1;
        });
        const tg = tugas.filter((r) => d10(r.Tanggal) === d && r.Karyawan === k);
        const done = (j) => tg.filter((r) => r.Tugas === j).reduce((a, r) => a + Number(r.Jumlah), 0);
        const jenis = Object.keys(TUGAS);
        const produktif = Math.min(n / TARGET, 1) * 35;
        const jadwal = n ? (tepat / n) * 25 : 0;
        const kualitas = n ? Math.min(ratios.reduce((s, x) => s + x, 0) / n / CAP, 1) * 20 : 0;
        const tugasPt = (jenis.reduce((s, j) => s + Math.min(done(j) / TUGAS[j], 1), 0) / jenis.length) * 20;
        const skor = Math.round(produktif + jadwal + kualitas + tugasPt);
        out.push({
          Tanggal: d, Karyawan: k, video: n, target: TARGET, tepat, telat: n - tepat,
          views: v.reduce((s, r) => s + Number(r.Views), 0),
          komentar: done('Balas komentar'), riset: done('Riset harga cabai'), thumbnail: done('Buat thumbnail'), seo: done('Cek SEO & tag'),
          skor, nilai: skor >= 85 ? 'A' : skor >= 70 ? 'B' : skor >= 55 ? 'C' : 'D',
        });
      }
    }
    return out;
  },
});

dash.calc('linimasa', {
  inputs: ['video', 'tugas'],
  title: 'Linimasa aktivitas',
  description: 'Semua video tayang dan tugas lain per karyawan, diurutkan menurut jam. Video telat bila tayang lebih dari 15 menit setelah jadwal.',
  fn: (video, tugas) => {
    const d10 = (s) => String(s).slice(0, 10);
    const mnt = (s) => { const p = String(s).split(':').map(Number); return p[0] * 60 + p[1]; };
    const rows = [
      ...video.map((r) => {
        const late = mnt(r.Jam_Tayang) - mnt(r.Jadwal);
        return {
          id: d10(r.Tanggal) + ' ' + r.Karyawan + ' ' + r.Jam_Tayang + ' video ' + r.Channel,
          Tanggal: d10(r.Tanggal), Karyawan: r.Karyawan, Jam: r.Jam_Tayang, Aktivitas: 'Upload video',
          Detail: r.Channel + ': ' + r.Judul,
          Hasil: (late > 15 ? 'Telat ' + late + ' menit' : 'Tepat jadwal ' + r.Jadwal) + ' · ' + Number(r.Views).toLocaleString('id-ID') + ' views',
          telat: late > 15,
        };
      }),
      ...tugas.map((r, i) => ({
        id: d10(r.Tanggal) + ' ' + r.Karyawan + ' ' + r.Jam + ' tugas ' + i,
        Tanggal: d10(r.Tanggal), Karyawan: r.Karyawan, Jam: r.Jam, Aktivitas: r.Tugas, Detail: r.Detail,
        Hasil: r.Tugas === 'Balas komentar' ? r.Jumlah + ' komentar' : 'Selesai', telat: false,
      })),
    ];
    return rows.sort((a, b) => a.Tanggal.localeCompare(b.Tanggal) || a.Karyawan.localeCompare(b.Karyawan) || a.Jam.localeCompare(b.Jam));
  },
});

dash.calc('topik', {
  inputs: ['video'],
  title: 'Saran topik',
  description: 'Rata-rata views per video tiap topik dibagi rata-rata channel-nya, tanpa video 2 hari terakhir. 1,2× ke atas Perbanyak, di bawah 0,8× Kurangi, kurang dari 2 video Uji lagi.',
  fn: (video) => {
    const D = 86400000;
    const day = (s) => Date.parse(String(s).slice(0, 10));
    const last = Math.max(...video.map((r) => day(r.Tanggal)));
    const ok = video.filter((r) => day(r.Tanggal) <= last - 2 * D);
    const avg = (a) => a.reduce((s, r) => s + Number(r.Views), 0) / a.length;
    const out = [];
    for (const c of [...new Set(ok.map((r) => r.Channel))]) {
      const vc = ok.filter((r) => r.Channel === c), base = avg(vc);
      for (const t of [...new Set(vc.map((r) => r.Topik))]) {
        const vt = vc.filter((r) => r.Topik === t);
        const rasio = avg(vt) / base;
        const best = vt.reduce((a, b) => (Number(b.Views) > Number(a.Views) ? b : a));
        const saran = vt.length < 2 ? 'Uji lagi' : rasio >= 1.2 ? 'Perbanyak' : rasio < 0.8 ? 'Kurangi' : 'Pertahankan';
        out.push({ Channel: c, Topik: t, video: vt.length, rasio, saran, contoh: best.Judul });
      }
    }
    return out.sort((a, b) => a.Channel.localeCompare(b.Channel) || b.rasio - a.rasio);
  },
});

(function () {
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const asDate = (s) => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
  const tglPanjang = (s) => { const d = asDate(s); return HARI[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + BLN[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
  const tglPendek = (s) => { const d = asDate(s); return d.getUTCDate() + ' ' + BLN[d.getUTCMonth()]; };
  const nf = new Intl.NumberFormat('id-ID');
  const enc = encodeURIComponent;
  const ROLE = { Alivia: 'Editor', Deni: 'Editor terbatas' };
  const NILAI_TONE = { A: 'ok', B: 'mut', C: 'warn', D: 'bad' };

  const input = document.getElementById('tanggal');
  const prev = document.getElementById('hari-sebelum'), next = document.getElementById('hari-sesudah');
  let days = [];
  const pick = () => dash.params().tanggal;
  const go = (d) => { if (d) dash.setParams({ tanggal: d }); };
  prev.addEventListener('click', () => go(days[days.indexOf(pick()) - 1]));
  next.addEventListener('click', () => go(days[days.indexOf(pick()) + 1]));
  input.addEventListener('change', () => { if (input.value && input.validity.valid && days.includes(input.value)) go(input.value); });
  input.addEventListener('blur', () => { input.value = pick() || ''; });

  // Personal link: /harian/#alivia or /harian/#deni puts that person's card first with a greeting.
  const CFG = window.PANTAU_CONFIG || {};
  const viewer = { avatars: Object.assign({}, CFG.foto || {}) };
  if (CFG.peran) Object.assign(ROLE, CFG.peran);
  const isViewer = (k) => location.hash.slice(1).toLowerCase() === k.toLowerCase();
  window.addEventListener('hashchange', () => drawAll());
  function avatar(k, i) {
    const initials = () => {
      const d = document.createElement('div');
      d.className = 'kp-ava';
      d.style.background = dash.colors[i % dash.colors.length];
      d.textContent = k.slice(0, 1).toUpperCase();
      d.setAttribute('aria-hidden', 'true');
      return d;
    };
    const url = viewer.avatars[k];
    if (!url) return initials();
    const img = document.createElement('img');
    img.className = 'kp-ava';
    img.alt = 'Foto ' + k;
    img.src = url;
    img.addEventListener('error', () => img.replaceWith(initials()));
    return img;
  }

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const mark = (e, src, field, where) => { e.dataset.source = src; e.dataset.field = field; e.dataset.where = where; return e; };
  function fail(box) { box.classList.remove('dash-skeleton'); const d = el('div', 'kp-fail'); d.append(el('i'), 'Gagal memuat'); box.replaceChildren(d); }

  function drawNav() {
    const h = dash.data('hari');
    if (h.status !== 'ok') return;
    days = [...new Set(h.data.map((r) => r.Tanggal))].sort();
    if (!days.length) return;
    if (!days.includes(pick())) { go(days.at(-1)); return; }
    input.min = days[0]; input.max = days.at(-1);
    if (input !== document.activeElement) input.value = pick();
    const i = days.indexOf(pick());
    prev.disabled = i <= 0; next.disabled = i >= days.length - 1;
  }

  function gaps(r) {
    const g = [];
    if (r.video < r.target) g.push((r.target - r.video) + ' video kurang');
    if (r.telat) g.push(r.telat + ' video telat');
    if (r.riset < 1) g.push('riset harga belum');
    if (r.thumbnail < 3) g.push('thumbnail ' + r.thumbnail + '/3');
    if (r.seo < 3) g.push('cek SEO ' + r.seo + '/3');
    if (r.komentar < 30) g.push('komentar ' + r.komentar + '/30');
    return g;
  }

  function drawTakeaway() {
    const p = document.getElementById('ringkasan-hari'), h = dash.data('hari'), d = pick();
    if (h.status !== 'ok') { if (h.status === 'error') p.textContent = 'Data gagal dimuat.'; return; }
    const rows = h.data.filter((r) => r.Tanggal === d);
    if (!rows.length) return;
    const b = (text, field, r) => mark(el('b', null, text), 'hari', field, 'Tanggal=' + enc(r.Tanggal) + '&Karyawan=' + enc(r.Karyawan));
    const parts = [tglPanjang(d) + '. '];
    rows.forEach((r) => {
      const g = gaps(r);
      parts.push(r.Karyawan + ': ', b(nf.format(r.video), 'video', r), ' dari ' + r.target + ' video, skor ', b(nf.format(r.skor), 'skor', r), g.length ? ' (' + g.join(', ') + '). ' : ', semua tugas beres. ');
    });
    p.replaceChildren(...parts);
  }

  function drawPerson(card, i) {
    const k = card.dataset.k, d = pick();
    const h = dash.data('hari'), l = dash.data('linimasa');
    if (h.status === 'error' || l.status === 'error') { fail(card); return; }
    if (h.status !== 'ok' || l.status !== 'ok' || !d) return;
    card.classList.remove('dash-skeleton');
    const r = h.data.find((x) => x.Tanggal === d && x.Karyawan === k);
    const where = 'Tanggal=' + enc(d) + '&Karyawan=' + enc(k);
    const nodes = [];

    const who = el('div', 'kp-who');
    const txt = el('div');
    txt.append(el('div', 'nm', (isViewer(k) ? 'Halo, ' : '') + k), el('div', 'kp-lbl', ROLE[k] || 'Karyawan'));
    const sc = el('div', 'kp-score');
    if (r) {
      sc.append(el('span', 'kp-lbl', 'Skor hari ini'), mark(el('span', 'n', nf.format(r.skor)), 'hari', 'skor', where), mark(el('span', 'kp-pill ' + NILAI_TONE[r.nilai], 'Nilai ' + r.nilai), 'hari', 'nilai', where));
    }
    who.append(avatar(k, i), txt, sc);
    nodes.push(who);

    if (r) {
      const checks = el('div', 'kp-checks');
      [
        ['Video tayang', 'video', r.video, r.target],
        ['Tepat jadwal', 'tepat', r.tepat, r.video],
        ['Thumbnail', 'thumbnail', r.thumbnail, 3],
        ['Cek SEO & tag', 'seo', r.seo, 3],
        ['Riset harga', 'riset', r.riset, 1],
        ['Balas komentar', 'komentar', r.komentar, 30],
      ].forEach(([label, field, val, target]) => {
        const c = el('div', 'kp-check');
        const v = el('div', 'v ' + (val >= target ? 'ok' : val > 0 ? 'warn' : 'bad'));
        v.append(mark(el('span', null, nf.format(val)), 'hari', field, where), el('small', null, ' / ' + nf.format(target)));
        c.append(el('span', 'kp-lbl', label), v);
        checks.append(c);
      });
      nodes.push(checks);
    }

    const mine = h.data.filter((x) => x.Karyawan === k).slice(-14);
    const strip = el('div', 'kp-strip');
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', 'Skor 14 hari terakhir ' + k);
    mine.forEach((x) => {
      const btn = mark(el('button', x.nilai, String(x.skor)), 'hari', 'skor', 'Tanggal=' + enc(x.Tanggal) + '&Karyawan=' + enc(k));
      btn.type = 'button';
      btn.title = tglPendek(x.Tanggal) + ': skor ' + x.skor;
      btn.setAttribute('aria-label', tglPendek(x.Tanggal) + ', skor ' + x.skor);
      btn.setAttribute('aria-pressed', String(x.Tanggal === d));
      btn.addEventListener('click', () => go(x.Tanggal));
      strip.append(btn);
    });
    const sl = el('div', 'kp-striplbl');
    if (mine.length) sl.append(el('span', null, tglPendek(mine[0].Tanggal)), el('span', null, 'Skor 14 hari, klik untuk lihat harinya'), el('span', null, tglPendek(mine.at(-1).Tanggal)));
    nodes.push(sl, strip);

    const items = l.data.filter((x) => x.Tanggal === d && x.Karyawan === k);
    nodes.push(el('h3', null, 'Yang dikerjakan'));
    if (!items.length) {
      nodes.push(el('div', 'kp-empty', 'Belum ada aktivitas tercatat di hari ini.'));
    } else {
      const box = el('div', 'kp-tablebox');
      const table = el('table');
      table.dataset.source = 'linimasa';
      table.dataset.rowKey = 'id';
      const hr = el('tr');
      [['Jam', 'Jam'], ['Aktivitas', 'Aktivitas'], ['Detail', 'Detail'], ['Hasil', 'Hasil']].forEach(([f, t]) => { const th = el('th', null, t); th.dataset.field = f; hr.append(th); });
      const thead = el('thead'); thead.append(hr);
      const tb = el('tbody');
      items.forEach((x) => {
        const tr = el('tr', x.Aktivitas === 'Upload video' ? 'up' : '');
        tr.dataset.key = enc(x.id);
        const hasil = el('td');
        hasil.append(el('span', 'kp-pill ' + (x.telat ? 'bad' : x.Aktivitas === 'Upload video' ? 'ok' : 'mut'), x.Hasil));
        tr.append(el('td', 'jam', x.Jam), el('td', 'akt', x.Aktivitas), el('td', 'det', x.Detail), hasil);
        tb.append(tr);
      });
      table.append(thead, tb);
      box.append(table);
      nodes.push(box);
    }
    card.replaceChildren(...nodes);
  }

  function drawIdeas() {
    const ul = document.getElementById('daftar-ide'), t = dash.data('topik');
    if (t.status !== 'ok') { if (t.status === 'error') fail(ul); return; }
    ul.classList.remove('dash-skeleton');
    const chans = [...new Set(t.data.map((r) => r.Channel))];
    ul.replaceChildren(...chans.map((c) => {
      const rows = t.data.filter((r) => r.Channel === c);
      const best = rows[0], worst = rows.filter((r) => r.saran === 'Kurangi').at(-1);
      const w = (r) => 'Channel=' + enc(r.Channel) + '&Topik=' + enc(r.Topik);
      const li = el('li');
      const tp = el('div', 'tp');
      tp.append(mark(el('span', null, best.Topik), 'topik', 'Topik', w(best)), ' ', mark(el('span', 'kp-pill ' + (best.saran === 'Perbanyak' ? 'ok' : 'mut'), best.rasio.toFixed(1).replace('.', ',') + '× rata-rata'), 'topik', 'rasio', w(best)));
      li.append(el('span', 'ch', c), tp, el('span', 'ex', 'Contoh terbaik: ' + best.contoh));
      if (worst && worst !== best) li.append(el('span', 'ex', 'Kurangi: ' + worst.Topik + ' (' + worst.rasio.toFixed(1).replace('.', ',') + '×)'));
      return li;
    }));
  }

  function drawAll() {
    drawNav();
    drawTakeaway();
    const cards = [...document.querySelectorAll('#hari-ini [data-k]')];
    const wrap = document.getElementById('hari-ini');
    const first = cards.find((c) => isViewer(c.dataset.k));
    if (first && wrap.firstElementChild !== first) wrap.prepend(first);
    cards.forEach((c) => drawPerson(c, ['Alivia', 'Deni'].indexOf(c.dataset.k)));
    drawIdeas();
  }
  dash.onData(drawAll);

  const target = document.getElementById(location.hash.slice(1).toLowerCase());
  if (target) target.scrollIntoView();
})();
