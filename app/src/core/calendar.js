import { S } from './state.js';
import { asDate } from '../lib/format.js';

// Opening hours per weekday and days off come from the server (Presensi → Jam kerja & libur).
export const JADWAL_BAWAAN = [null, ...Array(4).fill({ masuk: '08:00', pulang: '16:00' }), { masuk: '08:00', pulang: '15:00' }, { masuk: '08:00', pulang: '15:00' }];

export const kalender = () => S.kalender || { jadwal: JADWAL_BAWAAN, toleransi: 10, libur: {} };

const liburNama = (d) => kalender().libur[d] || null;

// Opening hours on a date, or null on a day off.
export const jamKerja = (d) => (liburNama(d) ? null : (kalender().jadwal || JADWAL_BAWAAN)[asDate(d).getUTCDay()] || null);

export const ketLibur = (d) => liburNama(d) || (asDate(d).getUTCDay() === 0 ? 'Minggu' : 'Hari libur');
