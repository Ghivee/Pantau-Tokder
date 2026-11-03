const express = require('express');
const axios = require('axios');
const cors = require('cors');

const editorsRouter = require('./routes/editors');
const contentRouter = require('./routes/content');
const scanRouter = require('./routes/scan');
const goalsRouter = require('./routes/goals');
const authRouter = require('./routes/auth');
const aktivitasRouter = require('./routes/aktivitas');
const channelsRouter = require('./routes/channels');
const analyticsRouter = require('./routes/analytics');
const performanceRouter = require('./routes/performance');
const presensiRouter = require('./routes/presensi');
const cspReportRouter = require('./routes/cspReport');
const { ensureSchema } = require('./config/schema');
const { identify, requireAnyAuth } = require('./middlewares/sessionAuth');
const db = require('./config/db');
const dataService = require('./services/dataService');
const { clientIp } = require('./utils/clientIp');

// One slow answer from Google must not hold a sync until the serverless time limit.
axios.defaults.timeout = 20000;

const app = express();
app.set('trust proxy', false);

// The app and its API share one origin, so browsers never need CORS for normal use.
// Only the production address, an extra one from ALLOWED_ORIGIN and local development are allowed.
const ALLOWED = new Set(['https://pantautokder.vercel.app', process.env.ALLOWED_ORIGIN].filter(Boolean));
const isAllowedOrigin = (origin) => ALLOWED.has(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.use(cors({
  origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Idempotency-Key'],
}));

// Refuse changes sent from another website (cross-site request forgery). Requests from the
// app itself carry its own origin, or the deployment's own host on Vercel previews.
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin || isAllowedOrigin(origin)) return next();
  try {
    if (new URL(origin).host === req.headers.host) return next();
  } catch (e) { /* malformed origin */ }
  return res.status(403).json({ error: 'Permintaan dari situs lain ditolak' });
});

app.use(express.json({ limit: '100kb' }));

app.use(async (req, res, next) => {
  try {
    await ensureSchema();
    next();
  } catch (err) {
    next(err);
  }
});

app.use(identify);

// Data differs per signed-in person: browsers must not share or reuse it across accounts.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
  next();
});


// Everything needs a signed-in owner or employee, except signing in itself, the OAuth
// return address (it checks the owner session on its own), the daily cron and CSP reports.
const PUBLIC = [
  ['POST', '/api/auth/login'],
  ['POST', '/api/auth/editor-login'],
  ['POST', '/api/auth/logout'],
  ['GET', '/api/auth/me'],
  ['GET', '/api/auth/karyawan'],
  ['GET', '/api/auth/callback'],
  ['GET', '/api/social/callback'],
  ['POST', '/api/posting/blob'],
  ['GET', /^\/api\/posting\/media\/\d+\/[\w-]+$/],
  ['GET', '/api/posting/yt/antrean'],
  ['POST', /^\/api\/posting\/yt\/\d+\/hasil$/],
  ['POST', '/api/social/meta/deauthorize'],
  ['POST', '/api/social/meta/data-deletion'],
  ['GET', '/api/scan/cron'],
  ['POST', '/api/csp-report'],
];
app.use('/api', (req, res, next) => {
  const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
  const method = req.method === 'HEAD' ? 'GET' : req.method;
  if (method === 'OPTIONS' || PUBLIC.some(([m, p]) => m === method && (p instanceof RegExp ? p.test(path) : p === path))) return next();
  return requireAnyAuth(req, res, next);
});

// Names of employees who can sign in, for the sign-in form. Nothing else is shown before login.
app.get('/api/auth/karyawan', async (req, res, next) => {
  try {
    const r = await db.query(`SELECT id, nama FROM editors WHERE status = 'aktif' AND pin IS NOT NULL AND pin <> '' ORDER BY nama`);
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

// Everything a page needs in one request (see dataService.bootstrap), plus who is signed in.
app.get('/api/bootstrap', async (req, res, next) => {
  try {
    const me = req.isAdmin ? { authenticated: true, type: 'admin' } : { authenticated: true, type: 'karyawan', ...req.editor };
    res.json({ me, ...(await dataService.bootstrap({ isAdmin: req.isAdmin, editor: req.editor, ip: clientIp(req) })) });
  } catch (err) {
    next(err);
  }
});

app.use('/api/editors', editorsRouter);
app.use('/api/content', contentRouter);
app.use('/api/scan', scanRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/auth', authRouter);
app.use('/api/aktivitas', aktivitasRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/performance', performanceRouter);
app.use('/api/presensi', presensiRouter);
app.use('/api/gaji', require('./routes/gaji'));
app.use('/api/pengajuan', require('./routes/pengajuan'));
app.use('/api/insight', require('./routes/insight'));
app.use('/api/push', require('./routes/push'));
app.use('/api/social', require('./routes/social'));
app.use('/api/posting', require('./routes/posting'));
app.use('/api', cspReportRouter);

app.use('/api', (req, res) => res.status(404).json({ error: 'Alamat API tidak ditemukan' }));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Data yang dikirim bukan JSON yang valid' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Data yang dikirim terlalu besar' });
  require('./utils/httpError').fail(res, err);
});

module.exports = app;
