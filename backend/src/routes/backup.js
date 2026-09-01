/**
 * Database Backup Route
 * Generates a .sql dump file for download.
 */

const express = require('express');
const { execSync } = require('child_process');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/backup/download
 * Downloads a full .sql backup of the database.
 * Only accessible to main_admin.
 */
router.get('/download', authenticate, async (req, res) => {
  // Only main_admin can backup
  if (req.user.role !== 'main_admin') {
    return res.status(403).json({ success: false, message: 'Only main admin can create backups' });
  }

  try {
    // If using mock mode, generate SQL from queries
    if (pool.isMock && pool.isMock()) {
      const sql = generateMockBackup();
      const filename = `service_db_backup_${new Date().toISOString().slice(0, 10)}.sql`;
      res.setHeader('Content-Type', 'text/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(sql);
    }

    // Real PostgreSQL — use pg_dump
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbName = process.env.DB_NAME || 'service_db';
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPass = process.env.DB_PASSWORD || '';

    // Set password for pg_dump
    const env = { ...process.env, PGPASSWORD: dbPass };

    try {
      const dump = execSync(
        `pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --no-owner --no-privileges`,
        { env, maxBuffer: 50 * 1024 * 1024, encoding: 'utf-8' }
      );

      const filename = `${dbName}_backup_${new Date().toISOString().slice(0, 10)}.sql`;
      res.setHeader('Content-Type', 'text/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(dump);
    } catch (dumpErr) {
      // pg_dump not available — fall back to manual export
      console.warn('pg_dump not available, using manual export:', dumpErr.message);
      const sql = await generateManualBackup();
      const filename = `${dbName}_backup_${new Date().toISOString().slice(0, 10)}.sql`;
      res.setHeader('Content-Type', 'text/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(sql);
    }
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ success: false, message: 'Failed to create backup' });
  }
});

/**
 * Manual backup: dump all tables as INSERT statements
 */
async function generateManualBackup() {
  const lines = [];
  lines.push('-- ============================================================');
  lines.push('-- Medical Equipment Service System — Database Backup');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- ============================================================');
  lines.push('');

  const tables = [
    'users', 'permissions', 'token_blacklist',
    'townships', 'brands', 'models', 'machine_types',
    'machines', 'training_dates', 'pm_schedules',
    'service_tickets', 'service_engineers', 'audit_logs',
  ];

  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT * FROM ${table}`);
      if (result.rows.length === 0) continue;

      lines.push(`-- ${table}`);
      lines.push(`DELETE FROM ${table};`);

      const columns = Object.keys(result.rows[0]);
      for (const row of result.rows) {
        const values = columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return String(val);
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (typeof val === 'object') return `'${String(JSON.stringify(val)).replace(/'/g, "''")}'`;
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        lines.push(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
      }
      lines.push('');
    } catch (err) {
      lines.push(`-- Error dumping ${table}: ${err.message}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateMockBackup() {
  return '-- Mock mode backup — data is in-memory only';
}

module.exports = router;
