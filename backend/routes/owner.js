const express = require('express');
const router = express.Router();
const { db } = require('../db');
const config = require('../../api_keys/keys');

function getOwnerGym(userId, req) {
  const gyms = db.get('gyms') || [];
  const users = db.get('users') || [];
  const user = users.find(u => u.id === userId || u.username === userId) || { gymName: 'Starts Gym' };

  let gym = gyms.find(g => g.name === user.gymName || (g.city === user.city && g.area === user.area));
  if (!gym) gym = gyms[0]; // fallback default partner gym
  return gym;
}

/**
 * GET /api/owner/overview
 * Real-time business KPIs calculated from database
 */
router.get('/overview', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_owner';
  const gym = getOwnerGym(userId, req);
  const bookings = db.get('bookings') || [];
  const visitorRegister = db.get('visitorRegister') || [];
  const schedules = db.get('gymSchedules') || {};
  const todayStr = new Date().toISOString().split('T')[0];

  const gymBookings = bookings.filter(b => b.gymId === gym.id || b.gymName === gym.name);
  const todayVisitors = visitorRegister.filter(v => (v.gymId === gym.id || v.gymName === gym.name) && v.checkInTime.startsWith(todayStr));
  
  const pendingRequests = gymBookings.filter(b => b.status === 'pending');
  const confirmedBookings = gymBookings.filter(b => b.status === 'accepted' || b.status === 'slots' || b.status === 'paid' || b.status === 'checked_in');
  const activePasses = gymBookings.filter(b => (b.status === 'paid' || b.status === 'checked_in') && (!b.endDate || b.endDate >= todayStr));

  const totalGross = gymBookings.filter(b => b.status === 'paid' || b.status === 'checked_in')
    .reduce((sum, b) => sum + (b.amount || 0), 0);
  
  const commissionRate = (config.ADMIN && config.ADMIN.commissionRate) || 0.15;
  const platformCommission = Math.round(totalGross * commissionRate);
  const netEarnings = totalGross - platformCommission;

  const gymSchedule = schedules[gym.id] || {
    currentOccupancy: 14,
    maxCapacity: 60,
    slots: (gym.slots || []).map(s => ({ time: s, maxCapacity: 25, bookedCapacity: 10, open: true }))
  };

  res.json({
    success: true,
    gym: {
      id: gym.id,
      name: gym.name,
      city: gym.city,
      area: gym.area,
      rating: gym.rating || 4.8,
      reviewsCount: gym.reviews || 248,
      verified: gym.verified !== false
    },
    metrics: {
      todayVisitorsCount: todayVisitors.length,
      pendingRequestsCount: pendingRequests.length,
      confirmedBookingsCount: confirmedBookings.length,
      activePassesCount: activePasses.length,
      grossRevenue: totalGross,
      platformCommission,
      netEarnings,
      commissionRate,
      occupancy: gymSchedule.currentOccupancy || 0,
      maxCapacity: gymSchedule.maxCapacity || 60,
      occupancyStatus: (gymSchedule.currentOccupancy / (gymSchedule.maxCapacity || 60) > 0.8) ? 'HIGH' : ((gymSchedule.currentOccupancy / (gymSchedule.maxCapacity || 60) > 0.4) ? 'MODERATE' : 'LOW')
    },
    recentVisitors: todayVisitors.slice(0, 10),
    pendingRequests: pendingRequests.slice(0, 5)
  });
});

/**
 * GET /api/owner/requests
 * Fetch all booking requests for the owner's facility
 */
router.get('/requests', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_owner';
  const gym = getOwnerGym(userId, req);
  const bookings = db.get('bookings') || [];

  const requests = bookings.filter(b => b.gymId === gym.id || b.gymName === gym.name);
  res.json({ success: true, requests });
});

/**
 * POST /api/owner/requests/:id/accept
 * Accept athlete booking request and configure available time slots
 */
router.post('/requests/:id/accept', (req, res) => {
  const { slots } = req.body;
  const bookings = db.get('bookings') || [];
  const booking = bookings.find(b => b.id === req.params.id);

  if (!booking) return res.status(404).json({ error: 'Booking request not found' });

  booking.status = 'accepted';
  if (slots && Array.isArray(slots) && slots.length > 0) {
    booking.availableSlots = slots;
    booking.status = 'slots';
  }

  db.set('bookings', bookings);

  // Notify Athlete
  const notifications = db.get('notifications') || [];
  notifications.unshift({
    id: 'notif_' + Date.now(),
    userId: booking.userId,
    title: 'Booking Accepted! 🎉',
    message: `${booking.gymName} accepted your pass request! Please confirm your time slot and complete payment.`,
    type: 'booking_accepted',
    read: false,
    createdAt: new Date().toISOString()
  });
  db.set('notifications', notifications);

  res.json({ success: true, message: 'Request accepted successfully!', booking });
});

/**
 * POST /api/owner/requests/:id/decline
 * Decline an incoming pass request with a required explanation
 */
router.post('/requests/:id/decline', (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'A decline reason is mandatory so the traveler understands why capacity is unavailable.' });
  }

  const bookings = db.get('bookings') || [];
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking request not found' });

  booking.status = 'declined';
  booking.declineReason = reason.trim();
  db.set('bookings', bookings);

  // Notify Athlete
  const notifications = db.get('notifications') || [];
  notifications.unshift({
    id: 'notif_' + Date.now(),
    userId: booking.userId,
    title: 'Booking Declined',
    message: `${booking.gymName} was unable to accept your request: "${reason.trim()}". You may select another nearby gym.`,
    type: 'booking_declined',
    read: false,
    createdAt: new Date().toISOString()
  });
  db.set('notifications', notifications);

  res.json({ success: true, message: 'Booking declined with reason transmitted to athlete.', booking });
});

/**
 * GET /api/owner/schedule
 * Slot scheduling engine
 */
router.get('/schedule', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_owner';
  const gym = getOwnerGym(userId, req);
  const schedules = db.get('gymSchedules') || {};

  const schedule = schedules[gym.id] || {
    currentOccupancy: 15,
    maxCapacity: 60,
    slots: (gym.slots || ['5–7 AM', '7–9 AM', '9–11 AM', '5–7 PM', '7–9 PM', '9–11 PM']).map(s => ({
      time: s,
      maxCapacity: 25,
      bookedCapacity: 8,
      open: true
    }))
  };

  res.json({ success: true, schedule, gymId: gym.id });
});

/**
 * POST /api/owner/schedule
 * Update slot schedule, capacities, or closures
 */
router.post('/schedule', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_owner';
  const gym = getOwnerGym(userId, req);
  const { slots, maxCapacity, currentOccupancy, isClosed, closureReason } = req.body;

  const schedules = db.get('gymSchedules') || {};
  schedules[gym.id] = {
    gymId: gym.id,
    currentOccupancy: currentOccupancy !== undefined ? Number(currentOccupancy) : (schedules[gym.id] ? schedules[gym.id].currentOccupancy : 15),
    maxCapacity: maxCapacity !== undefined ? Number(maxCapacity) : (schedules[gym.id] ? schedules[gym.id].maxCapacity : 60),
    isClosed: !!isClosed,
    closureReason: closureReason || '',
    slots: slots || (schedules[gym.id] ? schedules[gym.id].slots : []),
    updatedAt: new Date().toISOString()
  };

  db.set('gymSchedules', schedules);
  res.json({ success: true, message: 'Facility schedule & slot capacities updated.', schedule: schedules[gym.id] });
});

/**
 * GET /api/owner/visitors
 * Live visitor check-in register
 */
router.get('/visitors', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_owner';
  const gym = getOwnerGym(userId, req);
  const register = db.get('visitorRegister') || [];

  const gymVisitors = register.filter(v => v.gymId === gym.id || v.gymName === gym.name);
  res.json({ success: true, visitors: gymVisitors });
});

/**
 * POST /api/owner/occupancy
 * Real-time capacity & occupancy counter
 */
router.post('/occupancy', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_owner';
  const gym = getOwnerGym(userId, req);
  const { currentOccupancy, maxCapacity } = req.body;

  const schedules = db.get('gymSchedules') || {};
  if (!schedules[gym.id]) {
    schedules[gym.id] = { currentOccupancy: 15, maxCapacity: 60, slots: [] };
  }

  if (currentOccupancy !== undefined) schedules[gym.id].currentOccupancy = Math.max(0, Number(currentOccupancy));
  if (maxCapacity !== undefined) schedules[gym.id].maxCapacity = Math.max(1, Number(maxCapacity));

  const occ = schedules[gym.id].currentOccupancy;
  const max = schedules[gym.id].maxCapacity;
  const ratio = occ / max;
  const status = ratio >= 0.9 ? 'FULL' : (ratio >= 0.7 ? 'HIGH' : (ratio >= 0.35 ? 'MODERATE' : 'LOW'));

  db.set('gymSchedules', schedules);
  res.json({ success: true, occupancy: occ, maxCapacity: max, status });
});

/**
 * GET /api/owner/revenue
 * Financial ledger, gross bookings, commission, and payouts
 */
router.get('/revenue', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_owner';
  const gym = getOwnerGym(userId, req);
  const bookings = db.get('bookings') || [];
  const settlements = db.get('settlements') || [];

  const gymBookings = bookings.filter(b => (b.gymId === gym.id || b.gymName === gym.name) && (b.status === 'paid' || b.status === 'checked_in'));
  const grossSales = gymBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
  const commissionRate = (config.ADMIN && config.ADMIN.commissionRate) || 0.15;
  const commissionDeduction = Math.round(grossSales * commissionRate);
  const netEarnings = grossSales - commissionDeduction;

  const gymSettlements = settlements.filter(s => s.gymId === gym.id);
  const settledTotal = gymSettlements.filter(s => s.status === 'SETTLED').reduce((sum, s) => sum + (s.netPayout || 0), 0);
  const pendingSettlement = Math.max(0, netEarnings - settledTotal);

  res.json({
    success: true,
    financials: {
      grossSales,
      commissionRate,
      platformCommission: commissionDeduction,
      netEarnings,
      settledTotal,
      pendingSettlement,
      transactionsCount: gymBookings.length
    },
    settlementHistory: gymSettlements,
    recentSales: gymBookings.slice(0, 15)
  });
});

/**
 * PUT /api/owner/gym-profile
 * Update gym information and facilities
 */
router.put('/gym-profile', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_owner';
  const gym = getOwnerGym(userId, req);
  const gyms = db.get('gyms') || [];
  const targetGym = gyms.find(g => g.id === gym.id);

  if (!targetGym) return res.status(404).json({ error: 'Gym facility not found' });

  const { name, address, openHours, dayPrice, tags, description } = req.body;
  if (name) targetGym.name = name.trim();
  if (address) targetGym.address = address.trim();
  if (openHours) targetGym.openHours = openHours.trim();
  if (dayPrice) targetGym.dayPrice = Number(dayPrice);
  if (tags && Array.isArray(tags)) targetGym.tags = tags;
  if (description) targetGym.description = description.trim();

  db.set('gyms', gyms);
  res.json({ success: true, message: 'Gym profile updated successfully', gym: targetGym });
});

/**
 * Staff management
 */
router.get('/staff', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_owner';
  const gym = getOwnerGym(userId, req);
  const staff = (db.get('staffAccounts') || []).filter(s => s.gymId === gym.id);
  res.json({ success: true, staff });
});

router.post('/staff', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_owner';
  const gym = getOwnerGym(userId, req);
  const { name, username, password } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Staff name, username, and password required.' });
  }

  const staff = db.get('staffAccounts') || [];
  const existing = staff.find(s => s.username.toLowerCase() === username.trim().toLowerCase());
  if (existing) return res.status(409).json({ error: 'Staff username already taken.' });

  const newStaff = {
    id: 'stf_' + Date.now(),
    gymId: gym.id,
    name: name.trim(),
    username: username.trim(),
    password: password,
    role: 'staff',
    permissions: ['qr_scan', 'visitor_view'],
    createdAt: new Date().toISOString()
  };

  staff.push(newStaff);
  db.set('staffAccounts', staff);
  res.status(201).json({ success: true, staff: newStaff });
});

router.delete('/staff/:id', (req, res) => {
  let staff = db.get('staffAccounts') || [];
  staff = staff.filter(s => s.id !== req.params.id);
  db.set('staffAccounts', staff);
  res.json({ success: true, message: 'Staff account removed' });
});

module.exports = router;

