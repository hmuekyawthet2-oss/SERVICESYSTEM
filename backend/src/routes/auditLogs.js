/**
 * Audit Logs Routes
 * Tracks all user actions (CREATE, UPDATE, DELETE) across the system.
 */

const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * Helper: log an action. Call this from other routes after a successful mutation.
 * @param {Object} params
 * @param {string} params.userId - Current user ID
 * @param {string} params.username - Current username
 * @param {string} params.action - CREATE, UPDATE, DELETE
 * @param {string} params.module - machine_registry, pm_dashboard, service_tickets, admin_settings
 * @param {string} params.entityType - machine, pm_schedule, service_ticket, etc.
 * @param {string} params.entityId - ID of the affected record
 * @param {string} params.entityLabel - Human-readable label
 * @param {Object} [params.details] - Extra context (diff, notes, etc.)
 * @param {string} [params.ipAddress] - Client IP
 */
async function logAction({ userId, username, action, module, entityType, entityId, entityLabel, details, ipAddress }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, username, action, module, entity_type, entity_id, entity_label, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId || null,
        username || null,
        action,
        module,
        entityType,
        String(entityId || ''),
        entityLabel || '',
        details ? JSON.stringify(details) : null,
        ipAddress || null,
      ]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

/**
 * GET /api/audit-logs
 * List audit logs with pagination, search, and filters.
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      search,
      module: moduleFilter,
      action,
      user_id,
      date_from,
      date_to,
      page = 1,
      limit = 10,
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (search) {
      whereClause += ` AND (al.username ILIKE $${paramIdx} OR al.entity_label ILIKE $${paramIdx} OR al.entity_id ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (moduleFilter) {
      whereClause += ` AND al.module = $${paramIdx}`;
      params.push(moduleFilter);
      paramIdx++;
    }
    if (action) {
      whereClause += ` AND al.action = $${paramIdx}`;
      params.push(action);
      paramIdx++;
    }
    if (user_id) {
      whereClause += ` AND al.user_id = $${paramIdx}`;
      params.push(user_id);
      paramIdx++;
    }
    if (date_from) {
      whereClause += ` AND al.created_at >= $${paramIdx}`;
      params.push(date_from);
      paramIdx++;
    }
    if (date_to) {
      whereClause += ` AND al.created_at <= $${paramIdx}::date + interval '1 day'`;
      params.push(date_to);
      paramIdx++;
    }

    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_logs al ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT al.*, u.display_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * DELETE /api/audit-logs/:id
 * Delete a single audit log entry (admin only).
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM audit_logs WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Log entry not found' });
    }
    res.json({ success: true, message: 'Log entry deleted' });
  } catch (err) {
    console.error('Error deleting audit log:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * DELETE /api/audit-logs
 * Bulk delete audit logs older than a given date (admin only).
 */
router.delete('/', authenticate, async (req, res) => {
  try {
    const { older_than } = req.body;
    if (!older_than) {
      return res.status(400).json({ success: false, message: 'older_than date is required' });
    }
    const result = await pool.query(
      'DELETE FROM audit_logs WHERE created_at < $1',
      [older_than]
    );
    res.json({ success: true, message: `Deleted ${result.rowCount} log entries` });
  } catch (err) {
    console.error('Error bulk-deleting audit logs:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
module.exports.logAction = logAction;
