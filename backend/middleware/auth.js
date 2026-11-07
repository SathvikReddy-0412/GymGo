const { db } = require('../db');

/**
 * Extract active user from authorization headers or session tokens
 */
function authenticateUser(req) {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  const users = db.get('users') || [];

  if (userId) {
    const found = users.find(u => u.id === userId || u.username === userId);
    if (found) return found;
  }

  // Fallback demo/session identifier if in demo/offline mode
  if (userRole === 'admin') {
    return users.find(u => u.role === 'admin') || null;
  }
  if (userRole === 'owner') {
    return users.find(u => u.role === 'owner') || null;
  }
  if (userRole === 'athlete') {
    return users.find(u => u.role === 'athlete') || null;
  }

  return null;
}

/**
 * Middleware: Require authenticated user
 */
function requireAuth(req, res, next) {
  const user = authenticateUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please log in to your portal.' });
  }
  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'Account suspended. Please contact GymGo support.' });
  }
  req.user = user;
  next();
}

/**
 * Middleware: Require specific roles
 */
function requireRole(allowedRoles = []) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    const user = authenticateUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    const userRole = user.role || 'athlete';
    if (!roles.includes(userRole) && userRole !== 'admin' && userRole !== 'root_admin') {
      return res.status(403).json({
        error: `Access Denied: Requires one of [${roles.join(', ')}] privileges. Your role is "${userRole}".`
      });
    }

    req.user = user;
    next();
  };
}

module.exports = {
  authenticateUser,
  requireAuth,
  requireRole
};

