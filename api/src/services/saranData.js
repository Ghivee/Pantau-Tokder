// Bahan saran konten per masalah kebun: isi video (masalah, solusi, produk) dan judul serta kata kunci per tema channel.
// Produk disebut menurut jenis, bukan merek. Dosis dan izin edar mengikuti label produk.
const cari = (q) => ({ nama: q, url: 'https://shopee.co.id/search?keyword=' + encodeURIComponent(q) });

const MASALAH = {
  patek: {
    label: 'Patek', masalah: 'Buah cabai bercak hitam cekung lalu busuk',
    solusi: ['Buang buah dan daun terserang', 'Semprot fungisida sebelum hujan', 'Campur perekat agar tidak tercuci'],
    produk: [cari('fungisida cabai antraknosa'), cari('perekat perata pestisida'), cari('mulsa plastik hitam perak')],
    budidaya: {
      judul: ['Patek Cabai Musim Hujan: Penyebab dan Cara Mengatasinya', 'Cabai Busuk Terus Saat Hujan? Cara Semprot Biar Tidak Tercuci', 'Cara Mengatasi Antraknosa Cabai Tanpa Boros Obat', 'Buah Cabai Bercak Hitam? Ini Penyebabnya dan Solusinya', 'Kesalahan Semprot Fungisida Saat Hujan yang Bikin Patek Menyebar', 'Perekat Perata: Rahasia Semprotan Tidak Luntur Kena Hujan', 'Mulsa Plastik untuk Cegah Patek: Layak Dicoba?', 'Panen Cabai Tetap Aman di Musim Hujan: 3 Langkah Cegah Patek'],
      kata: ['patek cabai', 'antraknosa cabai', 'cara mengatasi patek cabai', 'obat patek cabai', 'fungisida untuk cabai', 'fungisida antraknosa', 'buah cabai busuk hitam', 'cabai busuk musim hujan', 'penyakit cabai musim hujan', 'perekat perata pestisida', 'cara semprot fungisida saat hujan', 'budidaya cabai musim hujan', 'mulsa plastik cabai'],
    },
    tokder: {
      judul: ['Fungisida Cabai: Mana yang Cocok untuk Patek? Cara Pilih dan Pakai', 'Perekat Perata Pestisida: Fungsi dan Cara Pakai yang Benar', 'Review Mulsa Plastik Hitam Perak untuk Kebun Cabai', 'Alat Semprot Cabai Hemat: Mana yang Layak Dibeli?', 'Belanja Kebutuhan Kebun Cabai Musim Hujan: Daftar Wajib', 'Obat Patek Cabai: Cara Pakai Aman dan Tepat Dosis'],
      kata: ['fungisida cabai', 'review fungisida', 'perekat pestisida', 'mulsa plastik hitam perak', 'alat semprot', 'kebutuhan kebun cabai', 'belanja pertanian', 'rekomendasi obat cabai'],
    },
  },
  akar: {
    label: 'Akar busuk', masalah: 'Cabai layu mendadak, pangkal batang busuk',
    solusi: ['Buat parit pembuangan air', 'Cabut tanaman yang layu', 'Kocor agens hayati, beri kapur'],
    produk: [cari('trichoderma agens hayati'), cari('dolomit kapur pertanian'), cari('fungisida tanah cabai layu')],
    budidaya: {
      judul: ['Cabai Layu Tiba-tiba Setelah Hujan Deras? Ini Penyelamatnya', 'Drainase Kebun Cabai Musim Hujan: Biar Akar Tidak Busuk', 'Cara Mengatasi Cabai Layu Fusarium dan Layu Bakteri', 'Tanaman Cabai Layu, Pangkal Batang Busuk: Selamatkan Sebelum Menular', 'Trichoderma untuk Cabai: Cara Pakai dan Hasilnya', 'Kapur Dolomit di Lahan Cabai: Kapan dan Seberapa Banyak?', 'Bedengan Tinggi atau Rendah Saat Hujan: Mana yang Aman?', 'Jangan Cabut Semua! Cara Menyelamatkan Cabai yang Mulai Layu'],
      kata: ['cabai layu', 'cara mengatasi cabai layu', 'layu fusarium cabai', 'layu bakteri cabai', 'akar busuk cabai', 'pangkal batang cabai busuk', 'trichoderma cabai', 'dolomit untuk cabai', 'drainase kebun cabai', 'cabai layu setelah hujan', 'budidaya cabai musim hujan', 'agens hayati cabai'],
    },
    tokder: {
      judul: ['Trichoderma: Fungsi, Cara Pakai, dan Cara Memilih', 'Dolomit atau Kapur Pertanian? Beda dan Cara Pakai', 'Fungisida Tanah untuk Cabai Layu: Cara Pakai yang Aman', 'Review Cangkul dan Alat Parit untuk Kebun Cabai', 'Belanja Penyelamat Kebun Cabai Saat Tergenang', 'Pupuk Hayati untuk Cabai: Layak Dicoba?'],
      kata: ['trichoderma', 'dolomit pertanian', 'kapur pertanian', 'fungisida tanah', 'pupuk hayati', 'agens hayati', 'alat pertanian', 'review produk pertanian'],
    },
  },
  pupuk: {
    label: 'Pupuk', masalah: 'Bunga cabai rontok, ujung buah menghitam',
    solusi: ['Kurangi pupuk nitrogen', 'Beri kalium untuk pembuahan', 'Beri kalsium, kocor atau semprot daun'],
    produk: [cari('pupuk kalium cabai'), cari('pupuk kalsium cabai ujung buah busuk'), cari('pupuk daun cabai berbunga')],
    budidaya: {
      judul: ['Bunga Cabai Rontok Setelah Hujan: Pupuk Apa yang Dibutuhkan?', 'Ujung Buah Cabai Hitam? Ternyata Kekurangan Kalsium', 'Pupuk Tercuci Hujan: Cara Menyelamatkan Nutrisi Tanaman Cabai', 'Kalium untuk Cabai: Kapan Diberikan Agar Buah Lebat?', 'Jadwal Pupuk Cabai Musim Hujan yang Benar', 'Kesalahan Pemupukan Saat Hujan yang Bikin Cabai Rontok', 'Pupuk Daun atau Kocor? Mana yang Lebih Efektif Saat Hujan', 'Cabai Berbunga tapi Tidak Jadi Buah: Cek 3 Hal Ini'],
      kata: ['bunga cabai rontok', 'cabai tidak berbuah', 'ujung buah cabai busuk', 'busuk ujung buah cabai', 'pupuk kalium cabai', 'pupuk kalsium cabai', 'pupuk cabai musim hujan', 'pupuk cabai berbunga', 'pupuk daun cabai', 'jadwal pupuk cabai', 'cara membuat cabai berbuah lebat', 'pupuk tercuci hujan'],
    },
    tokder: {
      judul: ['Pupuk Kalium untuk Cabai: Cara Pilih dan Pakai', 'Pupuk Kalsium Cabai: Review dan Cara Pakai', 'Pupuk Daun Cabai Berbunga: Mana yang Cocok?', 'Alat Kocor Pupuk Hemat Tenaga untuk Kebun Cabai', 'Belanja Pupuk Cabai Musim Hujan: Daftar Hemat', 'Perbandingan Pupuk Kalium: Mana yang Paling Hemat?'],
      kata: ['pupuk kalium', 'pupuk kalsium', 'pupuk daun', 'review pupuk', 'rekomendasi pupuk cabai', 'pupuk hemat', 'belanja pertanian', 'alat kocor'],
    },
  },
  awal: {
    label: 'Awal hujan', masalah: 'Awal musim hujan: jamur dan hama menyerang kebun yang belum siap',
    solusi: ['Rapikan parit dan bedengan', 'Semprot fungisida pencegahan', 'Siapkan perekat dan penutup'],
    produk: [cari('fungisida pencegahan cabai'), cari('perekat perata pestisida'), cari('terpal penutup kebun')],
    budidaya: {
      judul: ['Persiapan Kebun Cabai Sebelum Musim Hujan: 3 Hal Wajib', 'Awal Musim Hujan: Semprot Pencegahan Cabai Biar Tidak Kecolongan', 'Cegah Penyakit Cabai Sebelum Muncul: Panduan Awal Musim Hujan', 'Parit dan Bedengan: Persiapan Kebun Cabai Menghadapi Hujan', 'Kesalahan Petani Cabai di Awal Musim Hujan', 'Checklist Kebun Cabai Sebelum Hujan Deras', 'Fungisida Pencegahan: Kapan Mulai Disemprot?', 'Hujan Pertama Datang: Apa yang Harus Dilakukan Petani Cabai?'],
      kata: ['persiapan musim hujan cabai', 'cabai awal musim hujan', 'pencegahan penyakit cabai', 'fungisida pencegahan', 'budidaya cabai musim hujan', 'cara menghadapi musim hujan petani', 'parit kebun cabai', 'bedengan cabai', 'semprot cabai sebelum hujan', 'tips petani cabai musim hujan'],
    },
    tokder: {
      judul: ['Belanja Persiapan Musim Hujan untuk Kebun Cabai', 'Fungisida Pencegahan Cabai: Cara Pilih', 'Perekat Perata: Wajib Punya Saat Musim Hujan?', 'Terpal dan Penutup Kebun: Review Singkat', 'Daftar Perlengkapan Petani Cabai Musim Hujan', 'Alat Semprot Tahan Lama untuk Petani Cabai'],
      kata: ['perlengkapan petani', 'perlengkapan musim hujan', 'fungisida pencegahan', 'perekat pestisida', 'belanja pertanian', 'review alat pertanian', 'rekomendasi produk petani', 'alat semprot'],
    },
  },
  hama: {
    label: 'Hama', masalah: 'Daun cabai keriting dan menguning (thrips, tungau, kutu kebul)',
    solusi: ['Pasang perangkap lengket kuning', 'Pasang mulsa perak', 'Semprot sore, bagian bawah daun'],
    produk: [cari('perangkap lengket kuning'), cari('mulsa perak hitam'), cari('insektisida thrips cabai'), cari('selang irigasi tetes')],
    budidaya: {
      judul: ['Daun Cabai Keriting Saat Kemarau? Ini Hama Penyebabnya', 'Mulsa Perak dan Perangkap Kuning: Lawan Thrips Tanpa Boros', 'Cara Mengatasi Thrips pada Cabai Sampai Tuntas', 'Kutu Kebul Cabai: Gejala, Bahaya Virus Kuning, dan Solusinya', 'Kenapa Daun Cabai Mengeriting? 3 Penyebab Paling Sering', 'Waktu Semprot Insektisida yang Tepat Saat Kemarau', 'Irigasi Tetes untuk Cabai: Hemat Air, Hama Berkurang?', 'Cabai Kuning dan Keriting: Selamatkan atau Cabut?'],
      kata: ['daun cabai keriting', 'penyebab cabai keriting', 'thrips cabai', 'cara mengatasi thrips', 'kutu kebul cabai', 'virus kuning cabai', 'tungau cabai', 'mulsa perak cabai', 'perangkap kuning', 'insektisida cabai', 'budidaya cabai musim kemarau', 'hama cabai kemarau'],
    },
    tokder: {
      judul: ['Perangkap Lengket Kuning: Review dan Cara Pasang', 'Mulsa Perak Hitam: Worth It untuk Cabai?', 'Insektisida Thrips: Cara Pilih dan Pakai Aman', 'Selang Irigasi Tetes Murah untuk Kebun Cabai', 'Belanja Anti-Hama Cabai Musim Kemarau', 'Alat Semprot Elektrik atau Manual: Mana yang Hemat?'],
      kata: ['perangkap lengket kuning', 'yellow trap', 'mulsa perak', 'insektisida thrips', 'irigasi tetes', 'alat semprot', 'review produk pertanian', 'belanja pertanian'],
    },
  },
  rutin: {
    label: 'Perawatan', masalah: 'Cuaca campuran: tanaman mudah stres dan diserang bergantian',
    solusi: ['Pangkas tunas air dan daun bawah', 'Cek kebun tiap pagi', 'Gilir bahan aktif pestisida'],
    produk: [cari('gunting pangkas tanaman'), cari('fungisida cabai'), cari('insektisida cabai')],
    budidaya: {
      judul: ['Cek Rutin Kebun Cabai: 3 Gejala yang Jangan Dibiarkan', 'Cara Pangkas dan Wiwil Cabai Supaya Buah Lebat', 'Rutinitas Pagi Petani Cabai Sukses', 'Rotasi Pestisida: Kenapa Hama Cabai Jadi Kebal?', 'Perawatan Cabai Mingguan yang Sering Terlewat', 'Tanaman Cabai Stres? Begini Cara Memulihkannya'],
      kata: ['perawatan cabai', 'cara pangkas cabai', 'wiwil cabai', 'tips budidaya cabai', 'tanaman cabai stres', 'rotasi pestisida', 'cabai berbuah lebat', 'budidaya cabai pemula'],
    },
    tokder: {
      judul: ['Gunting Pangkas: Review untuk Kebun Cabai', 'Perlengkapan Dasar Kebun Cabai Pemula', 'Fungisida dan Insektisida Cabai: Mana yang Dibutuhkan?', 'Belanja Hemat Perawatan Kebun Cabai', 'Alat Pertanian Wajib untuk Petani Cabai Pemula'],
      kata: ['perlengkapan kebun cabai', 'alat pertanian', 'gunting pangkas', 'review alat pertanian', 'belanja pertanian', 'budidaya cabai pemula'],
    },
  },
};

// Channel harga: judul dan kata kunci mengikuti tanggal dan kondisi cuaca, tanpa menyebut arah harga yang tidak diketahui.
function harga(kondisi, tgl, tglPendek, bulan) {
  const khas = {
    hujan: { judul: [`Harga Cabe Hari Ini ${tgl}: Hujan Terus, Naik atau Turun?`, 'Cuaca Hujan, Apakah Pasokan Cabe Terganggu? Cek Harga Hari Ini', 'Prediksi Harga Cabe Minggu Ini Saat Musim Hujan'], kata: ['harga cabe musim hujan', 'harga cabe saat hujan'] },
    kering: { judul: [`Harga Cabe Hari Ini ${tgl}: Musim Kemarau, Bagaimana Pasokannya?`, 'Kemarau Panjang, Apakah Harga Cabe Ikut Bergerak? Cek Hari Ini', 'Prediksi Harga Cabe Minggu Ini Saat Kemarau'], kata: ['harga cabe musim kemarau', 'harga cabe saat kemarau'] },
    campuran: { judul: [`Harga Cabe Hari Ini ${tgl}: Update Pasar Terbaru`, 'Cuaca Tak Menentu, Begini Kondisi Harga Cabe Hari Ini', 'Prediksi Harga Cabe Minggu Ini'], kata: ['harga cabe minggu ini', 'prediksi harga cabe minggu ini'] },
  }[kondisi];
  return {
    judul: [...khas.judul, `Update Harga Cabe Rawit dan Merah Keriting ${tglPendek}`, `Harga Cabe Rawit Hari Ini ${tglPendek}: Tingkat Petani dan Pasar`, `Harga Cabe Merah Keriting Hari Ini ${tglPendek}`, `Harga Cabe Hijau, Rawit, dan Merah Terbaru ${tglPendek}`, `Harga Cabe di Pasar Hari Ini ${tglPendek}: Cek Sebelum Jual atau Beli`, `Harga Cabe Per Kg Hari Ini ${tglPendek}, Cek Sebelum Belanja`, `Daftar Harga Cabe Semua Jenis Hari Ini ${tglPendek}`, 'Harga Cabe Naik? Ini Faktor yang Mempengaruhinya', 'Cabe Rawit Hijau dan Merah: Beda Harga Hari Ini'],
    kata: ['harga cabe hari ini', 'harga cabai hari ini', 'harga cabe rawit hari ini', 'harga cabe merah keriting hari ini', 'harga cabe hijau hari ini', 'harga cabe di pasar', 'harga cabe terbaru', 'prediksi harga cabe', `harga cabe ${bulan}`, 'harga cabe naik atau turun', ...khas.kata],
  };
}

// Judul dan kata kunci yang selalu relevan, ditambahkan di bawah yang khusus masalah hari ini.
const SEPANJANG_MASA = {
  budidaya: {
    judul: ['Cara Menanam Cabai dari Biji Sampai Panen: Panduan Lengkap', 'Kesalahan Pemula Menanam Cabai yang Bikin Panen Gagal', 'Cara Semai Cabai Supaya Tumbuh Seragam dan Kuat', 'Jarak Tanam Cabai yang Ideal untuk Hasil Maksimal', 'Cara Pasang Mulsa dan Ajir Cabai yang Benar', 'Hitung Modal dan Untung Tanam Cabai 1000 Meter', 'Cara Panen Cabai Agar Tanaman Terus Berbuah', 'Cara Membuat Pupuk Organik Cair untuk Cabai'],
    kata: ['cara menanam cabai', 'budidaya cabai', 'budidaya cabai untuk pemula', 'semai cabai', 'jarak tanam cabai', 'panen cabai', 'modal tanam cabai', 'pupuk organik cair cabai'],
  },
  tokder: {
    judul: ['Alat Pertanian Wajib untuk Petani Cabai Pemula', 'Rekomendasi Sprayer Terbaik untuk Kebun Cabai', 'Unboxing Perlengkapan Kebun: Layak Beli atau Tidak?', 'Mulsa Plastik: Cara Pilih Ukuran dan Ketebalan', 'Cara Memilih Pupuk NPK yang Tepat untuk Cabai', 'Benih Cabai Unggul: Cara Memilih dan Membeli', 'Belanja Kebutuhan Tani di Marketplace: Tips Aman dan Hemat', 'Selang dan Irigasi untuk Kebun: Perbandingan Harga', 'Sarung Tangan dan Masker Semprot untuk Petani: Mana yang Nyaman?', 'Perbandingan Harga Benih Cabai di Marketplace', 'Barang Murah di Marketplace yang Berguna untuk Kebun Cabai'],
    kata: ['alat pertanian', 'sprayer pertanian', 'unboxing alat tani', 'mulsa plastik', 'pupuk NPK', 'benih cabai unggul', 'belanja alat tani', 'toko pertanian', 'sarung tangan petani', 'masker semprot', 'harga benih cabai'],
  },
};

const unik = (a) => [...new Set(a)];
const gabung = (khusus, umum) => ({ judul: unik([...khusus.judul, ...umum.judul]), kata: unik([...khusus.kata, ...umum.kata]) });

module.exports = { MASALAH, harga, SEPANJANG_MASA, gabung };
