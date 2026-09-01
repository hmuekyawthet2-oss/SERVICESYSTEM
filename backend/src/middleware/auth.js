/**
 * Authentication Middleware
 * JWT-based auth with role checking and token blacklist support
 */

const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'medical-equipment-service-secret-key-2026';

/**
 * Authenticate request via Bearer token
 * Checks token blacklist before accepting
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if token is blacklisted (force-logged out)
    try {
      const blacklisted = await pool.query(
        'SELECT id FROM token_blacklist WHERE token_jti = $1',
        [decoded.jti || decoded.id || '']
      );
      if (blacklisted.rows && blacklisted.rows.length > 0) {
        return res.status(401).json({ success: false, message: 'Session has been terminated' });
      }
    } catch {
      // If blacklist table doesn't exist yet, just skip check
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

/**
 * Require specific role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole, JWT_SECRET };
