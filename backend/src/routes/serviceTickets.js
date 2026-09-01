/**
 * Module C: Field Service & Customer Complaint Workflow Routes
 *
 * Manages the lifecycle of service tickets:
 *   Open → (Pending Job) → In Progress → Finished
 *
 * Auto-generates unique Request IDs in format: REQ-YYYYMMDD-XXXX
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { logAction } = require('./auditLogs');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────

async function generateTicketNumber(client) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `REQ-${dateStr}-`;

  const result = await client.query(
    `SELECT ticket_number FROM service_tickets
     WHERE ticket_number LIKE $1
     ORDER BY ticket_number DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let sequence = 1;
  if (result.rows.length > 0) {
    const lastNum = parseInt(result.rows[0].ticket_number.split('-').pop(), 10);
    sequence = lastNum + 1;
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

// ── Validation Rules ──────────────────────────────────────────

const ticketValidation = [
  body('machine_id')
    .custom((v) => {
      const str = String(v);
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    }).withMessage('Valid machine ID (UUID) is required'),
  body('complaint_date')
    .isISO8601().withMessage('Valid complaint date is required (YYYY-MM-DD)'),
  body('error_type')
    .trim()
    .notEmpty().withMessage('Error type is required'),
  body('error_code')
    .optional()
    .trim(),
  body('solution_process')
    .optional(),
  body('solving_type')
    .isIn(['Phone', 'On-Site', 'Office']).withMessage('Solving type must be Phone, On-Site, or Office'),
  body('spare_parts_needed')
    .custom((v) => {
      return v === true || v === false || v === 'true' || v === 'false' || v === '1' || v === '0';
    }).withMessage('Spare parts needed must be true or false'),
  body('action_date')
    .optional({ values: 'null' }),
  body('technician_name')
    .optional(),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ── Routes ────────────────────────────────────────────────────

/**
 * GET /api/service-tickets
 */
router.get('/', async (req, res) => {
  try {
    const {
      status,
      machine_id,
      solving_type,
      search,
      date_from,
      date_to,
      page = 1,
      limit = 20,
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (status) {
      whereClause += ` AND st.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }
    if (machine_id) {
      whereClause += ` AND st.machine_id = $${paramIdx}`;
      params.push(machine_id);
      paramIdx++;
    }
    if (solving_type) {
      whereClause += ` AND st.solving_type = $${paramIdx}`;
      params.push(solving_type);
      paramIdx++;
    }
    if (search) {
      whereClause += ` AND (
        st.ticket_number ILIKE $${paramIdx} OR
        st.error_type ILIKE $${paramIdx} OR
        m.serial_number ILIKE $${paramIdx} OR
        m.hospital_name ILIKE $${paramIdx}
      )`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (date_from) {
      whereClause += ` AND st.complaint_date >= $${paramIdx}`;
      params.push(date_from);
      paramIdx++;
    }
    if (date_to) {
      whereClause += ` AND st.complaint_date <= $${paramIdx}`;
      params.push(date_to);
      paramIdx++;
    }

    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM service_tickets st
       JOIN machines m ON st.machine_id = m.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT st.*,
              m.serial_number,
              m.hospital_name,
              m.model,
              b.name AS brand_name,
              mt.name AS machine_type_name
       FROM service_tickets st
       JOIN machines m ON st.machine_id = m.id
       JOIN brands b ON m.brand_id = b.id
       JOIN machine_types mt ON m.machine_type_id = mt.id
       ${whereClause}
       ORDER BY st.created_at DESC
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
    console.error('Error fetching tickets:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/service-tickets/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT st.*,
              m.serial_number,
              m.hospital_name,
              m.model,
              m.contact_person,
              m.contact_phone,
              b.name AS brand_name,
              mt.name AS machine_type_name,
              t.name AS township_name
       FROM service_tickets st
       JOIN machines m ON st.machine_id = m.id
       JOIN brands b ON m.brand_id = b.id
       JOIN machine_types mt ON m.machine_type_id = mt.id
       JOIN townships t ON m.township_id = t.id
       WHERE st.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service ticket not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching ticket:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/service-tickets
 * Create a new service ticket (authenticated).
 */
router.post(
  '/',
  authenticate,
  ticketValidation,
  handleValidationErrors,
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const machineCheck = await client.query(
        'SELECT id FROM machines WHERE id = $1',
        [req.body.machine_id]
      );
      if (machineCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Machine not found.',
        });
      }

      const ticket_number = await generateTicketNumber(client);

      const sparePartsNeeded = req.body.spare_parts_needed === true || req.body.spare_parts_needed === 'true';
      const initialStatus = sparePartsNeeded ? 'Pending Job' : 'Open';

      const {
        machine_id, complaint_date, error_type, error_code,
        solution_process, solving_type, spare_parts_description,
        action_date, technician_name,
        service_fees, transport_fees, training_fees,
      } = req.body;

      const result = await client.query(
        `INSERT INTO service_tickets
         (ticket_number, machine_id, complaint_date, error_type, error_code,
          solution_process, solving_type, spare_parts_needed,
          spare_parts_description, action_date, status, technician_name,
          service_fees, transport_fees, training_fees)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [ticket_number, machine_id, complaint_date, error_type, error_code || null,
         solution_process || null, solving_type, sparePartsNeeded,
         spare_parts_description || null, action_date || null, initialStatus,
         technician_name || null,
         service_fees || 0, transport_fees || 0, training_fees || 0]
      );

      await client.query('COMMIT');

      logAction({
        userId: req.user?.id, username: req.user?.username,
        action: 'CREATE', module: 'service_tickets', entityType: 'service_ticket',
        entityId: result.rows[0].id, entityLabel: ticket_number,
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: `Ticket ${ticket_number} created with status: ${initialStatus}`,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error creating ticket:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

/**
 * PUT /api/service-tickets/:id/status
 * Update ticket status. Valid transitions:
 *   Open → Pending Job, In Progress, Finished
 *   Pending Job → In Progress, Finished
 *   In Progress → Finished
 */
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, job_finished_date, solution_process } = req.body;

    const validTransitions = {
      Open: ['Pending Job', 'In Progress', 'Finished'],
      'Pending Job': ['In Progress', 'Finished'],
      'In Progress': ['Finished'],
      Finished: [],
    };

    const current = await pool.query(
      'SELECT status FROM service_tickets WHERE id = $1',
      [id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service ticket not found' });
    }

    const currentStatus = current.rows[0].status;

    if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from "${currentStatus}" to "${status}"`,
        valid_transitions: validTransitions[currentStatus] || [],
      });
    }

    if (status === 'Finished' && !job_finished_date) {
      return res.status(400).json({
        success: false,
        message: 'Job finished date is required when finishing a ticket',
        field: 'job_finished_date',
      });
    }

    const result = await pool.query(
      `UPDATE service_tickets
       SET status = $1,
           job_finished_date = COALESCE($2, job_finished_date),
           solution_process = COALESCE($3, solution_process),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, job_finished_date || null, solution_process || null, id]
    );

    logAction({
      userId: req.user?.id, username: req.user?.username,
      action: 'UPDATE', module: 'service_tickets', entityType: 'service_ticket',
      entityId: id, entityLabel: `${result.rows[0].ticket_number} (${currentStatus} → ${status})`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: `Ticket updated to status: ${status}`,
    });
  } catch (err) {
    console.error('Error updating ticket status:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * PUT /api/service-tickets/:id
 */
router.put('/:id', authenticate, ticketValidation, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      machine_id, complaint_date, error_type, error_code,
      solution_process, solving_type, spare_parts_needed,
      spare_parts_description, action_date, technician_name,
      service_fees, transport_fees, training_fees,
    } = req.body;

    const sparePartsNeeded = spare_parts_needed === true || spare_parts_needed === 'true';

    const result = await pool.query(
      `UPDATE service_tickets SET
        machine_id=$1, complaint_date=$2, error_type=$3, error_code=$4,
        solution_process=$5, solving_type=$6, spare_parts_needed=$7,
        spare_parts_description=$8, action_date=$9, technician_name=$10,
        service_fees=$11, transport_fees=$12, training_fees=$13,
        updated_at=NOW()
       WHERE id=$14
       RETURNING *`,
      [machine_id, complaint_date, error_type, error_code || null,
       solution_process || null, solving_type, sparePartsNeeded,
       spare_parts_description || null, action_date || null,
       technician_name || null,
       service_fees || 0, transport_fees || 0, training_fees || 0, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service ticket not found' });
    }

    logAction({
      userId: req.user?.id, username: req.user?.username,
      action: 'UPDATE', module: 'service_tickets', entityType: 'service_ticket',
      entityId: id, entityLabel: result.rows[0].ticket_number,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating ticket:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * DELETE /api/service-tickets/:id
 * Only if status is 'Open'.
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const check = await pool.query(
      "SELECT status FROM service_tickets WHERE id = $1",
      [id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service ticket not found' });
    }

    if (check.rows[0].status !== 'Open') {
      return res.status(409).json({
        success: false,
        message: 'Only tickets with "Open" status can be deleted',
      });
    }

    const ticketInfo = check.rows[0];
    const ticketNum = (await pool.query('SELECT ticket_number FROM service_tickets WHERE id = $1', [id])).rows[0]?.ticket_number;
    await pool.query('DELETE FROM service_tickets WHERE id = $1', [id]);

    logAction({
      userId: req.user?.id, username: req.user?.username,
      action: 'DELETE', module: 'service_tickets', entityType: 'service_ticket',
      entityId: id, entityLabel: ticketNum || id,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Ticket deleted successfully' });
  } catch (err) {
    console.error('Error deleting ticket:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
