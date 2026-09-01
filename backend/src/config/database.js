/**
 * Database Configuration
 * Connects to PostgreSQL if available, falls back to in-memory mock for development
 */

const { Pool } = require('pg');
require('dotenv').config();

let pool = null;
let useMock = false;

// ── In-memory mock data for development without PostgreSQL ─────
const mockData = {
  users: [
    { id: '1', username: 'admin', password_hash: '$2a$10$placeholder', display_name: 'Main Administrator', role: 'main_admin', is_active: true, created_at: new Date().toISOString() },
    { id: '2', username: 'technician', password_hash: '$2a$10$placeholder', display_name: 'Demo Technician', role: 'co_admin', is_active: true, created_at: new Date().toISOString() },
  ],
  townships: [
    { id: '1', name: 'Yangon (Downtown)', region: 'Yangon' },
    { id: '2', name: 'Yangon (South)', region: 'Yangon' },
    { id: '3', name: 'Yangon (North)', region: 'Yangon' },
    { id: '4', name: 'Mandalay', region: 'Mandalay' },
    { id: '5', name: 'Bago', region: 'Bago' },
  ],
  brands: [
    { id: '1', name: 'Mindray' },
    { id: '2', name: 'GE Healthcare' },
    { id: '3', name: 'Siemens' },
    { id: '4', name: 'Philips' },
    { id: '5', name: 'Fujifilm' },
  ],
  machine_types: [
    { id: '1', name: 'X-Ray', description: 'X-Ray Imaging System' },
    { id: '2', name: 'CT Scanner', description: 'Computed Tomography' },
    { id: '3', name: 'Ultrasound', description: 'Ultrasound Imaging' },
    { id: '4', name: 'MRI', description: 'Magnetic Resonance Imaging' },
    { id: '5', name: 'Endoscopy', description: 'Endoscopy System' },
  ],
  models: [
    { id: '1', brand_id: '1', name: 'DC-70' },
    { id: '2', brand_id: '1', name: 'Resona 7' },
    { id: '3', brand_id: '2', name: 'Logiq E9' },
    { id: '4', brand_id: '3', name: 'Acuson S2000' },
    { id: '5', brand_id: '4', name: 'EPIQ 7' },
    { id: '6', brand_id: '5', name: 'ELUXEO 7000' },
  ],
  machines: [],
  pm_schedules: [],
  service_tickets: [],
  training_dates: [],
  permissions: [],
  _counters: { machine: 100, ticket: 1000, pm: 100, training: 100, perm: 100 },
};

// ── Try to connect to PostgreSQL ──────────────────────────────
async function initDatabase() {
  try {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password123',
      database: process.env.DB_NAME || 'service_db',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    });

    pool.on('error', (err) => {
      console.error('⚠️  PostgreSQL pool error:', err.message);
    });

    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Connected to PostgreSQL at:', result.rows[0].current_time);
    client.release();
    useMock = false;
    return true;
  } catch (err) {
    console.warn('⚠️  PostgreSQL not available:', err.message);
    console.warn('🔄 Running in DEMO MODE with in-memory data');
    console.warn('   Data will reset when the server restarts.\n');
    pool = null;
    useMock = true;
    return false;
  }
}

// ── Mock query helper ─────────────────────────────────────────
function mockQuery(sql, params = []) {
  const normalized = sql.trim().replace(/\s+/g, ' ').toLowerCase();

  // SELECT NOW()
  if (normalized.includes('select now()')) {
    return { rows: [{ current_time: new Date().toISOString() }], rowCount: 1 };
  }

  // COUNT(*) queries — return mock count
  if (normalized.includes('select count(*)') || normalized.includes('select count(1)')) {
    // Figure out the table
    const fromMatch = normalized.match(/from (\w+)/);
    const table = fromMatch ? fromMatch[1] : '';
    const count = mockData[table] ? mockData[table].length : 0;
    return { rows: [{ count: String(count) }], rowCount: 1 };
  }

  // Authentication: SELECT ... FROM users WHERE username = $1
  if (normalized.includes('from users where username')) {
    const username = params[0];
    const user = mockData.users.find(u => u.username === username && u.is_active);
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }

  // SELECT ... FROM users WHERE id = $1
  if (normalized.includes('from users where id') && !normalized.includes('and')) {
    const id = String(params[0]);
    const user = mockData.users.find(u => String(u.id) === id);
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }

  // SELECT all users
  if (normalized.includes('select') && normalized.includes('from users') && !normalized.includes('where')) {
    return { rows: mockData.users.map(u => ({ ...u, password_hash: undefined })), rowCount: mockData.users.length };
  }

  // SELECT permissions WHERE user_id
  if (normalized.includes('from permissions where user_id')) {
    const userId = String(params[0]);
    const perms = mockData.permissions.filter(p => String(p.user_id) === userId);
    return { rows: perms, rowCount: perms.length };
  }

  // Lookups — simple SELECT * FROM table
  for (const table of ['townships', 'brands', 'machine_types', 'models']) {
    if (normalized.includes(`from ${table}`) && !normalized.includes('join')) {
      let rows = mockData[table] || [];
      if (normalized.includes('where brand_id') && params[0]) {
        rows = rows.filter(r => String(r.brand_id) === String(params[0]));
      }
      return { rows, rowCount: rows.length };
    }
  }

  // Models with JOIN on brands
  if (normalized.includes('from models') && normalized.includes('join brands')) {
    let rows = mockData.models.map(m => {
      const brand = mockData.brands.find(b => String(b.id) === String(m.brand_id));
      return { ...m, brand_name: brand?.name || '' };
    });
    if (normalized.includes('where') && normalized.includes('brand_id') && params[0]) {
      rows = rows.filter(r => String(r.brand_id) === String(params[0]));
    }
    return { rows, rowCount: rows.length };
  }

  // Machines with JOINs (the main listing query)
  if (normalized.includes('from machines m') || (normalized.includes('from machines') && normalized.includes('join'))) {
    let result = mockData.machines.map(m => {
      const township = mockData.townships.find(t => String(t.id) === String(m.township_id));
      const brand = mockData.brands.find(b => String(b.id) === String(m.brand_id));
      const model = mockData.models.find(mo => String(mo.id) === String(m.model_id));
      const type = mockData.machine_types.find(t => String(t.id) === String(m.machine_type_id));
      return {
        ...m,
        township_name: township?.name || '',
        township_region: township?.region || '',
        brand_name: brand?.name || '',
        model_name: model?.name || m.model || '',
        machine_type_name: type?.name || '',
        type_name: type?.name || '',
        type_description: type?.description || '',
      };
    });

    // Search filter
    if (normalized.includes('ilike')) {
      const term = String(params[0] || '').replace(/%/g, '').toLowerCase();
      if (term) {
        result = result.filter(m =>
          (m.serial_number || '').toLowerCase().includes(term) ||
          (m.hospital_name || '').toLowerCase().includes(term) ||
          (m.model || '').toLowerCase().includes(term)
        );
      }
    }

    // Single machine by ID
    if (normalized.includes('where m.id = $1') || normalized.includes('where m.id=$1')) {
      const id = String(params[0]);
      const machine = result.find(m => String(m.id) === id);
      return { rows: machine ? [machine] : [], rowCount: machine ? 1 : 0 };
    }

    // Pagination
    if (normalized.includes('limit')) {
      const limitIdx = params.length - 2;
      const offsetIdx = params.length - 1;
      const limit = parseInt(params[limitIdx]) || 20;
      const offset = parseInt(params[offsetIdx]) || 0;
      return { rows: result.slice(offset, offset + limit), rowCount: result.length };
    }

    return { rows: result, rowCount: result.length };
  }

  // PM Schedules with JOINs
  if (normalized.includes('from pm_schedules') && normalized.includes('join')) {
    let result = mockData.pm_schedules.map(ps => {
      const machine = mockData.machines.find(m => String(m.id) === String(ps.machine_id));
      const township = machine ? mockData.townships.find(t => String(t.id) === String(machine.township_id)) : null;
      const brand = machine ? mockData.brands.find(b => String(b.id) === String(machine.brand_id)) : null;
      const type = machine ? mockData.machine_types.find(t => String(t.id) === String(machine.machine_type_id)) : null;
      return {
        ...ps,
        serial_number: machine?.serial_number || '',
        hospital_name: machine?.hospital_name || '',
        model: machine?.model || '',
        contact_person: machine?.contact_person || '',
        contact_phone: machine?.contact_phone || '',
        township_name: township?.name || '',
        brand_name: brand?.name || '',
        machine_type_name: type?.name || '',
      };
    });
    return { rows: result, rowCount: result.length };
  }

  // PM Schedules simple query
  if (normalized.includes('from pm_schedules')) {
    let rows = [...mockData.pm_schedules];
    if (normalized.includes('where machine_id')) {
      rows = rows.filter(r => String(r.machine_id) === String(params[0]));
    }
    if (normalized.includes('where status')) {
      rows = rows.filter(r => params.includes(r.status));
    }
    return { rows, rowCount: rows.length };
  }

  // Service Tickets simple query
  if (normalized.includes('from service_tickets')) {
    let rows = [...mockData.service_tickets];
    if (normalized.includes('where machine_id')) {
      rows = rows.filter(r => String(r.machine_id) === String(params[0]));
    }
    if (normalized.includes('where')) {
      // Handle single ID lookups
      if (normalized.includes('where id')) {
        const id = String(params[0]);
        rows = rows.filter(r => String(r.id) === id);
      }
    }
    return { rows, rowCount: rows.length };
  }

  // Training dates
  if (normalized.includes('from training_dates')) {
    let rows = [...mockData.training_dates];
    if (normalized.includes('where machine_id')) {
      rows = rows.filter(r => String(r.machine_id) === String(params[0]));
    }
    return { rows, rowCount: rows.length };
  }

  // INSERT INTO users
  if (normalized.includes('insert into users')) {
    const cols = extractInsertColumns(sql);
    const obj = {};
    cols.forEach((col, i) => { obj[col] = params[i]; });
    if (!obj.id) obj.id = String(mockData.users.length + 1);
    obj.is_active = obj.is_active !== undefined ? obj.is_active : true;
    obj.created_at = new Date().toISOString();
    mockData.users.push(obj);
    return { rows: [obj], rowCount: 1 };
  }

  // INSERT INTO permissions
  if (normalized.includes('insert into permissions')) {
    const cols = extractInsertColumns(sql);
    const obj = {};
    cols.forEach((col, i) => { obj[col] = params[i]; });
    obj.id = String(++mockData._counters.perm);
    mockData.permissions.push(obj);
    return { rows: [obj], rowCount: 1 };
  }

  // INSERT INTO machines
  if (normalized.includes('insert into machines')) {
    const cols = extractInsertColumns(sql);
    const obj = {};
    cols.forEach((col, i) => { obj[col] = params[i]; });
    obj.id = String(++mockData._counters.machine);
    obj.created_at = new Date().toISOString();
    obj.updated_at = new Date().toISOString();
    mockData.machines.push(obj);
    return { rows: [obj], rowCount: 1 };
  }

  // INSERT INTO pm_schedules
  if (normalized.includes('insert into pm_schedules')) {
    const cols = extractInsertColumns(sql);
    const obj = {};
    cols.forEach((col, i) => { obj[col] = params[i]; });
    obj.id = String(++mockData._counters.pm);
    obj.status = obj.status || 'Scheduled';
    obj.completed_date = null;
    obj.completed_by = null;
    obj.notes = null;
    obj.created_at = new Date().toISOString();
    obj.updated_at = new Date().toISOString();
    mockData.pm_schedules.push(obj);
    return { rows: [obj], rowCount: 1 };
  }

  // INSERT INTO training_dates
  if (normalized.includes('insert into training_dates')) {
    const cols = extractInsertColumns(sql);
    const obj = {};
    cols.forEach((col, i) => { obj[col] = params[i]; });
    obj.id = String(++mockData._counters.training);
    obj.created_at = new Date().toISOString();
    mockData.training_dates.push(obj);
    return { rows: [obj], rowCount: 1 };
  }

  // INSERT INTO service_tickets
  if (normalized.includes('insert into service_tickets')) {
    const cols = extractInsertColumns(sql);
    const obj = {};
    cols.forEach((col, i) => { obj[col] = params[i]; });
    obj.id = String(++mockData._counters.ticket);
    obj.created_at = new Date().toISOString();
    obj.updated_at = new Date().toISOString();
    mockData.service_tickets.push(obj);
    return { rows: [obj], rowCount: 1 };
  }

  // INSERT with ON CONFLICT DO UPDATE (permissions upsert)
  if (normalized.includes('on conflict') && normalized.includes('do update')) {
    const cols = extractInsertColumns(sql);
    const obj = {};
    cols.forEach((col, i) => { obj[col] = params[i]; });

    const tableMatch = normalized.match(/insert into (\w+)/);
    const table = tableMatch ? tableMatch[1] : '';

    if (mockData[table]) {
      const firstCol = cols[0];
      const existingIdx = mockData[table].findIndex(item => String(item[firstCol]) === String(obj[firstCol]));
      if (existingIdx >= 0) {
        Object.assign(mockData[table][existingIdx], obj);
        return { rows: [mockData[table][existingIdx]], rowCount: 1 };
      } else {
        if (!obj.id) obj.id = String(mockData[table].length + 1);
        mockData[table].push(obj);
        return { rows: [obj], rowCount: 1 };
      }
    }
    return { rows: [obj], rowCount: 1 };
  }

  // Generic INSERT
  if (normalized.includes('insert into')) {
    const tableMatch = normalized.match(/insert into (\w+)/);
    const table = tableMatch ? tableMatch[1] : '';
    const cols = extractInsertColumns(sql);
    const obj = {};
    cols.forEach((col, i) => { obj[col] = params[i]; });
    if (mockData[table]) {
      if (!obj.id) obj.id = String(mockData[table].length + 1);
      mockData[table].push(obj);
    }
    return { rows: [obj], rowCount: 1 };
  }

  // DELETE
  if (normalized.includes('delete from')) {
    const tableMatch = normalized.match(/delete from (\w+)/);
    const table = tableMatch ? tableMatch[1] : '';
    if (mockData[table]) {
      const before = mockData[table].length;
      if (normalized.includes('where machine_id') && params[0]) {
        mockData[table] = mockData[table].filter(item => String(item.machine_id) !== String(params[0]));
      } else if (normalized.includes('where id') && params[0]) {
        const id = String(params[0]);
        mockData[table] = mockData[table].filter(item => String(item.id) !== id);
      }
      return { rows: [], rowCount: before - mockData[table].length };
    }
    return { rows: [], rowCount: 0 };
  }

  // UPDATE with RETURNING
  if (normalized.includes('update') && normalized.includes('set')) {
    const tableMatch = normalized.match(/update (\w+)/);
    const table = tableMatch ? tableMatch[1] : '';
    if (mockData[table]) {
      // Find the WHERE clause
      const whereMatch = normalized.match(/where (\w+)\s*=\s*\$(\d+)/);
      if (whereMatch) {
        const whereCol = whereMatch[1];
        const paramIdx = parseInt(whereMatch[2]) - 1;
        const id = String(params[paramIdx]);
        const item = mockData[table].find(i => String(i[whereCol]) === id);
        if (item) {
          // Parse SET from sql
          const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/is);
          if (setMatch) {
            const setParts = setMatch[1].split(',').map(s => s.trim());
            let pIdx = 0;
            setParts.forEach(part => {
              const colMatch = part.match(/(\w+)\s*=/);
              if (colMatch && pIdx < params.length - 1) {
                // Skip params used in WHERE
                if (pIdx < paramIdx) {
                  item[colMatch[1]] = params[pIdx];
                }
              }
              pIdx++;
            });
            // Actually, let's just use positional params correctly
            // The SET params come first, then WHERE params
            const setParamCount = params.length - 1; // minus WHERE param
            const setCols = setParts.map(p => {
              const m = p.match(/(\w+)\s*=/);
              return m ? m[1] : null;
            }).filter(Boolean);
            setCols.forEach((col, i) => {
              if (i < setParamCount) {
                item[col] = params[i];
              }
            });
          }
          item.updated_at = new Date().toISOString();
          if (normalized.includes('returning')) {
            return { rows: [item], rowCount: 1 };
          }
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
    }
    return { rows: [], rowCount: 0 };
  }

  // BEGIN / COMMIT / ROLLBACK — no-ops
  if (normalized === 'begin' || normalized === 'commit' || normalized === 'rollback') {
    return { rows: [], rowCount: 0 };
  }

  // Default: return empty
  console.log('  [mock] Unhandled query:', normalized.substring(0, 100));
  return { rows: [], rowCount: 0 };
}

function extractInsertColumns(sql) {
  const match = sql.match(/\(([^)]+)\)\s*VALUES/i);
  if (match) {
    return match[1].split(',').map(c => c.trim().replace(/"/g, ''));
  }
  return [];
}

// ── Mock pool that mimics pg Pool interface ───────────────────
const mockPool = {
  query: (sql, params) => Promise.resolve(mockQuery(sql, params)),
  connect: () => Promise.resolve({
    query: (sql, params) => Promise.resolve(mockQuery(sql, params)),
    release: () => {},
    begin: () => Promise.resolve(),
    commit: () => Promise.resolve(),
    rollback: () => Promise.resolve(),
  }),
  end: () => Promise.resolve(),
  on: () => {},
};

// ── Initialize on load ────────────────────────────────────────
initDatabase();

// ── Export ────────────────────────────────────────────────────
module.exports = {
  query: (sql, params) => {
    if (useMock || !pool) return Promise.resolve(mockQuery(sql, params));
    return pool.query(sql, params);
  },
  connect: () => {
    if (useMock || !pool) return mockPool.connect();
    return pool.connect();
  },
  end: () => {
    if (pool) return pool.end();
    return Promise.resolve();
  },
  isMock: () => useMock,
};
