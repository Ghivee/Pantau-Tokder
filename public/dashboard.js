// ============ STATE (Terhubung ke Backend) ============
let editors = [];
let content = [];
let nextEditorId = 5;

// Initial dummy data will be overwritten by fetch if successful
let dummyContent = [
  { id: 1, editor_id: 1, platform: "youtube", judul: "Panduan pemupukan cabe rawit agar berbuah lebat", tanggal_upload: "2026-07-01 14:30 WIB", url: "https://youtube.com/watch?v=demo1", views: 24500, likes: 1820, comments: 142, status_identifikasi: "matched" },
  { id: 2, editor_id: 2, platform: "instagram", judul: "Cara ampuh mengatasi hama patek pada cabe", tanggal_upload: "2026-07-03 09:15 WIB", url: "https://instagram.com/p/demo2", views: 18200, likes: 2140, comments: 88, status_identifikasi: "matched" },
  { id: 3, editor_id: 1, platform: "instagram", judul: "Rahasia semai bibit cabe 100% tumbuh subur", tanggal_upload: "2026-07-05 16:45 WIB", url: "https://instagram.com/p/demo3", views: 15800, likes: 1290, comments: 54, status_identifikasi: "matched" },
  { id: 6, editor_id: null, platform: "instagram", judul: "Panen raya cabe merah keriting musim kemarau", tanggal_upload: "2026-07-09 10:00 WIB", url: "https://instagram.com/p/demo6", views: 6400, likes: 340, comments: 12, status_identifikasi: "unmatched" }
];

let filters = { editor: "all", platform: "all", range: "30" };
let chartInstance = null;
let assignTargetId = null;

// ============ THEME TOGGLE ============
const body = document.body;
const themeToggleBtn = document.getElementById("sidebarThemeToggle");

function applyThemeToBtn(theme) {
  if (!themeToggleBtn) return;
  if (theme === "dark") {
    themeToggleBtn.innerHTML = '<i data-lucide="sun" class="theme-icon" style="width: 18px; height: 18px; color: #F59F00;"></i>';
    themeToggleBtn.title = "Mode Terang";
  } else {
    themeToggleBtn.innerHTML = '<i data-lucide="moon" class="theme-icon" style="width: 18px; height: 18px; color: #63E6BE;"></i>';
    themeToggleBtn.title = "Mode Gelap";
  }
  lucide.createIcons({ root: themeToggleBtn });
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = body.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    body.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    applyThemeToBtn(newTheme);
  });
}

// Init theme
const savedTheme = localStorage.getItem("theme") || "light";
body.setAttribute("data-theme", savedTheme);
applyThemeToBtn(savedTheme);


// ============ HELPERS ============
function fmt(n) { 
  if (!n) return "0";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + "k"; 
  return n.toString(); 
}
function platformLabel(p) { return { youtube: "YouTube", instagram: "Instagram", facebook: "Facebook" }[p] || p; }
function platformClass(p) { return { youtube: "plat-yt", instagram: "plat-ig", facebook: "plat-fb" }[p] || ""; }
function editorById(id) { return editors.find(e => e.id === id); }

function showToast(msg, isError = false) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${isError ? 'toast-error' : ''}`;
  toast.innerHTML = `<i data-lucide="${isError ? 'alert-circle' : 'check-circle-2'}" style="width:18px;height:18px;"></i> <span>${msg}</span>`;
  container.appendChild(toast);
  lucide.createIcons({ root: toast });
  
  setTimeout(() => {
    toast.classList.add("hiding");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function openModal(id) { document.getElementById(id).classList.add("active"); }
function closeModal(id) { document.getElementById(id).classList.remove("active"); }
document.querySelectorAll("[data-close]").forEach(b => {
  b.addEventListener("click", e => e.target.closest(".overlay").classList.remove("active"));
});
document.querySelectorAll(".overlay").forEach(o => {
  o.addEventListener("click", e => { if (e.target === o) o.classList.remove("active"); });
});

function filteredContent() {
  return content.filter(c => {
    if (filters.editor !== "all" && String(c.editor_id) !== filters.editor) return false;
    if (filters.platform !== "all" && c.platform !== filters.platform) return false;
    return true;
  });
}

// ============ NAV ============
const asideEl = document.querySelector("aside");
const overlayEl = document.getElementById("sidebarOverlay");

function closeMobileMenu() {
  if (asideEl.classList.contains("show-mobile")) {
    asideEl.classList.remove("show-mobile");
    overlayEl.classList.remove("show");
  }
}

document.getElementById("mobileMenuBtn")?.addEventListener("click", () => {
  asideEl.classList.add("show-mobile");
  overlayEl.classList.add("show");
});

overlayEl?.addEventListener("click", closeMobileMenu);

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
    item.classList.add("active");
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById("view-" + item.dataset.view).classList.add("active");
    if (item.dataset.view === "pengaturan") renderCodeTable();
    closeMobileMenu();
  });
});

// ============ RENDER: DASHBOARD ============
function populateEditorFilter() {
  const sel = document.getElementById("filterEditor");
  sel.innerHTML = '<option value="all">Semua editor</option>' +
    editors.map(e => `<option value="${e.id}">${e.nama}</option>`).join("");
}

function renderMetrics() {
  const data = filteredContent();
  const totalViews = data.reduce((s, c) => s + (c.views || 0), 0);
  const totalLikes = data.reduce((s, c) => s + (c.likes || 0), 0);
  const unmatched = data.filter(c => c.status_identifikasi === "unmatched").length;
  
  document.getElementById("metricCards").innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Total konten</div>
      <div class="metric-value num">${data.length}</div>
      <div class="metric-delta up">Sesuai filter</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Total views</div>
      <div class="metric-value num">${fmt(totalViews)}</div>
      <div class="metric-delta up">Sesuai filter</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Total likes</div>
      <div class="metric-value num">${fmt(totalLikes)}</div>
      <div class="metric-delta up">Sesuai filter</div>
    </div>
    <div class="metric-card warn-card">
      <div class="metric-label">Belum teridentifikasi</div>
      <div class="metric-value num">${unmatched}</div>
      <div class="metric-delta">Perlu ditinjau</div>
    </div>
  `;
}

function renderLeaderboard() {
  const data = filteredContent();
  const stats = editors.map(e => {
    const items = data.filter(c => c.editor_id === e.id);
    const views = items.reduce((s, c) => s + (c.views || 0), 0);
    return { ...e, count: items.length, views };
  }).sort((a, b) => b.views - a.views);
  
  const maxViews = Math.max(...stats.map(s => s.views), 1);
  document.getElementById("editorLeaderboard").innerHTML = stats.map(s => `
    <div class="editor-row" data-editor="${s.id}">
      <div class="editor-id">
        <div class="avatar">${s.nama.slice(0, 2).toUpperCase()}</div>
        <div><div class="editor-name">${s.nama}</div><div class="editor-count">${s.count} konten</div></div>
      </div>
      <div class="editor-metric">
        <div class="editor-views num">${fmt(s.views)} views</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(s.views / maxViews * 100).toFixed(0)}%"></div></div>
      </div>
    </div>
  `).join("") || '<div class="empty-note">Belum ada data performa.</div>';
  
  document.querySelectorAll("#editorLeaderboard .editor-row").forEach(row => {
    row.addEventListener("click", () => openEditorModal(Number(row.dataset.editor)));
  });
}

function contentRowHtml(c) {
  const editor = editorById(c.editor_id);
  return `
    <tr class="clickable" data-content="${c.id}">
      <td class="content-title">${c.judul}</td>
      <td><span class="plat ${platformClass(c.platform)}">${platformLabel(c.platform)}</span></td>
      <td>${editor ? editor.nama : "—"}</td>
      <td class="num-cell">${fmt(c.views)}</td>
      <td class="num-cell">${fmt(c.likes)}</td>
      <td class="num-cell">${fmt(c.comments || c.komentar)}</td>
      <td>${c.status_identifikasi === "matched" ? '<span class="status-pill status-ok">Teridentifikasi</span>' : '<span class="status-pill status-warn">Perlu ditinjau</span>'}</td>
    </tr>`;
}

function renderTable() {
  const data = filteredContent();
  document.getElementById("tableCount").textContent = `${data.length} item`;
  document.getElementById("contentTable").innerHTML = data.map(contentRowHtml).join("") || `<tr><td colspan="7" class="empty-note">Tidak ada konten sesuai filter.</td></tr>`;
  attachRowClicks("contentTable");
}

function attachRowClicks(tbodyId) {
  document.querySelectorAll(`#${tbodyId} tr[data-content]`).forEach(row => {
    row.addEventListener("click", () => openContentModal(Number(row.dataset.content)));
  });
}

function renderChart() {
  const base = { 7: [9800, 11200], 30: [28400, 35200, 41800, 39600], 90: [61000, 58200, 72400, 69800, 74100, 81200] }[filters.range];
  const labels = base.map((_, i) => `Periode ${i + 1}`);
  const ctx = document.getElementById("trendChart");
  if (!ctx) return;
  if (typeof Chart === "undefined") {
    ctx.outerHTML = '<div class="empty-note">Gagal memuat grafik. Periksa koneksi internet Anda.</div>';
    return;
  }
  
  if (chartInstance) chartInstance.destroy();
  
  const isDark = document.body.getAttribute("data-theme") === "dark";
  const lineColor = isDark ? "#63E6BE" : "#1F6B5C";
  const bgColor = isDark ? "rgba(99, 230, 190, 0.1)" : "rgba(31, 107, 92, 0.08)";
  const gridColor = isDark ? "#2D2D2D" : "#E9ECEF";
  const textColor = isDark ? "#A0A0A0" : "#6C757D";

  chartInstance = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ data: base, borderColor: lineColor, backgroundColor: bgColor, borderWidth: 2, pointRadius: 3, pointBackgroundColor: lineColor, fill: true, tension: 0.35 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: v => fmt(v), color: textColor, font: { family: "JetBrains Mono", size: 11 } }, grid: { color: gridColor } },
        x: { ticks: { color: textColor, font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

function renderDashboard() {
  renderMetrics(); renderLeaderboard(); renderTable(); renderChart();
}

// ============ RENDER: EDITOR PAGE ============
function renderEditorCards() {
  document.getElementById("editorCards").innerHTML = editors.map(e => {
    const items = content.filter(c => c.editor_id === e.id);
    const views = items.reduce((s, c) => s + (c.views || 0), 0);
    const likes = items.reduce((s, c) => s + (c.likes || 0), 0);
    return `
      <div class="editor-card">
        <div class="editor-card-head">
          <div class="avatar">${e.nama.slice(0, 2).toUpperCase()}</div>
          <div style="flex: 1; display: flex; justify-content: space-between; align-items: flex-start;">
            <div class="editor-name">${e.nama}</div>
            <span class="code-tag">${e.kode_identifikasi || e.kode}</span>
          </div>
        </div>
        <div class="editor-card-stats">
          <div>Konten<b>${items.length}</b></div>
          <div>Views<b>${fmt(views)}</b></div>
          <div>Likes<b>${fmt(likes)}</b></div>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm" data-view-editor="${e.id}">Lihat detail</button>
          <button class="btn btn-sm btn-danger" data-remove-editor="${e.id}">Hapus</button>
        </div>
      </div>`;
  }).join("") || '<div class="empty-note">Belum ada data editor.</div>';
  
  document.querySelectorAll("[data-view-editor]").forEach(b => b.addEventListener("click", () => openEditorModal(Number(b.dataset.viewEditor))));
  document.querySelectorAll("[data-remove-editor]").forEach(b => b.addEventListener("click", async () => {
    const id = Number(b.dataset.removeEditor);
    const e = editorById(id);
    if (!confirm(`Hapus editor ${e.nama}? Konten miliknya akan berpindah ke status belum teridentifikasi.`)) return;
    
    b.disabled = true;
    const originalText = b.textContent;
    b.textContent = "Menghapus...";
    try {
      await fetch(`http://localhost:3000/api/editors/${id}`, { method: 'DELETE' });
      content.forEach(c => { if (c.editor_id === id) { c.editor_id = null; c.status_identifikasi = "unmatched"; } });
      editors = editors.filter(x => x.id !== id);
      showToast(`Editor ${e.nama} dihapus`);
      renderAll();
    } catch (err) {
      showToast("Gagal menghapus editor", true);
    } finally {
      b.disabled = false;
      b.textContent = originalText;
    }
  }));
}

// ============ RENDER: KONTEN PAGE ============
function renderKontenFull(query = "") {
  const q = query.trim().toLowerCase();
  const rows = content.filter(c => c.judul.toLowerCase().includes(q));
  document.getElementById("kontenFullTable").innerHTML = rows.map(contentRowHtml).join("") || `<tr><td colspan="7" class="empty-note">Tidak ada konten ditemukan.</td></tr>`;
  attachRowClicks("kontenFullTable");
}
document.getElementById("searchKonten").addEventListener("input", e => renderKontenFull(e.target.value));

// ============ RENDER: UNMATCHED PAGE ============
function renderUnmatched() {
  const rows = content.filter(c => c.status_identifikasi === "unmatched");
  document.getElementById("unmatchedTable").innerHTML = rows.map(c => `
    <tr>
      <td class="content-title">${c.judul}</td>
      <td><span class="plat ${platformClass(c.platform)}">${platformLabel(c.platform)}</span></td>
      <td class="num-cell">${fmt(c.views)}</td>
      <td><button class="btn btn-sm btn-primary" data-assign="${c.id}">Tandai editor</button></td>
    </tr>
  `).join("");
  document.getElementById("unmatchedEmpty").style.display = rows.length ? "none" : "block";
  
  document.querySelectorAll("[data-assign]").forEach(b => b.addEventListener("click", () => {
    assignTargetId = Number(b.dataset.assign);
    document.getElementById("assignEditorSelect").innerHTML = editors.map(e => `<option value="${e.id}">${e.nama}</option>`).join("");
    openModal("assignModal");
  }));
}

document.getElementById("confirmAssignBtn").addEventListener("click", async () => {
  const editorId = Number(document.getElementById("assignEditorSelect").value);
  const item = content.find(c => c.id === assignTargetId);
  
  if (item) {
    const btn = document.getElementById("confirmAssignBtn");
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = "Menyimpan...";
    
    try {
      await fetch(`http://localhost:3000/api/content/${assignTargetId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editor_id: editorId })
      });
      item.editor_id = editorId; 
      item.status_identifikasi = "matched";
      closeModal("assignModal");
      showToast("Konten ditandai dan dikaitkan ke editor");
      renderAll();
    } catch (err) {
      showToast("Gagal menandai konten", true);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
});

// ============ RENDER: PENGATURAN ============
function renderCodeTable() {
  document.getElementById("codeTable").innerHTML = editors.map(e => `
    <tr>
      <td>${e.nama}</td>
      <td><span class="code-tag" contenteditable="true" data-code-for="${e.id}">${e.kode_identifikasi || e.kode}</span></td>
      <td><span class="status-pill status-ok">Aktif</span></td>
      <td><button class="btn btn-sm" data-save-code="${e.id}">Simpan</button></td>
    </tr>
  `).join("");
  
  document.querySelectorAll("[data-save-code]").forEach(b => b.addEventListener("click", async () => {
    const id = Number(b.dataset.saveCode);
    const span = document.querySelector(`[data-code-for="${id}"]`);
    const newCode = span.textContent.trim();
    const ed = editorById(id);
    
    b.disabled = true;
    const originalText = b.textContent;
    b.textContent = "...";
    try {
      await fetch(`/api/editors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama: ed.nama, kode: newCode })
      });
      ed.kode_identifikasi = newCode;
      showToast("Kode identifikasi disimpan");
    } catch (err) {
      showToast("Gagal menyimpan kode", true);
    } finally {
      b.disabled = false;
      b.textContent = originalText;
    }
  }));
}
document.getElementById("saveSyncBtn").addEventListener("click", () => showToast("Pengaturan sinkronisasi disimpan"));

// ============ MODALS ============
function openContentModal(id) {
  const c = content.find(x => x.id === id);
  const editor = editorById(c.editor_id);
  const views = c.views || 0;
  const likes = c.likes || 0;
  const comments = c.comments || c.komentar || 0;
  
  document.getElementById("contentModalBody").innerHTML = `
    <div class="detail-row"><span class="detail-label">Judul</span><span>${c.judul}</span></div>
    <div class="detail-row"><span class="detail-label">Platform</span><span class="plat ${platformClass(c.platform)}">${platformLabel(c.platform)}</span></div>
    <div class="detail-row"><span class="detail-label">Editor</span><span>${editor ? editor.nama : "Belum teridentifikasi"}</span></div>
    <div class="detail-row"><span class="detail-label">Waktu upload</span><span>${c.tanggal_upload}</span></div>
    <div class="detail-row"><span class="detail-label">Views</span><span class="num">${views.toLocaleString('id-ID')}</span></div>
    <div class="detail-row"><span class="detail-label">Likes</span><span class="num">${likes.toLocaleString('id-ID')}</span></div>
    <div class="detail-row"><span class="detail-label">Komentar</span><span class="num">${comments.toLocaleString('id-ID')}</span></div>
    <div class="detail-row"><span class="detail-label">Tautan</span><span><a href="${c.url}" target="_blank" rel="noopener">Buka postingan</a></span></div>
    ${!editor ? `<div class="modal-actions"><button class="btn btn-primary btn-sm" id="modalAssignBtn">Tandai editor</button></div>` : ""}
  `;
  const assignBtn = document.getElementById("modalAssignBtn");
  if (assignBtn) assignBtn.addEventListener("click", () => {
    closeModal("contentModal");
    assignTargetId = c.id;
    document.getElementById("assignEditorSelect").innerHTML = editors.map(e => `<option value="${e.id}">${e.nama}</option>`).join("");
    openModal("assignModal");
  });
  openModal("contentModal");
}

function openEditorModal(id) {
  const e = editorById(id);
  const items = content.filter(c => c.editor_id === id);
  const views = items.reduce((s, c) => s + (c.views || 0), 0);
  document.getElementById("editorModalName").textContent = e.nama;
  document.getElementById("editorModalBody").innerHTML = `
    <div class="detail-row"><span class="detail-label">Kode identifikasi</span><span class="code-tag">${e.kode_identifikasi || e.kode}</span></div>
    <div class="detail-row"><span class="detail-label">Total konten</span><span class="num">${items.length}</span></div>
    <div class="detail-row"><span class="detail-label">Total views</span><span class="num">${fmt(views)}</span></div>
    <div style="margin-top:20px;font-size:12.5px;color:var(--muted);margin-bottom:12px;font-weight:600;">Konten terbaru</div>
    ${items.slice(0, 5).map(c => `<div class="detail-row"><span>${c.judul}</span><span class="num">${fmt(c.views)}</span></div>`).join("") || '<div class="empty-note">Belum ada konten.</div>'}
  `;
  openModal("editorModal");
}

// ============ ADD EDITOR ============
document.getElementById("addEditorBtn").addEventListener("click", () => {
  document.getElementById("newEditorName").value = "";
  document.getElementById("newEditorCode").value = "";
  openModal("addEditorModal");
});
document.getElementById("saveEditorBtn").addEventListener("click", async () => {
  const nama = document.getElementById("newEditorName").value.trim();
  const kode = document.getElementById("newEditorCode").value.trim();
  if (!nama || !kode) { showToast("Isi nama dan kode terlebih dahulu", true); return; }
  
  const btn = document.getElementById("saveEditorBtn");
  btn.disabled = true;
  const originalHtml = btn.innerHTML;
  btn.textContent = "Menyimpan...";
  
  try {
    const res = await fetch('http://localhost:3000/api/editors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama, kode })
    });
    const newEd = await res.json();
    if (!res.ok) throw new Error(newEd.error || "Gagal menyimpan");
    
    editors.push(newEd);
    closeModal("addEditorModal");
    showToast(`Editor ${nama} ditambahkan`);
    renderAll();
  } catch (err) {
    showToast("Gagal menambah editor: " + err.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
});

// ============ FILTERS + SYNC ============
["filterEditor", "filterPlatform", "filterRange"].forEach(id => {
  document.getElementById(id).addEventListener("change", () => {
    filters = {
      editor: document.getElementById("filterEditor").value,
      platform: document.getElementById("filterPlatform").value,
      range: document.getElementById("filterRange").value,
    };
    renderDashboard();
  });
});

document.getElementById("refreshBtn").addEventListener("click", async () => {
  const btn = document.getElementById("refreshBtn");
  btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;border-top-color:#fff;"></div> Menyinkronkan...`;
  btn.disabled = true;
  
  try {
    const res = await fetch('/api/scan', { method: 'POST' });
    if (!res.ok) throw new Error("Gagal sinkronisasi");
    await loadData();
    showToast("Sinkronisasi selesai");
  } catch (err) {
    showToast("Gagal terhubung ke backend", true);
  } finally {
    btn.innerHTML = `<span class="btn-text">Sinkronkan sekarang</span>`;
    btn.disabled = false;
  }
});

function renderAll() {
  try { populateEditorFilter(); } catch (e) {}
  try { renderDashboard(); } catch (e) {}
  try { renderEditorCards(); } catch (e) {}
  try { renderKontenFull(document.getElementById("searchKonten").value); } catch (e) {}
  try { renderUnmatched(); } catch (e) {}
  try { renderCodeTable(); } catch (e) {}
  try { lucide.createIcons(); } catch (e) {}
}

// ============ INIT ============
async function loadData() {
  try {
    const [editorsRes, contentRes] = await Promise.all([
      fetch('/api/editors').then(r => { if (!r.ok) throw new Error("API Error"); return r.json(); }),
      fetch('/api/content').then(r => { if (!r.ok) throw new Error("API Error"); return r.json(); }),
    ]);
    editors = Array.isArray(editorsRes) ? editorsRes : [];
    content = Array.isArray(contentRes) ? contentRes : [];
    
    if (editors.length === 0) {
      editors = [
        { id: 1, nama: "Deni", kode_identifikasi: "ED-DN", status: "aktif" },
        { id: 2, nama: "Finda", kode_identifikasi: "ED-FD", status: "aktif" }
      ];
      showToast("Tabel editor kosong, menggunakan data dummy.", false);
    }
    
    if (content.length === 0) {
      content = dummyContent;
      showToast("Tabel konten kosong, menggunakan data dummy.", false);
    }
  } catch (err) {
    console.log("Mode offline aktif. Menggunakan data simulasi lokal.");
    showToast("Mode Offline: Menggunakan data lokal.", true);
    // Use dummy data if backend fails
    editors = [
      { id: 1, nama: "Deni", kode_identifikasi: "ED-DN", status: "aktif" },
      { id: 2, nama: "Finda", kode_identifikasi: "ED-FD", status: "aktif" }
    ];
    content = dummyContent;
  }
  
  renderAll();
}

// Observe theme change for chart update
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.attributeName === "data-theme" && document.getElementById("view-dashboard").classList.contains("active")) {
      renderChart();
    }
  });
});
observer.observe(document.body, { attributes: true });

loadData();