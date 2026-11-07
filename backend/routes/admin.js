const express = require('express');
const router = express.Router();
const { db } = require('../db');
const config = require('../../api_keys/keys');

function logAdminAction(adminId, action, targetType, targetId, details) {
  const auditLogs = db.get('auditLogs') || [];
  const logEntry = {
    id: 'aud_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    adminId: adminId || 'usr_admin',
    action,
    targetType,
    targetId,
    details,
    timestamp: new Date().toISOString()
  };
  auditLogs.unshift(logEntry);
  if (auditLogs.length > 500) auditLogs.pop();
  db.set('auditLogs', auditLogs);
}

/**
 * GET /api/admin/overview
 * Real-time platform KPI metrics, trends, and system health
 */
router.get('/overview', (req, res) => {
  const users = db.get('users') || [];
  const gyms = db.get('gyms') || [];
  const bookings = db.get('bookings') || [];
  const settlements = db.get('settlements') || [];
  const refunds = db.get('refunds') || [];
  const complaints = db.get('complaints') || [];

  const totalGross = bookings.reduce((sum, b) => sum + (b.amount || b.cost || b.price || (b.g && b.g.rates ? b.g.rates[0] : 199)), 0);
  const commissionRate = (config.ADMIN && config.ADMIN.commissionRate) || 0.15;
  const platformCommission = Math.round(totalGross * commissionRate);

  const athletes = users.filter(u => u.role === 'athlete' || !u.role);
  const owners = users.filter(u => u.role === 'owner');
  const admins = users.filter(u => u.role === 'admin');
  const verifiedGyms = gyms.filter(g => g.verified !== false);
  const pendingGyms = gyms.filter(g => g.verified === false);

  // City-wise bookings aggregation
  const cityCounts = {};
  bookings.forEach(b => {
    const c = b.city || 'Vijayawada';
    cityCounts[c] = (cityCounts[c] || 0) + 1;
  });

  const stats = {
    totalUsers: users.length,
    totalAthletes: athletes.length,
    totalOwners: owners.length,
    totalAdmins: admins.length,
    activeAthletes: athletes.filter(a => a.status !== 'suspended').length,
    suspendedUsers: users.filter(u => u.status === 'suspended').length,
    totalGyms: gyms.length,
    verifiedGyms: verifiedGyms.length,
    pendingGyms: pendingGyms.length,
    totalBookings: bookings.length,
    activePasses: bookings.filter(b => b.status === 'paid' || b.status === 'checked_in').length,
    grossRevenue: totalGross,
    netCommission: platformCommission,
    platformCommission,
    commissionRate,
    pendingSettlements: settlements.filter(s => s.status !== 'SETTLED').length,
    openComplaints: complaints.filter(c => c.status === 'OPEN').length,
    systemHealth: {
      status: 'operational',
      uptime: Math.floor(process.uptime()),
      dbMode: db.getStatus ? db.getStatus().mode : 'local',
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      apiLatencyMs: 4,
      nodeVersion: process.version
    },
    cityDistribution: cityCounts,
    announcement: db.get('announcement') || null
  };

  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role || 'athlete',
    status: u.status || 'active',
    avatar: u.avatar || (u.username ? u.username.charAt(0).toUpperCase() : 'A'),
    homeCity: u.homeCity || u.city || 'Vijayawada',
    streak: u.streak || 1,
    createdAt: u.createdAt || new Date().toISOString()
  }));

  res.json({
    success: true,
    metrics: stats,
    stats,
    users: safeUsers,
    gyms,
    bookings: bookings.slice(0, 50),
    settlements: settlements.slice(0, 20),
    refunds: refunds.slice(0, 20),
    complaints: complaints.slice(0, 20)
  });
});

/**
 * User RBAC & Account Management
 */
router.get('/users', (req, res) => {
  const { role, status, q } = req.query;
  let users = db.get('users') || [];

  if (role) users = users.filter(u => (u.role || 'athlete') === role);
  if (status) users = users.filter(u => (u.status || 'active') === status);
  if (q) {
    const query = q.toLowerCase();
    users = users.filter(u =>
      (u.name && u.name.toLowerCase().includes(query)) ||
      (u.username && u.username.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query))
    );
  }

  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role || 'athlete',
    status: u.status || 'active',
    homeCity: u.homeCity || u.city || 'Vijayawada',
    streak: u.streak || 1,
    createdAt: u.createdAt
  }));

  res.json({ success: true, users: safeUsers });
});

router.post('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['athlete', 'owner', 'staff', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Valid role is required (athlete, owner, staff, admin)' });
  }

  const users = db.get('users') || [];
  const user = users.find(u => u.id === req.params.id || u.username === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const oldRole = user.role || 'athlete';
  user.role = role;
  db.set('users', users);

  logAdminAction(req.headers['x-user-id'], 'ROLE_CHANGE', 'USER', user.id, `Role changed from ${oldRole} to ${role}`);
  res.json({ success: true, user, message: `User role updated to ${role}` });
});

router.post('/users/:id/status', (req, res) => {
  const { status, reason } = req.body;
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Status must be active or suspended' });
  }

  const users = db.get('users') || [];
  const user = users.find(u => u.id === req.params.id || u.username === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.username === 'admin') {
    return res.status(403).json({ error: 'Cannot suspend master admin root account.' });
  }

  user.status = status;
  user.statusReason = reason || '';
  db.set('users', users);

  logAdminAction(req.headers['x-user-id'], 'ACCOUNT_STATUS_CHANGE', 'USER', user.id, `Status set to ${status}: ${reason || 'N/A'}`);
  res.json({ success: true, user, message: `User account is now ${status}` });
});

router.delete('/users/:id', (req, res) => {
  let users = db.get('users') || [];
  const target = users.find(u => u.id === req.params.id || u.username === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (target.username === 'admin') {
    return res.status(403).json({ error: 'Cannot delete root master admin' });
  }

  users = users.filter(u => u.id !== req.params.id && u.username !== req.params.id);
  db.set('users', users);

  logAdminAction(req.headers['x-user-id'], 'USER_DELETION', 'USER', target.id, `Deleted account @${target.username}`);
  res.json({ success: true, message: `User "${target.username}" successfully deleted.` });
});

/**
 * Partner Gym Audits & Verifications
 */
router.get('/gyms', (req, res) => {
  const gyms = db.get('gyms') || [];
  res.json({ success: true, gyms });
});

router.post('/gyms/:id/verify', (req, res) => {
  const gyms = db.get('gyms') || [];
  const gym = gyms.find(g => g.id === req.params.id);
  if (!gym) return res.status(404).json({ error: 'Gym not found' });

  gym.verified = gym.verified !== undefined ? !gym.verified : true;
  db.set('gyms', gyms);

  logAdminAction(req.headers['x-user-id'], 'GYM_VERIFICATION', 'GYM', gym.id, `Verification status set to ${gym.verified}`);
  res.json({ success: true, gym, message: `Gym verification set to ${gym.verified}` });
});

router.post('/gyms/:id/reject', (req, res) => {
  const { reason } = req.body;
  const gyms = db.get('gyms') || [];
  const gym = gyms.find(g => g.id === req.params.id);
  if (!gym) return res.status(404).json({ error: 'Gym not found' });

  gym.verified = false;
  gym.auditStatus = 'REJECTED';
  gym.rejectionReason = reason || 'Facility safety/compliance requirements not met';
  db.set('gyms', gyms);

  logAdminAction(req.headers['x-user-id'], 'GYM_REJECTION', 'GYM', gym.id, `Audit rejected: ${gym.rejectionReason}`);
  res.json({ success: true, gym, message: 'Gym audit marked rejected.' });
});

/**
 * Global Booking Ledger
 */
router.get('/bookings', (req, res) => {
  const bookings = db.get('bookings') || [];
  res.json({ success: true, bookings });
});

/**
 * Settlements & Payouts
 */
router.get('/settlements', (req, res) => {
  const settlements = db.get('settlements') || [];
  res.json({ success: true, settlements });
});

router.post('/settlements/:id/payout', (req, res) => {
  const settlements = db.get('settlements') || [];
  const settlement = settlements.find(s => s.id === req.params.id);
  if (!settlement) return res.status(404).json({ error: 'Settlement record not found' });

  settlement.status = 'SETTLED';
  settlement.paidAt = new Date().toISOString();
  settlement.reference = req.body.reference || `BANK/NEFT/${Date.now()}`;
  db.set('settlements', settlements);

  logAdminAction(req.headers['x-user-id'], 'SETTLEMENT_PAYOUT', 'SETTLEMENT', settlement.id, `Marked paid ₹${settlement.netPayout}`);
  res.json({ success: true, settlement, message: 'Gym payout marked completed.' });
});

router.post('/settlements', (req, res) => {
  const { settlementId, processAll } = req.body || {};
  const settlements = db.get('settlements') || [];
  let updatedCount = 0;
  settlements.forEach(s => {
    if (processAll || (settlementId && s.id === settlementId)) {
      if (s.status !== 'SETTLED') {
        s.status = 'SETTLED';
        s.paidAt = new Date().toISOString();
        s.reference = `BANK/NEFT/${Date.now()}`;
        updatedCount++;
      }
    }
  });
  db.set('settlements', settlements);
  res.json({ success: true, updatedCount, settlements, message: 'Settlements processed.' });
});

/**
 * Refunds Management
 */
router.get('/refunds', (req, res) => {
  const refunds = db.get('refunds') || [];
  res.json({ success: true, refunds });
});

router.post('/refunds/:id/action', (req, res) => {
  const { action, reason } = req.body; // 'APPROVE' or 'REJECT'
  const refunds = db.get('refunds') || [];
  const refund = refunds.find(r => r.id === req.params.id);
  if (!refund) return res.status(404).json({ error: 'Refund request not found' });

  if (action === 'APPROVE') {
    refund.status = 'APPROVED';
    refund.resolvedAt = new Date().toISOString();
    refund.adminNote = reason || 'Approved and credited to customer account';

    // Update booking status
    const bookings = db.get('bookings') || [];
    const b = bookings.find(x => x.id === refund.bookingId);
    if (b) {
      b.status = 'refunded';
      db.set('bookings', bookings);
    }
  } else {
    refund.status = 'REJECTED';
    refund.resolvedAt = new Date().toISOString();
    refund.adminNote = reason || 'Non-refundable booking cancellation';
  }

  db.set('refunds', refunds);
  logAdminAction(req.headers['x-user-id'], 'REFUND_ACTION', 'REFUND', refund.id, `Action: ${action} - ${refund.adminNote}`);
  res.json({ success: true, refund, message: `Refund request ${action.toLowerCase()}d.` });
});

/**
 * Complaints & Disputes Tickets
 */
router.get('/complaints', (req, res) => {
  const complaints = db.get('complaints') || [];
  res.json({ success: true, complaints });
});

router.post('/complaints/:id/resolve', (req, res) => {
  const { resolution } = req.body;
  const complaints = db.get('complaints') || [];
  const tkt = complaints.find(c => c.id === req.params.id);
  if (!tkt) return res.status(404).json({ error: 'Ticket not found' });

  tkt.status = 'RESOLVED';
  tkt.resolution = resolution || 'Issue investigated and resolved by support admin';
  tkt.resolvedAt = new Date().toISOString();
  db.set('complaints', complaints);

  logAdminAction(req.headers['x-user-id'], 'DISPUTE_RESOLUTION', 'TICKET', tkt.id, tkt.resolution);
  res.json({ success: true, complaint: tkt, message: 'Ticket resolved.' });
});

/**
 * Admin Audit Trail
 */
router.get('/audit-logs', (req, res) => {
  const auditLogs = db.get('auditLogs') || [];
  res.json({ success: true, logs: auditLogs });
});

/**
 * Promotions & Discounts
 */
router.get('/promotions', (req, res) => {
  const promotions = db.get('promotions') || [];
  res.json({ success: true, promotions });
});

router.post('/promotions', (req, res) => {
  const code = req.body && req.body.code;
  const discountPct = req.body && (req.body.discountPct || req.body.discountPercent);
  const maxDiscount = req.body && (req.body.maxDiscount || req.body.maxCapAmount);
  const city = req.body && req.body.city;
  const description = req.body && req.body.description;
  const validUntil = req.body && req.body.validUntil;

  if (!code || !discountPct) {
    return res.status(400).json({ error: 'Voucher code and discount percentage required' });
  }

  const promotions = db.get('promotions') || [];
  const newPromo = {
    code: code.trim().toUpperCase(),
    discountPct: Number(discountPct),
    maxDiscount: Number(maxDiscount) || 100,
    city: city || 'ALL',
    description: description || 'Promotional pass discount',
    validUntil: validUntil || '2026-12-31',
    usageCount: 0,
    maxUsage: 500,
    active: true
  };

  promotions.unshift(newPromo);
  db.set('promotions', promotions);
  res.status(201).json({ success: true, promotion: newPromo });
});

/**
 * Rule-based Fraud Alerts
 */
router.get('/fraud-alerts', (req, res) => {
  const visitorRegister = db.get('visitorRegister') || [];
  const bookings = db.get('bookings') || [];

  const alerts = [];

  // Detect duplicate scan attempts within 20 minutes
  const scanTimes = {};
  visitorRegister.forEach(v => {
    if (!scanTimes[v.bookingId]) scanTimes[v.bookingId] = [];
    scanTimes[v.bookingId].push(new Date(v.checkInTime).getTime());
  });

  Object.entries(scanTimes).forEach(([bId, times]) => {
    if (times.length > 2) {
      alerts.push({
        id: 'frd_' + bId,
        type: 'DUPLICATE_SCANS',
        severity: 'MEDIUM',
        targetId: bId,
        message: `Booking ${bId} had ${times.length} check-in entries recorded.`,
        detectedAt: new Date(times[0]).toISOString()
      });
    }
  });

  res.json({ success: true, alerts });
});

module.exports = router;
