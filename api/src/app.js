const express = require('express');
const cors = require('cors');

const editorsRouter = require('./routes/editors');
const contentRouter = require('./routes/content');
const scanRouter = require('./routes/scan');
const metricsRouter = require('./routes/metrics');
const goalsRouter = require('./routes/goals');
const authRouter = require('./routes/auth');
const aktivitasRouter = require('./routes/aktivitas');
const channelsRouter = require('./routes/channels');
const analyticsRouter = require('./routes/analytics');
const performanceRouter = require('./routes/performance');
const cspReportRouter = require('./routes/cspReport');
const { ensureSchema } = require('./config/schema');

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (process.env.ALLOWED_ORIGIN && origin === process.env.ALLOWED_ORIGIN) return callback(null, true);
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return callback(null, true);
    if (origin.endsWith('.vercel.app') || origin === 'https://pantautokder.vercel.app') return callback(null, true);
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '100kb' }));

app.use(async (req, res, next) => { await ensureSchema(); next(); });

const { identify } = require('./middlewares/sessionAuth');
app.use(identify);

app.use('/api/editors', editorsRouter);
app.use('/api/content', contentRouter);
app.use('/api/scan', scanRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/auth', authRouter);
app.use('/api/aktivitas', aktivitasRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/performance', performanceRouter);
app.use('/api', cspReportRouter);

app.use('/api', (req, res) => res.status(404).json({ error: 'Alamat API tidak ditemukan' }));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Data yang dikirim bukan JSON yang valid' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Data yang dikirim terlalu besar' });
  console.error(err.stack);
  res.status(500).json({ error: 'Terjadi kesalahan di server' });
});

module.exports = app;