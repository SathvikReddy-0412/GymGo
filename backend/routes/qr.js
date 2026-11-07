const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { generateQrToken, verifyQrToken } = require('../utils/crypto_qr');

/**
 * GET /api/qr/token/:bookingId
 * Generate or retrieve an active cryptographic QR token for a paid booking
 */
router.get('/token/:bookingId', (req, res) => {
  const bookings = db.get('bookings') || [];
  const booking = bookings.find(b => b.id === req.params.bookingId);
  if (!booking) {
    return res.status(404).json({ error: 'Pass booking not found.' });
  }

  if (booking.status !== 'paid' && booking.status !== 'accepted' && booking.status !== 'checked_in') {
    return res.status(400).json({ error: `Cannot generate QR for pass with status "${booking.status}". Must be verified & paid.` });
  }

  const token = generateQrToken(booking, booking.gymId, booking.userId, 24);
  booking.qrCodeData = token;
  db.set('bookings', bookings);

  res.json({
    success: true,
    token,
    bookingId: booking.id,
    gymName: booking.gymName,
    slot: booking.slot,
    validUntil: booking.endDate
  });
});

/**
 * POST /api/qr/verify
 * Scan & verify an athlete's QR token at the gym reception/turnstile
 */
router.post('/verify', (req, res) => {
  const token = req.body && (req.body.token || req.body.qrToken);
  const gymId = req.body && req.body.gymId;
  const verifiedBy = req.body && req.body.verifiedBy;
  if (!token) {
    return res.status(400).json({ error: 'QR token is required.' });
  }

  // Cryptographic signature & expiration validation
  const verification = verifyQrToken(token, gymId);
  if (!verification.valid) {
    return res.status(400).json({
      success: false,
      error: verification.error,
      payload: verification.payload
    });
  }

  const payload = verification.payload;
  const bookings = db.get('bookings') || [];
  const booking = bookings.find(b => b.id === payload.bid);

  if (!booking) {
    return res.status(404).json({ error: 'Booking associated with this QR token does not exist in platform records.' });
  }

  // Prevent unauthorized facilities from scanning passes meant for another gym
  if (gymId && booking.gymId && booking.gymId !== gymId) {
    return res.status(403).json({
      error: `Pass Authorization Error: This pass is for "${booking.gymName}" (${booking.gymId}), not your gym.`
    });
  }

  // Check booking validity dates
  const todayStr = new Date().toISOString().split('T')[0];
  if (booking.startDate && todayStr < booking.startDate) {
    return res.status(400).json({
      error: `Pass Not Yet Active: This pass is valid starting from ${booking.startDate}.`
    });
  }
  if (booking.endDate && todayStr > booking.endDate) {
    return res.status(400).json({
      error: `Pass Expired: This pass expired on ${booking.endDate}.`
    });
  }

  // Check duplicate scans on the same day for single-day pass
  const visitorRegister = db.get('visitorRegister') || [];
  const alreadyCheckedInToday = visitorRegister.some(
    v => v.bookingId === booking.id && v.checkInTime.startsWith(todayStr)
  );

  if (alreadyCheckedInToday && booking.daysCount === 1) {
    return res.status(409).json({
      error: 'Pass Already Checked In: 1-Day Pass has already been used for entry today.',
      booking
    });
  }

  // Record successful entry in visitor register
  const newVisit = {
    id: 'vis_' + Date.now(),
    bookingId: booking.id,
    athleteId: booking.userId,
    athleteName: booking.userName || 'Athlete',
    gymId: booking.gymId,
    gymName: booking.gymName,
    checkInTime: new Date().toISOString(),
    verifiedBy: verifiedBy || 'Turnstile QR Scanner',
    passType: booking.planName || `${booking.daysCount || 1} Day Pass`,
    slot: booking.slot || 'Open slot',
    status: 'VERIFIED'
  };
  visitorRegister.unshift(newVisit);
  db.set('visitorRegister', visitorRegister);

  // Update booking status
  booking.status = 'checked_in';
  booking.lastCheckIn = new Date().toISOString();
  booking.checkInCount = (booking.checkInCount || 0) + 1;
  db.set('bookings', bookings);

  // Automatically create verified gym passport stamp
  const stamps = db.get('passportStamps') || [];
  const alreadyStamped = stamps.some(s => s.userId === booking.userId && s.gymName === booking.gymName && s.visitedDate === todayStr);
  if (!alreadyStamped) {
    stamps.unshift({
      id: 'stamp_' + Date.now(),
      userId: booking.userId,
      gymName: booking.gymName,
      city: booking.city,
      area: booking.area,
      visitedDate: todayStr,
      badgeEarned: `${booking.city} Verified Check-In`,
      verified: true
    });
    db.set('passportStamps', stamps);
  }

  // Add athlete notification
  const notifications = db.get('notifications') || [];
  notifications.unshift({
    id: 'notif_' + Date.now(),
    userId: booking.userId,
    title: 'Check-In Verified! 🏋️‍♂️',
    message: `Entry verified at ${booking.gymName} (${booking.slot || 'Open slot'}). Have a phenomenal workout!`,
    type: 'check_in',
    read: false,
    createdAt: new Date().toISOString()
  });
  db.set('notifications', notifications);

  res.json({
    success: true,
    valid: true,
    athleteName: booking.userName || 'Athlete',
    message: `Entry Granted! Welcome to ${booking.gymName}, ${booking.userName}.`,
    visitor: newVisit,
    booking
  });
});

/**
 * POST /api/qr/manual-verify
 * Fallback manual check-in verification with booking ID
 */
router.post('/manual-verify', (req, res) => {
  const { bookingId, gymId, verifiedBy, staffNotes } = req.body;
  if (!bookingId) {
    return res.status(400).json({ error: 'Booking ID is required.' });
  }

  const bookings = db.get('bookings') || [];
  const booking = bookings.find(b => b.id.toUpperCase() === bookingId.trim().toUpperCase());
  if (!booking) {
    return res.status(404).json({ error: `Booking "${bookingId}" not found.` });
  }

  if (gymId && booking.gymId && booking.gymId !== gymId) {
    return res.status(403).json({ error: `This booking is for "${booking.gymName}", not your facility.` });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const visitorRegister = db.get('visitorRegister') || [];
  const newVisit = {
    id: 'vis_man_' + Date.now(),
    bookingId: booking.id,
    athleteId: booking.userId,
    athleteName: booking.userName || 'Athlete',
    gymId: booking.gymId,
    gymName: booking.gymName,
    checkInTime: new Date().toISOString(),
    verifiedBy: verifiedBy || 'Desk Reception (Manual Fallback)',
    passType: booking.planName || 'Day Pass',
    slot: booking.slot || 'Open slot',
    status: 'MANUAL_OVERRIDE',
    notes: staffNotes || 'Manual desk check-in'
  };
  visitorRegister.unshift(newVisit);
  db.set('visitorRegister', visitorRegister);

  booking.status = 'checked_in';
  booking.lastCheckIn = new Date().toISOString();
  db.set('bookings', bookings);

  res.json({
    success: true,
    message: `Manual verification confirmed for ${booking.userName}.`,
    visitor: newVisit,
    booking
  });
});

module.exports = router;
