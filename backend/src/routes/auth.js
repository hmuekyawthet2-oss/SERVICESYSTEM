/**
 * Authentication Routes
 * Login, register, profile management
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate, requireRole, JWT_SECRET } = require('../middleware/auth');

/**
 * Helper: Parse User-Agent string into device type, browser, and OS
 */
function parseUserAgent(ua) {
  if (!ua) return { device_type: 'Unknown', browser: 'Unknown', os: 'Unknown' };

  // Device type
  let device_type = 'Desktop';
  if (/mobile|android|iphone|ipod/i.test(ua)) device_type = 'Mobile';
  else if (/tablet|ipad/i.test(ua)) device_type = 'Tablet';

  // Browser
  let browser = 'Unknown';
  if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edg/i.test(ua)) browser = 'Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';
  else if (/msie|trident/i.test(ua)) browser = 'Internet Explorer';

  // OS
  let os = 'Unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';

  return { device_type, browser, os };
}

/**
 * Helper: Log a login attempt to the login_logs table
 */
async function logLogin({ userId, username, status, ipAddress, userAgent }) {
  try {
    const { device_type, browser, os } = parseUserAgent(userAgent);
    await pool.query(
      `INSERT INTO login_logs (user_id, username, status, ip_address, user_agent, device_type, browser, os)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId || null, username || null, status, ipAddress || null, userAgent || null, device_type, browser, os]
    );
  } catch (err) {
    console.error('Failed to write login log:', err.message);
  }
}

/**
 * Helper: Extract client IP from request, handling proxies
 */
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs: client, proxy1, proxy2
    return forwarded.split(',')[0].trim();
  }
  const realIP = req.headers['x-real-ip'];
  if (realIP) return realIP;
  const raw = req.socket?.remoteAddress || '';
  // Normalize IPv6-mapped IPv4 (e.g. ::ffff:127.0.0.1 → 127.0.0.1)
  return raw.replace(/^::ffff:/, '');
}

// Mock passwords for demo mode (when PostgreSQL is not available)
const MOCK_PASSWORDS = {
  admin: 'admin123',
  technician: 'tech123',
};

const router = express.Router();

/**
 * POST /api/auth/login
 * Login with username and password, returns JWT
 */
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array().map(e => ({ field: e.path, message: e.msg })) });
  }

  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT id, username, password_hash, display_name, role, is_active FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      // Log failed login attempt (unknown user)
      await logLogin({
        userId: null,
        username,
        status: 'failed',
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null,
      });
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    // In mock mode, check against hardcoded passwords
    let validPassword = false;
    if (pool.isMock && pool.isMock()) {
      validPassword = MOCK_PASSWORDS[username] === password;
    } else {
      try {
        validPassword = await bcrypt.compare(password, user.password_hash);
      } catch (bcryptErr) {
        // Invalid hash format in database — password was not properly seeded
        console.error('bcrypt error — run: node src/config/seed.js');
        return res.status(500).json({
          success: false,
          message: 'Password system not initialized. Please run: node src/config/seed.js',
        });
      }
    }
    if (!validPassword) {
      // Log failed login attempt (wrong password)
      await logLogin({
        userId: user.id,
        username,
        status: 'failed',
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null,
      });
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, display_name: user.display_name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Fetch user permissions
    const permResult = await pool.query(
      'SELECT tab, field, granted FROM permissions WHERE user_id = $1',
      [user.id]
    );

    // Log successful login
    await logLogin({
      userId: user.id,
      username: user.username,
      status: 'success',
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'] || null,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          role: user.role,
        },
        permissions: permResult.rows,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/auth/register
 * Create a new co_admin user (main_admin only)
 */
router.post('/register', authenticate, requireRole('main_admin'), [
  body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('display_name').trim().notEmpty().withMessage('Display name is required'),
  body('role').isIn(['main_admin', 'co_admin']).withMessage('Role must be main_admin or co_admin'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array().map(e => ({ field: e.path, message: e.msg })) });
  }

  try {
    const { username, password, display_name, role } = req.body;

    // Check uniqueness
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, display_name, role, is_active, created_at`,
      [username, passwordHash, display_name, role]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile with permissions
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, display_name, role, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const permResult = await pool.query(
      'SELECT tab, field, granted FROM permissions WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        permissions: permResult.rows,
      },
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * PUT /api/auth/password
 * Change own password
 */
router.put('/password', authenticate, [
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array().map(e => ({ field: e.path, message: e.msg })) });
  }

  try {
    const { current_password, new_password } = req.body;

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];

    let validPassword = false;
    if (pool.isMock && pool.isMock()) {
      validPassword = MOCK_PASSWORDS[req.user.username] === current_password;
    } else {
      validPassword = await bcrypt.compare(current_password, user.password_hash);
    }
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(new_password, salt);

    if (!(pool.isMock && pool.isMock())) {
      await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, req.user.id]);
    }
    // Update mock passwords too
    MOCK_PASSWORDS[req.user.username] = new_password;

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/auth/users
 * List all users (main_admin only)
 */
router.get('/users', authenticate, requireRole('main_admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, display_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * PUT /api/auth/users/:id/toggle
 * Toggle user active status (main_admin only)
 */
router.put('/users/:id/toggle', authenticate, requireRole('main_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Cannot deactivate yourself
    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
    }

    const result = await pool.query(
      `UPDATE users SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1
       RETURNING id, username, display_name, role, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Toggle user error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/auth/users/:id/force-logout
 * Force logout a user by blacklisting their active tokens (main_admin only)
 */
router.post('/users/:id/force-logout', authenticate, requireRole('main_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot force logout yourself' });
    }

    // Blacklist all future tokens for this user by marking a forced logout timestamp
    // We store a special entry that the auth middleware checks
    try {
      const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Insert a blacklist entry that forces re-authentication
      // We use a far-future expiration and a wildcard jti
      await pool.query(
        `INSERT INTO token_blacklist (token_jti, user_id, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '7 days')
         ON CONFLICT (token_jti) DO NOTHING`,
        [`force-logout-${id}`, id]
      );

      // Also reset their password hash to invalidate all existing tokens
      // This is the strongest form of force logout
      const tempHash = await bcrypt.hash('force-reset-' + Date.now(), 10);
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [tempHash, id]
      );

      res.json({ success: true, message: 'User has been force-logged out. Their password has been reset.' });
    } catch (tableErr) {
      // If blacklist table doesn't exist, just reset password
      console.warn('Blacklist table not available, resetting password only');
      const tempHash = await bcrypt.hash('force-reset-' + Date.now(), 10);
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [tempHash, id]
      );
      res.json({ success: true, message: 'User has been force-logged out. Their password has been reset.' });
    }
  } catch (err) {
    console.error('Force logout error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
