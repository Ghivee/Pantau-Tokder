// Daftar app milik Doni untuk menu "Aplikasi lain". Kosongkan url bila belum ada; barisnya disembunyikan.
// Daftar yang sama dipakai di Master dan Telprom (sunting ketiganya bersamaan).
export const APLIKASI = [
  { id: 'pantau', nama: 'Pantau Tokder', ket: 'Performa channel dan upload sosmed', url: 'https://pantautokder.vercel.app' },
  { id: 'telprom', nama: 'Telprom', ket: 'Ide, naskah, dan rekam video', url: '' },
  { id: 'master', nama: 'Master', ket: 'Order, keuangan, tim, dan absen', url: '' },
];
const SAYA = 'pantau';
export const aplikasiLain = () => APLIKASI.filter((a) => a.id !== SAYA && /^https:\/\//.test(a.url));
