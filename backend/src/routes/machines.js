/**
 * Module A: Machine Registry Routes
 *
 * Handles CRUD operations for installed medical equipment.
 * Includes validation for unique serial numbers and foreign key integrity.
 * Auth middleware restricts mutations to authorized users.
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const pool = require('../config/database');
const { calculatePMSchedule } = require('../services/pmScheduler');
const { authenticate } = require('../middleware/auth');
const { logAction } = require('./auditLogs');

const router = express.Router();

// ── Validation Rules ──────────────────────────────────────────

// Helper: accept integer as number or numeric string
function isIntOrString(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1;
}

const machineValidation = [
  body('hospital_name')
    .trim()
    .notEmpty().withMessage('Hospital/Clinic name is required')
    .isLength({ max: 255 }).withMessage('Hospital name must be under 255 characters'),
  body('township_id')
    .custom((v) => isIntOrString(v)).withMessage('Valid township is required'),
  body('contact_person')
    .trim()
    .notEmpty().withMessage('Contact person is required')
    .isLength({ max: 150 }).withMessage('Contact person must be under 150 characters'),
  body('contact_phone')
    .trim()
    .notEmpty().withMessage('Phone number is required'),
  body('installation_date')
    .isISO8601().withMessage('Valid installation date is required (YYYY-MM-DD)'),
  body('brand_id')
    .custom((v) => isIntOrString(v)).withMessage('Valid brand is required'),
  body('model')
    .trim()
    .notEmpty().withMessage('Model is required'),
  body('machine_type_id')
    .custom((v) => isIntOrString(v)).withMessage('Valid machine type is required'),
  body('serial_number')
    .trim()
    .notEmpty().withMessage('Serial number is required')
    .isLength({ max: 100 }).withMessage('Serial number must be under 100 characters'),
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
 * GET /api/machines
 * List all machines with optional search/filter.
 */
router.get('/', async (req, res) => {
  try {
    const {
      search,
      township_id,
      brand_id,
      machine_type_id,
      page = 1,
      limit = 20,
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (search) {
      whereClause += ` AND (
        m.serial_number ILIKE $${paramIdx} OR
        m.hospital_name ILIKE $${paramIdx} OR
        m.model ILIKE $${paramIdx}
      )`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (township_id) {
      whereClause += ` AND m.township_id = $${paramIdx}`;
      params.push(township_id);
      paramIdx++;
    }
    if (brand_id) {
      whereClause += ` AND m.brand_id = $${paramIdx}`;
      params.push(brand_id);
      paramIdx++;
    }
    if (machine_type_id) {
      whereClause += ` AND m.machine_type_id = $${paramIdx}`;
      params.push(machine_type_id);
      paramIdx++;
    }

    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM machines m ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT m.*,
              t.name AS township_name,
              t.region AS township_region,
              b.name AS brand_name,
              mt.name AS machine_type_name
       FROM machines m
       JOIN townships t ON m.township_id = t.id
       JOIN brands b ON m.brand_id = b.id
       JOIN machine_types mt ON m.machine_type_id = mt.id
       ${whereClause}
       ORDER BY m.created_at DESC
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
    console.error('Error fetching machines:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/machines/:id
 * Get a single machine by ID, including PM schedule, training dates, and recent tickets.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const machineResult = await pool.query(
      `SELECT m.*,
              t.name AS township_name,
              t.region AS township_region,
              b.name AS brand_name,
              mt.name AS machine_type_name
       FROM machines m
       JOIN townships t ON m.township_id = t.id
       JOIN brands b ON m.brand_id = b.id
       JOIN machine_types mt ON m.machine_type_id = mt.id
       WHERE m.id = $1`,
      [id]
    );

    if (machineResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }

    // Fetch PM schedules
    const pmResult = await pool.query(
      'SELECT * FROM pm_schedules WHERE machine_id = $1 ORDER BY pm_number',
      [id]
    );

    // Fetch training dates
    const trainingResult = await pool.query(
      'SELECT * FROM training_dates WHERE machine_id = $1 ORDER BY training_number',
      [id]
    );

    // Fetch recent service tickets
    const ticketsResult = await pool.query(
      `SELECT * FROM service_tickets WHERE machine_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...machineResult.rows[0],
        pm_schedules: pmResult.rows,
        training_dates: trainingResult.rows,
        recent_tickets: ticketsResult.rows,
      },
    });
  } catch (err) {
    console.error('Error fetching machine:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/machines
 * Register a new machine (authenticated). Auto-generates PM schedule.
 */
router.post(
  '/',
  authenticate,
  machineValidation,
  handleValidationErrors,
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check for duplicate serial number
      const existingCheck = await client.query(
        'SELECT id FROM machines WHERE serial_number = $1',
        [req.body.serial_number]
      );
      if (existingCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'A machine with this serial number already exists',
          field: 'serial_number',
        });
      }

      const {
        hospital_name, township_id, contact_person, contact_phone,
        installation_date, brand_id, model, model_id, machine_type_id,
        serial_number, technician_names, service_fees, transport_fees, training_fees, notes,
      } = req.body;

      const insertResult = await client.query(
        `INSERT INTO machines
         (hospital_name, township_id, contact_person, contact_phone,
          installation_date, brand_id, model_id, model, machine_type_id,
          serial_number, technician_names, service_fees, transport_fees, training_fees, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [hospital_name, township_id, contact_person, contact_phone,
         installation_date, brand_id, model_id || null, model, machine_type_id,
         serial_number, technician_names || null,
         service_fees || 0, transport_fees || 0, training_fees || 0, notes || null]
      );

      const machine = insertResult.rows[0];

      // Auto-generate PM schedule entries
      const pmSchedule = calculatePMSchedule(installation_date);

      await client.query(
        `INSERT INTO pm_schedules (machine_id, pm_number, pm_date, window_start, window_end)
         VALUES ($1, 1, $2, $3, $4)`,
        [machine.id, pmSchedule.pm1.pmDate, pmSchedule.pm1.windowStart, pmSchedule.pm1.windowEnd]
      );
      await client.query(
        `INSERT INTO pm_schedules (machine_id, pm_number, pm_date, window_start, window_end)
         VALUES ($1, 2, $2, $3, $4)`,
        [machine.id, pmSchedule.pm2.pmDate, pmSchedule.pm2.windowStart, pmSchedule.pm2.windowEnd]
      );

      // Save training dates if provided
      const trainingDates = req.body.training_dates || [];
      for (let i = 0; i < trainingDates.length; i++) {
        if (trainingDates[i]) {
          await client.query(
            `INSERT INTO training_dates (machine_id, training_number, training_date)
             VALUES ($1, $2, $3)`,
            [machine.id, i + 1, trainingDates[i]]
          );
        }
      }

      await client.query('COMMIT');

      // Log the action
      logAction({
        userId: req.user?.id, username: req.user?.username,
        action: 'CREATE', module: 'machine_registry', entityType: 'machine',
        entityId: machine.id, entityLabel: `${serial_number} — ${hospital_name}`,
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        data: machine,
        pm_schedule: pmSchedule,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error creating machine:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

/**
 * PUT /api/machines/:id
 * Update a machine's details (authenticated).
 */
router.put('/:id', authenticate, machineValidation, handleValidationErrors, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      hospital_name, township_id, contact_person, contact_phone,
      installation_date, brand_id, model, model_id, machine_type_id,
      serial_number, technician_names, service_fees, transport_fees, training_fees, notes,
    } = req.body;

    // Check serial number uniqueness (excluding self)
    const existingCheck = await client.query(
      'SELECT id FROM machines WHERE serial_number = $1 AND id != $2',
      [serial_number, id]
    );
    if (existingCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A machine with this serial number already exists',
        field: 'serial_number',
      });
    }

    await client.query('BEGIN');

    // Fetch current machine to detect installation_date change
    const currentResult = await client.query('SELECT installation_date FROM machines WHERE id = $1', [id]);
    const oldDate = currentResult.rows[0]?.installation_date;
    const oldInstallationDate = oldDate ? new Date(oldDate).toISOString().split('T')[0] : null;
    const installationDateChanged = oldInstallationDate && oldInstallationDate !== installation_date;

    const result = await client.query(
      `UPDATE machines SET
        hospital_name=$1, township_id=$2, contact_person=$3, contact_phone=$4,
        installation_date=$5, brand_id=$6, model_id=$7, model=$8, machine_type_id=$9,
        serial_number=$10, technician_names=$11, service_fees=$12, transport_fees=$13,
        training_fees=$14, notes=$15, updated_at=NOW()
       WHERE id=$16
       RETURNING *`,
      [hospital_name, township_id, contact_person, contact_phone,
       installation_date, brand_id, model_id || null, model, machine_type_id,
       serial_number, technician_names || null,
       service_fees || 0, transport_fees || 0, training_fees || 0, notes || null, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }

    // Auto-regenerate PM schedules if installation date changed
    if (installationDateChanged) {
      const pmSchedule = calculatePMSchedule(installation_date);
      await client.query('DELETE FROM pm_schedules WHERE machine_id = $1', [id]);
      await client.query(
        `INSERT INTO pm_schedules (machine_id, pm_number, pm_date, window_start, window_end)
         VALUES ($1, 1, $2, $3, $4)`,
        [id, pmSchedule.pm1.pmDate, pmSchedule.pm1.windowStart, pmSchedule.pm1.windowEnd]
      );
      await client.query(
        `INSERT INTO pm_schedules (machine_id, pm_number, pm_date, window_start, window_end)
         VALUES ($1, 2, $2, $3, $4)`,
        [id, pmSchedule.pm2.pmDate, pmSchedule.pm2.windowStart, pmSchedule.pm2.windowEnd]
      );
    }

    // Update training dates: delete old, insert new
    await client.query('DELETE FROM training_dates WHERE machine_id = $1', [id]);
    const trainingDates = req.body.training_dates || [];
    for (let i = 0; i < trainingDates.length; i++) {
      if (trainingDates[i]) {
        await client.query(
          `INSERT INTO training_dates (machine_id, training_number, training_date)
           VALUES ($1, $2, $3)`,
          [id, i + 1, trainingDates[i]]
        );
      }
    }

    await client.query('COMMIT');

    logAction({
      userId: req.user?.id, username: req.user?.username,
      action: 'UPDATE', module: 'machine_registry', entityType: 'machine',
      entityId: id, entityLabel: `${serial_number} — ${hospital_name}`,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating machine:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/machines/:id
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const openTickets = await pool.query(
      "SELECT COUNT(*) FROM service_tickets WHERE machine_id = $1 AND status IN ('Open', 'Pending Job', 'In Progress')",
      [id]
    );
    if (parseInt(openTickets.rows[0].count, 10) > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete machine with open service tickets',
      });
    }

    // Get machine info before deleting for audit log
    const machineInfo = await pool.query('SELECT serial_number, hospital_name FROM machines WHERE id = $1', [id]);
    const result = await pool.query('DELETE FROM machines WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }

    const m = machineInfo.rows[0];
    logAction({
      userId: req.user?.id, username: req.user?.username,
      action: 'DELETE', module: 'machine_registry', entityType: 'machine',
      entityId: id, entityLabel: `${m.serial_number} — ${m.hospital_name}`,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Machine deleted successfully' });
  } catch (err) {
    console.error('Error deleting machine:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── Lookup Endpoints (Read-only) ─────────────────────────────

router.get('/lookups/townships', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM townships ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/lookups/brands', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM brands ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/lookups/types', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM machine_types ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/machines/lookups/models
 * Get models, optionally filtered by brand_id
 */
router.get('/lookups/models', async (req, res) => {
  try {
    const { brand_id } = req.query;
    let query = 'SELECT m.*, b.name AS brand_name FROM models m JOIN brands b ON m.brand_id = b.id';
    const params = [];

    if (brand_id) {
      query += ' WHERE m.brand_id = $1';
      params.push(brand_id);
    }

    query += ' ORDER BY b.name, m.name';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/lookups/engineers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM service_engineers WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── Training Dates Endpoints ─────────────────────────────────

/**
 * GET /api/machines/:id/training-dates
 */
router.get('/:id/training-dates', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM training_dates WHERE machine_id = $1 ORDER BY training_number',
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

// ══════════════════════════════════════════════════════════════
// Admin CRUD for Dropdown Lists
// ══════════════════════════════════════════════════════════════

const adminRouter = express.Router();
adminRouter.use(authenticate);

// Helper: generic CRUD for lookup tables
function createLookupRoutes(tableName, allowedFields) {
  const r = express.Router();

  r.get('/', async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM ${tableName} ORDER BY name`);
      res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error(`Error listing ${tableName}:`, err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  r.get('/:id', async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  r.post('/', async (req, res) => {
    try {
      const { name, region, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Name is required' });
      }
      let query, params;
      if (tableName === 'townships') {
        query = `INSERT INTO ${tableName} (name, region) VALUES ($1, $2) RETURNING *`;
        params = [name.trim(), region || null];
      } else if (tableName === 'machine_types') {
        query = `INSERT INTO ${tableName} (name, description) VALUES ($1, $2) RETURNING *`;
        params = [name.trim(), description || null];
      } else {
        query = `INSERT INTO ${tableName} (name) VALUES ($1) RETURNING *`;
        params = [name.trim()];
      }
      const result = await pool.query(query, params);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ success: false, message: `"${req.body.name}" already exists` });
      }
      console.error(`Error creating ${tableName}:`, err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  r.put('/:id', async (req, res) => {
    try {
      const { name, region, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Name is required' });
      }
      let query, params;
      if (tableName === 'townships') {
        query = `UPDATE ${tableName} SET name=$1, region=$2 WHERE id=$3 RETURNING *`;
        params = [name.trim(), region || null, req.params.id];
      } else if (tableName === 'machine_types') {
        query = `UPDATE ${tableName} SET name=$1, description=$2 WHERE id=$3 RETURNING *`;
        params = [name.trim(), description || null, req.params.id];
      } else {
        query = `UPDATE ${tableName} SET name=$1 WHERE id=$2 RETURNING *`;
        params = [name.trim(), req.params.id];
      }
      const result = await pool.query(query, params);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ success: false, message: `"${req.body.name}" already exists` });
      }
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  r.delete('/:id', async (req, res) => {
    try {
      const fkColumn = tableName === 'townships' ? 'township_id' :
                       tableName === 'brands' ? 'brand_id' : 'machine_type_id';
      const inUse = await pool.query(
        `SELECT COUNT(*) FROM machines WHERE ${fkColumn} = $1`,
        [req.params.id]
      );
      if (parseInt(inUse.rows[0].count, 10) > 0) {
        return res.status(409).json({
          success: false,
          message: `Cannot delete — ${inUse.rows[0].count} machine(s) use this entry`
        });
      }
      const result = await pool.query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING id`, [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
      res.json({ success: true, message: 'Deleted successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  return r;
}

adminRouter.use('/townships', createLookupRoutes('townships'));
adminRouter.use('/brands', createLookupRoutes('brands'));
adminRouter.use('/machine-types', createLookupRoutes('machine_types'));

// ── Models CRUD (linked to brands) ──────────────────────────

const modelsRouter = express.Router();

modelsRouter.get('/', async (req, res) => {
  try {
    const { brand_id } = req.query;
    let query = 'SELECT m.*, b.name AS brand_name FROM models m JOIN brands b ON m.brand_id = b.id';
    const params = [];
    if (brand_id) {
      query += ' WHERE m.brand_id = $1';
      params.push(brand_id);
    }
    query += ' ORDER BY b.name, m.name';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error listing models:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

modelsRouter.post('/', async (req, res) => {
  try {
    const { name, brand_id } = req.body;
    if (!name || !name.trim() || !brand_id) {
      return res.status(400).json({ success: false, message: 'Name and brand are required' });
    }
    const result = await pool.query(
      'INSERT INTO models (name, brand_id) VALUES ($1, $2) RETURNING *',
      [name.trim(), brand_id]
    );
    // Fetch with brand name
    const full = await pool.query(
      'SELECT m.*, b.name AS brand_name FROM models m JOIN brands b ON m.brand_id = b.id WHERE m.id = $1',
      [result.rows[0].id]
    );
    res.status(201).json({ success: true, data: full.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: `"${req.body.name}" already exists for this brand` });
    }
    console.error('Error creating model:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

modelsRouter.put('/:id', async (req, res) => {
  try {
    const { name, brand_id } = req.body;
    if (!name || !name.trim() || !brand_id) {
      return res.status(400).json({ success: false, message: 'Name and brand are required' });
    }
    const result = await pool.query(
      'UPDATE models SET name=$1, brand_id=$2 WHERE id=$3 RETURNING *',
      [name.trim(), brand_id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    const full = await pool.query(
      'SELECT m.*, b.name AS brand_name FROM models m JOIN brands b ON m.brand_id = b.id WHERE m.id = $1',
      [req.params.id]
    );
    res.json({ success: true, data: full.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: `"${req.body.name}" already exists for this brand` });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

modelsRouter.delete('/:id', async (req, res) => {
  try {
    const inUse = await pool.query('SELECT COUNT(*) FROM machines WHERE model_id = $1', [req.params.id]);
    if (parseInt(inUse.rows[0].count, 10) > 0) {
      return res.status(409).json({ success: false, message: `Cannot delete — ${inUse.rows[0].count} machine(s) use this model` });
    }
    const result = await pool.query('DELETE FROM models WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

adminRouter.use('/models', modelsRouter);

// ── Service Engineers CRUD ─────────────────────────────────

const engineersRouter = express.Router();

engineersRouter.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM service_engineers ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

engineersRouter.post('/', async (req, res) => {
  try {
    const { name, role } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const result = await pool.query(
      'INSERT INTO service_engineers (name, role) VALUES ($1, $2) RETURNING *',
      [name.trim(), role || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: `"${req.body.name}" already exists` });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

engineersRouter.put('/:id', async (req, res) => {
  try {
    const { name, role, is_active } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const result = await pool.query(
      'UPDATE service_engineers SET name=$1, role=$2, is_active=$3 WHERE id=$4 RETURNING *',
      [name.trim(), role || null, is_active !== false, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: `"${req.body.name}" already exists` });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

engineersRouter.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM service_engineers WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

adminRouter.use('/engineers', engineersRouter);

module.exports.adminRouter = adminRouter;
