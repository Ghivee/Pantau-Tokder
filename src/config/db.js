const { Pool } = require('pg');
require('dotenv').config();

let isMock = false;
let pool;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
} else {
  console.log("DATABASE_URL not found. Using in-memory mock database.");
  isMock = true;
}

// Dummy Data
let mockEditors = [
  { id: 1, nama: "Deni", kode_identifikasi: "ED-DN", status: "aktif" },
  { id: 2, nama: "Finda", kode_identifikasi: "ED-FD", status: "aktif" }
];

let mockContent = [
  { id: 1, editor_id: 1, platform: "youtube", judul: "Panduan pemupukan cabe rawit agar berbuah lebat", tanggal_upload: "2026-07-01 14:30 WIB", url: "https://youtube.com/watch?v=demo1", views: 24500, likes: 1820, komentar: 142, status_identifikasi: "matched" },
  { id: 2, editor_id: 2, platform: "instagram", judul: "Cara ampuh mengatasi hama patek pada cabe", tanggal_upload: "2026-07-03 09:15 WIB", url: "https://instagram.com/p/demo2", views: 18200, likes: 2140, komentar: 88, status_identifikasi: "matched" },
  { id: 3, editor_id: 1, platform: "instagram", judul: "Rahasia semai bibit cabe 100% tumbuh subur", tanggal_upload: "2026-07-05 16:45 WIB", url: "https://instagram.com/p/demo3", views: 15800, likes: 1290, komentar: 54, status_identifikasi: "matched" },
  { id: 4, editor_id: 3, platform: "facebook", judul: "Jarak tanam ideal untuk hasil panen cabe maksimal", tanggal_upload: "2026-07-06 13:20 WIB", url: "https://facebook.com/demo4", views: 9200, likes: 410, komentar: 31, status_identifikasi: "matched" },
  { id: 5, editor_id: 4, platform: "youtube", judul: "Meracik pupuk organik cair khusus untuk cabe", tanggal_upload: "2026-07-08 08:00 WIB", url: "https://youtube.com/watch?v=demo5", views: 31200, likes: 2680, komentar: 210, status_identifikasi: "matched" },
  { id: 6, editor_id: null, platform: "instagram", judul: "Panen raya cabe merah keriting musim kemarau", tanggal_upload: "2026-07-09 10:00 WIB", url: "https://instagram.com/p/demo6", views: 6400, likes: 340, komentar: 12, status_identifikasi: "unmatched" }
];

let nextEditorId = 5;

const query = async (text, params) => {
  if (!isMock) {
    return pool.query(text, params);
  }

  // Mock implementation for basic queries
  if (text.includes("SELECT * FROM editors")) {
    return { rows: mockEditors };
  }
  if (text.includes("INSERT INTO editors")) {
    const newEditor = { id: nextEditorId++, nama: params[0], kode_identifikasi: params[1], status: "aktif" };
    mockEditors.push(newEditor);
    return { rows: [newEditor] };
  }
  if (text.includes("UPDATE editors")) {
    const editor = mockEditors.find(e => e.id == params[2]);
    if (editor) {
      editor.nama = params[0];
      editor.kode_identifikasi = params[1];
      return { rows: [editor] };
    }
    return { rows: [] };
  }
  if (text.includes("DELETE FROM editors")) {
    mockEditors = mockEditors.filter(e => e.id != params[0]);
    mockContent.forEach(c => { if(c.editor_id == params[0]) { c.editor_id = null; c.status_identifikasi = "unmatched"; } });
    return { rowCount: 1 };
  }
  
  if (text.includes("SELECT c.*") || text.includes("FROM content")) {
    // Content fetching mock
    return { rows: mockContent };
  }

  if (text.includes("UPDATE content SET editor_id")) {
    const content = mockContent.find(c => c.id == params[1]);
    if (content) {
      content.editor_id = params[0];
      content.status_identifikasi = 'matched';
      return { rows: [content] };
    }
    return { rows: [] };
  }

  if (text.includes("INSERT INTO scan_log")) {
    return { rows: [] };
  }

  return { rows: [] };
};

module.exports = { query };
