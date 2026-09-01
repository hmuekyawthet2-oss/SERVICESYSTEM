/**
 * Permissions Routes
 * Main Admin can grant/revoke per-tab, per-field permissions for co-admins
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require main_admin
router.use(authenticate, requireRole('main_admin'));

/**
 * Available tabs and fields for permissions
 */
const PERMISSION_SCHEMA = {
  machine_registry: {
    label: 'Machine Registry',
    fields: ['create', 'edit', 'delete'],
  },
  pm_dashboard: {
    label: 'PM Dashboard',
    fields: ['view', 'complete'],
  },
  service_tickets: {
    label: 'Service Tickets',
    fields: ['create', 'edit', 'delete', 'close'],
  },
  admin_settings: {
    label: 'Settings',
    fields: ['view', 'edit'],
  },
};

/**
 * GET /api/permissions/schema
 * Returns the available permission structure
 */
router.get('/schema', (req, res) => {
  res.json({ success: true, data: PERMISSION_SCHEMA });
});

/**
 * GET /api/permissions/:userId
 * Get all permissions for a specific user
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const userResult = await pool.query(
      'SELECT id, username, display_name, role FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const permResult = await pool.query(
      'SELECT tab, field, granted FROM permissions WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: {
        user: userResult.rows[0],
        permissions: permResult.rows,
      },
    });
  } catch (err) {
    console.error('Get permissions error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * PUT /api/permissions/:userId
 * Bulk update permissions for a user
 * Body: { permissions: [{ tab, field, granted }] }
 */
router.put('/:userId', [
  body('permissions').isArray().withMessage('Permissions must be an array'),
  body('permissions.*.tab').trim().notEmpty().withMessage('Tab is required'),
  body('permissions.*.field').trim().notEmpty().withMessage('Field is required'),
  body('permissions.*.granted').custom((v) => {
      return v === true || v === false || v === 'true' || v === 'false' || v === '1' || v === '0';
    }).withMessage('Granted must be boolean'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array().map(e => ({ field: e.path, message: e.msg })) });
  }

  const client = await pool.connect();
  try {
    const { userId } = req.params;
    const { permissions } = req.body;

    // Verify user exists and is co_admin
    const userCheck = await client.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await client.query('BEGIN');

    // Delete existing permissions for this user
    await client.query('DELETE FROM permissions WHERE user_id = $1', [userId]);

    // Insert new permissions
    for (const perm of permissions) {
      if (perm.granted) {
        await client.query(
          'INSERT INTO permissions (user_id, tab, field, granted) VALUES ($1, $2, $3, true)',
          [userId, perm.tab, perm.field]
        );
      }
    }

    await client.query('COMMIT');

    // Fetch updated permissions
    const result = await pool.query(
      'SELECT tab, field, granted FROM permissions WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
      message: 'Permissions updated successfully',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update permissions error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/permissions/check
 * Check if current co_admin has a specific permission
 */
router.post('/check', authenticate, async (req, res) => {
  try {
    const { tab, field } = req.body;
    const userId = req.user.id;

    // Main admin always has all permissions
    if (req.user.role === 'main_admin') {
      return res.json({ success: true, data: { granted: true } });
    }

    const result = await pool.query(
      'SELECT granted FROM permissions WHERE user_id = $1 AND tab = $2 AND field = $3',
      [userId, tab, field]
    );

    const granted = result.rows.length > 0 && result.rows[0].granted;

    res.json({ success: true, data: { granted } });
  } catch (err) {
    console.error('Check permission error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
