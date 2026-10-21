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
const { ensureSchema } = require('./config/schema');

const app = express();

app.use(cors());
app.use(express.json());

// Add new tables and columns once per cold start (additive only).
app.use(async (req, res, next) => { await ensureSchema(); next(); });

const adminAuth = require('./middlewares/adminAuth');
app.use(adminAuth);

app.use('/api/editors', editorsRouter);
app.use('/api/content', contentRouter);
app.use('/api/scan', scanRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/auth', authRouter);
app.use('/api/aktivitas', aktivitasRouter);
app.use('/api/channels', channelsRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
