const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { generateQrToken } = require('../utils/crypto_qr');

/**
 * GET /api/athlete/dashboard
 * Aggregated live dashboard for logged-in athlete
 */
router.get('/dashboard', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const users = db.get('users') || [];
  const user = users.find(u => u.id === userId || u.username === userId) || users[0];

  const bookings = (db.get('bookings') || []).filter(b => b.userId === user.id);
  const activePass = bookings.find(b => b.status === 'paid' || b.status === 'checked_in');
  const pendingBooking = bookings.find(b => b.status === 'pending' || b.status === 'slots');

  const stamps = (db.get('passportStamps') || []).filter(s => s.userId === user.id);
  const workoutLogs = (db.get('workoutLogs') || {})[user.id] || [];

  const gyms = db.get('gyms') || [];
  const recommendedGyms = gyms.filter(g => g.city === (user.homeCity || 'Vijayawada')).slice(0, 4);

  res.json({
    success: true,
    athlete: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role || 'athlete',
      homeCity: user.homeCity || 'Vijayawada',
      streak: user.streak || 47,
      matchPct: user.matchPct || 96,
      avatar: user.avatar || 'A',
      prs: user.prs || { bench: '105 kg', squat: '145 kg', deadlift: '185 kg' }
    },
    activePass: activePass || null,
    pendingBooking: pendingBooking || null,
    stats: {
      completedWorkoutsCount: workoutLogs.length,
      gymsVisitedCount: stamps.length,
      citiesCount: new Set(stamps.map(s => s.city)).size
    },
    recommendedGyms
  });
});

/**
 * POST /api/athlete/profile
 * Update athlete fitness preferences, safety notes & emergency contact
 */
router.post('/profile', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const users = db.get('users') || [];
  const user = users.find(u => u.id === userId || u.username === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, email, homeCity, prs, emergencyContact, healthNotes, fitnessGoal } = req.body || {};
  if (name) user.name = name.trim();
  if (email) user.email = email.trim();
  if (homeCity) user.homeCity = homeCity.trim();
  if (prs) user.prs = { ...user.prs, ...prs };
  if (emergencyContact) user.emergencyContact = emergencyContact;
  if (healthNotes !== undefined) user.healthNotes = healthNotes;
  if (fitnessGoal) user.fitnessGoal = fitnessGoal;

  db.set('users', users);
  res.json({ success: true, user, message: 'Profile updated successfully.' });
});

/**
 * POST /api/bookings/create
 * Create a new travel pass booking request with duration options
 */
router.post('/create-booking', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const users = db.get('users') || [];
  const user = users.find(u => u.id === userId || u.username === userId) || { name: 'Athlete' };

  const { gymId, planKey, startDate, promoCode, slot } = req.body || {};
  const gyms = db.get('gyms') || [];
  const gym = gyms.find(g => g.id === gymId);
  if (!gym) return res.status(404).json({ error: 'Gym not found' });

  const PLANS = {
    '1day': { name: '1 Day Pass', days: 1, mult: 1 },
    '7day': { name: '1 Week Pass', days: 7, mult: 5 },
    '30day': { name: '1 Month Pass', days: 30, mult: 12 },
    '90day': { name: '3 Months Pass', days: 90, mult: 30 }
  };

  const plan = PLANS[planKey || '1day'] || PLANS['1day'];
  const start = new Date(startDate || Date.now());
  const end = new Date(start.getTime() + (plan.days - 1) * 86400000);
  let baseAmount = gym.dayPrice * plan.mult;

  // Apply promo discount if valid
  let discount = 0;
  if (promoCode) {
    const promotions = db.get('promotions') || [];
    const promo = promotions.find(p => p.code === promoCode.trim().toUpperCase() && p.active !== false);
    if (promo) {
      discount = Math.min(promo.maxDiscount || 100, Math.round(baseAmount * (promo.discountPct / 100)));
      promo.usageCount = (promo.usageCount || 0) + 1;
      db.set('promotions', promotions);
    }
  }

  const finalAmount = Math.max(0, baseAmount - discount);

  const newBooking = {
    id: 'GG-' + Math.floor(10000 + Math.random() * 90000),
    userId: user.id || userId,
    userName: user.name || 'Athlete',
    gymId: gym.id,
    gymName: gym.name,
    city: gym.city,
    area: gym.area,
    planName: plan.name,
    daysCount: plan.days,
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    slot: slot || (gym.slots && gym.slots[0]) || 'Open slot',
    baseAmount,
    discount,
    amount: finalAmount,
    status: 'pending', // 'pending' -> 'accepted' -> 'paid' -> 'checked_in'
    paymentStatus: 'UNPAID',
    checkInStatus: 'NOT_CHECKED_IN',
    promoCode: promoCode || null,
    createdAt: new Date().toISOString()
  };

  const bookings = db.get('bookings') || [];
  bookings.unshift(newBooking);
  db.set('bookings', bookings);

  // Notify gym owner
  const notifications = db.get('notifications') || [];
  notifications.unshift({
    id: 'notif_' + Date.now(),
    userId: 'usr_owner',
    title: 'New Traveler Pass Request',
    message: `${newBooking.userName} requested a ${plan.name} at ${gym.name}.`,
    type: 'booking_request',
    read: false,
    createdAt: new Date().toISOString()
  });
  db.set('notifications', notifications);

  res.status(201).json({ success: true, booking: newBooking, message: 'Pass request submitted to gym owner.' });
});

/**
 * POST /api/bookings/:id/pay
 * Complete payment for an accepted pass booking and generate signed QR token
 */
router.post('/pay-booking/:id', (req, res) => {
  const { paymentMethod } = req.body || {};
  const bookings = db.get('bookings') || [];
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  booking.paymentStatus = 'PAID';
  booking.status = 'paid';
  booking.paymentMethod = paymentMethod || 'UPI (Razorpay Mock/Sandbox)';
  booking.paidAt = new Date().toISOString();

  // Generate cryptographically signed QR token
  const qrToken = generateQrToken(booking, booking.gymId, booking.userId, (booking.daysCount || 1) * 24 + 12);
  booking.qrCodeData = qrToken;
  db.set('bookings', bookings);

  // Notify Athlete
  const notifications = db.get('notifications') || [];
  notifications.unshift({
    id: 'notif_' + Date.now(),
    userId: booking.userId,
    title: 'Payment Confirmed! 🎟️',
    message: `Payment of ₹${booking.amount} confirmed for ${booking.gymName}. Your digital turnstile pass is ready in your wallet.`,
    type: 'payment_success',
    read: false,
    createdAt: new Date().toISOString()
  });
  db.set('notifications', notifications);

  res.json({ success: true, booking, message: 'Payment confirmed & pass activated!' });
});

/**
 * POST /api/bookings/:id/cancel
 * Cancel booking and submit refund request
 */
router.post('/cancel-booking/:id', (req, res) => {
  const { reason } = req.body || {};
  const bookings = db.get('bookings') || [];
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (booking.status === 'checked_in') {
    return res.status(400).json({ error: 'Cannot cancel a pass that has already been verified and used at the turnstile.' });
  }

  const oldStatus = booking.status;
  booking.status = 'cancelled';
  booking.cancelReason = reason || 'User initiated cancellation';
  booking.cancelledAt = new Date().toISOString();

  // If already paid, automatically queue a refund ticket
  if (booking.paymentStatus === 'PAID') {
    const refunds = db.get('refunds') || [];
    refunds.unshift({
      id: 'ref_' + Date.now(),
      bookingId: booking.id,
      athleteId: booking.userId,
      athleteName: booking.userName || 'Athlete',
      gymId: booking.gymId,
      gymName: booking.gymName,
      amount: booking.amount,
      reason: booking.cancelReason,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });
    db.set('refunds', refunds);
  }

  db.set('bookings', bookings);
  res.json({ success: true, booking, message: 'Booking cancelled. Refund request logged if payment was completed.' });
});

/**
 * POST /api/promotions/verify
 * Validate a discount code
 */
router.post('/promotions/verify', (req, res) => {
  const { code, amount } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Promo code required' });

  const promotions = db.get('promotions') || [];
  const promo = promotions.find(p => p.code === code.trim().toUpperCase() && p.active !== false);

  if (!promo) {
    return res.status(404).json({ valid: false, error: 'Invalid or expired promotional voucher code.' });
  }

  const base = Number(amount) || 150;
  const discount = Math.min(promo.maxDiscount || 100, Math.round(base * (promo.discountPct / 100)));
  const finalPrice = Math.max(0, base - discount);

  res.json({
    valid: true,
    code: promo.code,
    discountPct: promo.discountPct,
    discountAmount: discount,
    finalPrice,
    description: promo.description
  });
});

/**
 * In-App Notifications
 */
router.get('/notifications', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const allNotifs = db.get('notifications') || [];
  const userNotifs = allNotifs.filter(n => n.userId === userId || n.userId === 'ALL');
  res.json({ success: true, notifications: userNotifs });
});

router.post('/notifications/mark-read', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const allNotifs = db.get('notifications') || [];
  allNotifs.forEach(n => {
    if (n.userId === userId || n.userId === 'ALL') n.read = true;
  });
  db.set('notifications', allNotifs);
  res.json({ success: true });
});

/**
 * Support Complaint or Safety Report
 */
router.post('/complaints', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const users = db.get('users') || [];
  const user = users.find(u => u.id === userId || u.username === userId) || { name: 'User', role: 'athlete' };

  const { category, description, gymId, bookingId } = req.body || {};
  if (!description) return res.status(400).json({ error: 'Issue description is required' });

  const complaints = db.get('complaints') || [];
  const newTicket = {
    id: 'tkt_' + Date.now(),
    reporterId: user.id || userId,
    reporterName: user.name || 'User',
    reporterRole: user.role || 'athlete',
    category: category || 'general_support',
    gymId: gymId || null,
    bookingId: bookingId || null,
    description: description.trim(),
    status: 'OPEN',
    priority: category === 'facility_safety' ? 'HIGH' : 'MEDIUM',
    createdAt: new Date().toISOString()
  };

  complaints.unshift(newTicket);
  db.set('complaints', complaints);

  res.status(201).json({ success: true, ticket: newTicket, message: 'Support ticket submitted to platform administrators.' });
});

module.exports = router;
