/**
 * Seed Script
 * Run after importing schema.sql to create users with proper password hashes.
 *
 * Usage:
 *   cd backend && node src/config/seed.js
 *
 * Creates:
 *   - admin / admin123 (Main Admin) — full permissions
 *   - technician / tech123 (Co-Admin) — no permissions by default
 */

const bcrypt = require('bcryptjs');
const pool = require('./database');

const TAB_FIELDS = {
  machine_registry: ['create', 'edit', 'delete'],
  pm_dashboard: ['view', 'complete', 'delete'],
  service_tickets: ['create', 'edit', 'delete', 'close'],
  admin_settings: ['view', 'edit'],
  history: ['view', 'delete'],
};

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const salt = await bcrypt.genSalt(10);

    // ── Main Admin ──────────────────────────────────────────
    const adminHash = await bcrypt.hash('admin123', salt);
    let adminId;

    const existingAdmin = await client.query("SELECT id FROM users WHERE username = 'admin'");
    if (existingAdmin.rows.length > 0) {
      adminId = existingAdmin.rows[0].id;
      await client.query('UPDATE users SET password_hash = $1, role = $2 WHERE username = $3', [adminHash, 'main_admin', 'admin']);
      console.log('✅ Admin password updated (admin / admin123)');
    } else {
      const res = await client.query(
        "INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4) RETURNING id",
        ['admin', adminHash, 'Main Administrator', 'main_admin']
      );
      adminId = res.rows[0].id;
      console.log('✅ Admin user created (admin / admin123)');
    }

    // Grant ALL permissions to admin
    for (const [tab, fields] of Object.entries(TAB_FIELDS)) {
      for (const field of fields) {
        await client.query(
          `INSERT INTO permissions (user_id, tab, field, granted)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (user_id, tab, field) DO UPDATE SET granted = true`,
          [adminId, tab, field]
        );
      }
    }
    console.log('✅ Admin permissions granted (all tabs, all fields)');

    // ── Co-Admin (Technician) ───────────────────────────────
    const coHash = await bcrypt.hash('tech123', salt);
    const coExisting = await client.query("SELECT id FROM users WHERE username = 'technician'");
    if (coExisting.rows.length === 0) {
      await client.query(
        "INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4)",
        ['technician', coHash, 'Demo Technician', 'co_admin']
      );
      console.log('✅ Co-admin user created (technician / tech123)');
    } else {
      await client.query('UPDATE users SET password_hash = $1 WHERE username = $2', [coHash, 'technician']);
      console.log('✅ Co-admin password updated (technician / tech123)');
    }

    await client.query('COMMIT');
    console.log('\n📋 Default Logins:');
    console.log('   Main Admin:  admin / admin123');
    console.log('   Co-Admin:    technician / tech123');
    console.log('\n🚀 You can now start the server with: npm run dev');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed error:', err.message);
    console.error('   Make sure the schema has been imported first:');
    console.error('   psql -U postgres -d service_db -f backend/src/config/schema.sql');
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
