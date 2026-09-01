/**
 * Login Logs Routes
 * Provides admin-only access to view login history (user, IP, time, device)
 */

const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/login-logs
 * List login logs with pagination, search, and filters (admin only)
 */
router.get('/', authenticate, requireRole('main_admin'), async (req, res) => {
  try {
    const {
      search,
      status,
      user_id,
      date_from,
      date_to,
      page = 1,
      limit = 20,
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (search) {
      whereClause += ` AND (ll.username ILIKE $${paramIdx} OR ll.ip_address ILIKE $${paramIdx} OR ll.device_type ILIKE $${paramIdx} OR ll.browser ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (status) {
      whereClause += ` AND ll.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }
    if (user_id) {
      whereClause += ` AND ll.user_id = $${paramIdx}`;
      params.push(user_id);
      paramIdx++;
    }
    if (date_from) {
      whereClause += ` AND ll.created_at >= $${paramIdx}`;
      params.push(date_from);
      paramIdx++;
    }
    if (date_to) {
      whereClause += ` AND ll.created_at <= $${paramIdx}::date + interval '1 day'`;
      params.push(date_to);
      paramIdx++;
    }

    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM login_logs ll ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT ll.*, u.display_name
       FROM login_logs ll
       LEFT JOIN users u ON ll.user_id = u.id
       ${whereClause}
       ORDER BY ll.created_at DESC
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
    console.error('Error fetching login logs:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/login-logs/stats
 * Summary stats for the login logs
 */
router.get('/stats', authenticate, requireRole('main_admin'), async (req, res) => {
  try {
    const [totalResult, todayResult, failedResult, uniqueUsersResult] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM login_logs'),
      pool.query("SELECT COUNT(*) FROM login_logs WHERE created_at::date = CURRENT_DATE"),
      pool.query('SELECT COUNT(*) FROM login_logs WHERE status = $1', ['failed']),
      pool.query("SELECT COUNT(DISTINCT user_id) FROM login_logs WHERE status = 'success' AND created_at > NOW() - INTERVAL '24 hours'"),
    ]);

    res.json({
      success: true,
      data: {
        totalLogins: parseInt(totalResult.rows[0].count, 10),
        todayLogins: parseInt(todayResult.rows[0].count, 10),
        failedAttempts: parseInt(failedResult.rows[0].count, 10),
        activeUsers24h: parseInt(uniqueUsersResult.rows[0].count, 10),
      },
    });
  } catch (err) {
    console.error('Error fetching login stats:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * DELETE /api/login-logs/:id
 * Delete a single login log entry (admin only)
 */
router.delete('/:id', authenticate, requireRole('main_admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM login_logs WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Log entry not found' });
    }
    res.json({ success: true, message: 'Log entry deleted' });
  } catch (err) {
    console.error('Error deleting login log:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * DELETE /api/login-logs
 * Bulk delete login logs older than a given date (admin only)
 */
router.delete('/', authenticate, requireRole('main_admin'), async (req, res) => {
  try {
    const { older_than } = req.body;
    if (!older_than) {
      return res.status(400).json({ success: false, message: 'older_than date is required' });
    }
    const result = await pool.query('DELETE FROM login_logs WHERE created_at < $1', [older_than]);
    res.json({ success: true, message: `Deleted ${result.rowCount} login log entries` });
  } catch (err) {
    console.error('Error bulk-deleting login logs:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
