/**
 * Module B: Preventive Maintenance Schedule Routes
 *
 * Provides PM dashboard data, status updates, and bulk operations.
 * Dynamically calculates color-coded status for each schedule.
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { getPMStatusColor, getCombinedPMStatus, calculatePMSchedule } = require('../services/pmScheduler');

const router = express.Router();

// ── Routes ────────────────────────────────────────────────────

/**
 * GET /api/pm-schedules/dashboard
 * Returns all PM schedules with computed color-coded status.
 * Supports filters: status, color, machine_id, page, limit
 */
router.get('/dashboard', async (req, res) => {
  try {
    const {
      status,
      color,
      machine_id,
      township_id,
      date_from,
      date_to,
      page = 1,
      limit = 50,
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (status) {
      whereClause += ` AND ps.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }
    if (machine_id) {
      whereClause += ` AND ps.machine_id = $${paramIdx}`;
      params.push(machine_id);
      paramIdx++;
    }
    if (township_id) {
      whereClause += ` AND m.township_id = $${paramIdx}`;
      params.push(township_id);
      paramIdx++;
    }
    if (date_from) {
      whereClause += ` AND ps.pm_date >= $${paramIdx}`;
      params.push(date_from);
      paramIdx++;
    }
    if (date_to) {
      whereClause += ` AND ps.pm_date <= $${paramIdx}`;
      params.push(date_to);
      paramIdx++;
    }

    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT ps.*,
              m.serial_number,
              m.hospital_name,
              m.model,
              m.contact_person,
              m.contact_phone,
              t.name AS township_name,
              b.name AS brand_name,
              mt.name AS machine_type_name
       FROM pm_schedules ps
       JOIN machines m ON ps.machine_id = m.id
       JOIN townships t ON m.township_id = t.id
       JOIN brands b ON m.brand_id = b.id
       JOIN machine_types mt ON m.machine_type_id = mt.id
       ${whereClause}
       ORDER BY ps.pm_date ASC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    // Compute dynamic color status for each schedule
    const now = new Date();
    const schedules = result.rows.map((schedule) => {
      const colorInfo = getPMStatusColor(
        schedule.pm_date,
        schedule.window_start,
        schedule.window_end,
        schedule.status,
        now
      );
      return {
        ...schedule,
        color: colorInfo.color,
        dynamic_status: colorInfo.status,
        status_label: colorInfo.label,
      };
    });

    // Optionally filter by computed color
    let filtered = schedules;
    if (color) {
      filtered = schedules.filter((s) => s.color === color);
    }

    res.json({
      success: true,
      data: filtered,
      computed_at: now.toISOString(),
    });
  } catch (err) {
    console.error('Error fetching PM dashboard:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/pm-schedules/summary
 * Returns a summary count of schedules by color status.
 * Useful for dashboard header/KPI cards.
 */
router.get('/summary', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ps.*
       FROM pm_schedules ps
       WHERE ps.status IN ('Scheduled', 'In Progress')`
    );

    const now = new Date();
    const counts = { red: 0, blue: 0, green: 0, gray: 0, completed: 0 };

    for (const schedule of result.rows) {
      const colorInfo = getPMStatusColor(
        schedule.pm_date,
        schedule.window_start,
        schedule.window_end,
        schedule.status,
        now
      );
      if (colorInfo.status === 'Completed') {
        counts.completed++;
      } else {
        counts[colorInfo.color]++;
      }
    }

    // Count completed ones too
    const completedResult = await pool.query(
      "SELECT COUNT(*) FROM pm_schedules WHERE status = 'Completed'"
    );
    counts.completed = parseInt(completedResult.rows[0].count, 10);

    res.json({
      success: true,
      data: {
        overdue: counts.red,
        upcoming: counts.blue,
        in_window: counts.green,
        scheduled: counts.gray,
        completed: counts.completed,
        total: counts.red + counts.blue + counts.green + counts.gray + counts.completed,
      },
      computed_at: now.toISOString(),
    });
  } catch (err) {
    console.error('Error fetching PM summary:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * PUT /api/pm-schedules/:id/complete
 * Mark a PM schedule as completed.
 */
router.put('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { completed_by, notes } = req.body;

    const result = await pool.query(
      `UPDATE pm_schedules
       SET status = 'Completed',
           completed_date = CURRENT_DATE,
           completed_by = $1,
           notes = COALESCE($2, notes),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [completed_by || null, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'PM schedule not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error completing PM:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/pm-schedules/regenerate/:machineId
 * Regenerate PM schedules for a machine (e.g., after installation date change).
 */
router.post('/regenerate/:machineId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { machineId } = req.params;

    await client.query('BEGIN');

    // Get machine installation date
    const machineResult = await client.query(
      'SELECT installation_date FROM machines WHERE id = $1',
      [machineId]
    );

    if (machineResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }

    const { installation_date } = machineResult.rows[0];
    const pmSchedule = calculatePMSchedule(installation_date);

    // Delete existing schedules
    await client.query('DELETE FROM pm_schedules WHERE machine_id = $1', [machineId]);

    // Insert new schedules
    await client.query(
      `INSERT INTO pm_schedules (machine_id, pm_number, pm_date, window_start, window_end)
       VALUES ($1, 1, $2, $3, $4)`,
      [machineId, pmSchedule.pm1.pmDate, pmSchedule.pm1.windowStart, pmSchedule.pm1.windowEnd]
    );
    await client.query(
      `INSERT INTO pm_schedules (machine_id, pm_number, pm_date, window_start, window_end)
       VALUES ($1, 2, $2, $3, $4)`,
      [machineId, pmSchedule.pm2.pmDate, pmSchedule.pm2.windowStart, pmSchedule.pm2.windowEnd]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'PM schedules regenerated',
      data: pmSchedule,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error regenerating PM schedules:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/pm-schedules/:id
 * Delete a PM schedule entry (admin only).
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM pm_schedules WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'PM schedule not found' });
    }

    const deleted = result.rows[0];

    // Try to log the action (import from auditLogs if available)
    try {
      const { logAction } = require('./auditLogs');
      await logAction({
        userId: req.user?.id,
        username: req.user?.username,
        action: 'DELETE',
        module: 'pm_dashboard',
        entityType: 'pm_schedule',
        entityId: id,
        entityLabel: `PM #${deleted.pm_number} for machine ${deleted.machine_id}`,
        ipAddress: req.ip,
      });
    } catch (_) { /* audit logging is optional */ }

    res.json({ success: true, message: 'PM schedule deleted' });
  } catch (err) {
    console.error('Error deleting PM schedule:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
