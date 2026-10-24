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

// CORS configuration - only allow our Vercel domain with credentials
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://pantautokder.vercel.app';
app.use(cors({
  origin: ALLOWED_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '100kb' }));

// Add new tables and columns once per cold start (additive only).
app.use(async (req, res, next) => { await ensureSchema(); next(); });

// Session-based authentication middleware
const { identify } = require('./middlewares/sessionAuth');
app.use(identify);

// Routes
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

// Error handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Data yang dikirim bukan JSON yang valid' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Data yang dikirim terlalu besar' });
  console.error(err.stack);
  res.status(500).json({ error: 'Terjadi kesalahan di server' });
});

module.exports = app;
