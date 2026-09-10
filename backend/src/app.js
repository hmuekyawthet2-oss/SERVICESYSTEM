/**
 * Medical Equipment Service Data Entry System
 * Main Express Application
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRouter = require('./routes/auth');
const permissionsRouter = require('./routes/permissions');
const machinesRouter = require('./routes/machines');
const { adminRouter } = require('./routes/machines');
const pmSchedulesRouter = require('./routes/pmSchedules');
const serviceTicketsRouter = require('./routes/serviceTickets');
const auditLogsRouter = require('./routes/auditLogs');
const loginLogsRouter = require('./routes/loginLogs');
const backupRouter = require('./routes/backup');
const exportRouter = require('./routes/export');
const formsRouter = require('./routes/forms');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

// ── Middleware ─────────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      ...(process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean),
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
      process.env.SITE_URL || '',
    ].filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true,
}));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/permissions', permissionsRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/pm-schedules', pmSchedulesRouter);
app.use('/api/service-tickets', serviceTicketsRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/login-logs', loginLogsRouter);
app.use('/api/backup', backupRouter);
app.use('/api/export', exportRouter);
app.use('/api/forms', formsRouter);

// ── 404 Handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Start Server ──────────────────────────────────────────────
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Medical Equipment Service API running on port ${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
