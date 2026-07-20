const { Pool } = require('pg');
try { require('dotenv').config(); } catch (e) { /* .env not present */ }

let isMock = false;
let pool;

const dbUrl = process.env.DATABASE_URL || '';
const isPlaceholder = !dbUrl || dbUrl.includes('user:password') || dbUrl.includes('host:5432');

if (dbUrl && !isPlaceholder) {
  pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  // Test koneksi ke database saat server berjalan
  pool.connect((err, client, release) => {
    if (err) {
      console.error('❌ Koneksi Database Gagal:', err.message);
    } else {
      console.log('✅ Database berhasil terkoneksi!');
      release();
    }
  });
} else {
  console.log("DATABASE_URL belum diatur. Menggunakan data dummy.");
  isMock = true;
}

const query = async (text, params) => {
  if (!pool) {
    throw new Error('Koneksi database belum tersedia');
  }
  return pool.query(text, params);
};

module.exports = { query };
