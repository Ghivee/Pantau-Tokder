// Pengaturan dashboard harian. Ubah file ini saja untuk memakai data asli.
window.PANTAU_CONFIG = {
  // Sumber data. Bisa file di folder data/ atau link CSV dari Google Sheet
  // (File → Bagikan → Publikasikan ke web → pilih tab → CSV).
  data: {
    video: '/harian/data/video.csv',   // rekap video: ekspor YouTube Studio + kolom isian tim
    tugas: '/harian/data/aktivitas.csv', // log aktivitas harian karyawan
  },

  // Foto profil (opsional). Taruh file di folder foto/ lalu isi namanya, mis. '/harian/foto/alivia.jpg'.
  // Kosongkan ('') untuk memakai inisial nama.
  foto: {
    Alivia: '',
    Deni: '',
  },

  // Label peran di kartu karyawan.
  peran: {
    Alivia: 'Editor',
    Deni: 'Editor terbatas',
  },

  // Muat ulang data otomatis tiap sekian menit (0 = mati).
  muatUlangMenit: 10,

  params: { tanggal: null },
};
