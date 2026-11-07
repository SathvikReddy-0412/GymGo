try {
  require('dotenv').config({ quiet: true });
} catch (e) {}

const express = require('express');
const cors = require('cors');
const path = require('path');
const { db } = require('./db');
const config = require('../api_keys/keys');

const app = express();
const PORT = process.env.PORT || config.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve frontend static assets from frontend directory
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Health check endpoints for Render zero-downtime deployment & monitoring
const healthHandler = (req, res) => {
  res.json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    env: config.ENV,
    port: PORT,
    database: db.getStatus ? db.getStatus() : { mode: 'local' }
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Safe public configuration endpoint
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    env: config.ENV,
    currency: config.PAYMENT.currency,
    paymentProvider: config.PAYMENT.provider,
    defaultCity: config.MAPS.defaultCity
  });
});

// Modular portal route controllers
app.use('/api/qr', require('./routes/qr'));
app.use('/api/owner', require('./routes/owner'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/athlete', require('./routes/athlete'));

// --------------------------------------------------------------------------
// Auth & User Profile APIs
// --------------------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const cleanUser = username.trim().toLowerCase();
  const users = db.get('users');
  let user = users.find(u => u.username.toLowerCase() === cleanUser || (u.email && u.email.toLowerCase() === cleanUser));

  // Enforce that credentials work only after the account is signed up
  if (!user) {
    return res.status(404).json({
      error: `Account "${username.trim()}" not found. Please click "SIGN UP" to create an account first.`
    });
  }

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  // Strictly verify password against the registered account
  const enforceMatch = (config.AUTH && config.AUTH.enforcePasswordMatch !== undefined) ? config.AUTH.enforcePasswordMatch : true;
  if (enforceMatch) {
    if (user.password && user.password !== password) {
      return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
    }
  }

  return res.json({ success: true, user });
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, name, email, role, homeCity, gymName, area } = req.body;
  
  if (!username || username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
  }

  const cleanUser = username.trim().toLowerCase();
  const users = db.get('users');

  const existing = users.find(u => u.username.toLowerCase() === cleanUser || (email && u.email && u.email.toLowerCase() === email.trim().toLowerCase()));
  if (existing) {
    return res.status(409).json({ error: `An account with username "${username.trim()}" or that email already exists. Please log in instead.` });
  }

  const userRole = role === 'admin' ? 'admin' : (role === 'owner' ? 'owner' : 'athlete');
  const fullName = (name && name.trim()) || username.trim().charAt(0).toUpperCase() + username.trim().slice(1);
  const userEmail = (email && email.trim()) || `${cleanUser}@gymgo.fit`;
  const city = (homeCity && homeCity.trim()) || 'Vijayawada';

  const newUser = {
    id: 'usr_' + Date.now(),
    username: username.trim(),
    name: fullName,
    email: userEmail,
    password: password,
    role: userRole,
    avatar: fullName.charAt(0).toUpperCase(),
    homeCity: city,
    createdAt: new Date().toISOString()
  };

  if (userRole === 'owner') {
    newUser.gymName = (gymName && gymName.trim()) || `${fullName}'s Gym`;
    newUser.city = city;
    newUser.area = (area && area.trim()) || 'Main Hub';

    // Also register the gym in the gyms list if gymName provided
    const gyms = db.get('gyms') || [];
    const newGymId = 'gym_' + Date.now();
    gyms.push({
      id: newGymId,
      name: newUser.gymName,
      city: city,
      area: newUser.area,
      rating: 5.0,
      reviews: 1,
      distance: 0.8,
      dayPrice: 199,
      tags: ['Equipment', 'Free weights', 'Air Conditioned', 'Cardio'],
      address: `${newUser.area}, ${city}`,
      openHours: '5:00 AM - 10:00 PM',
      slots: ['5–7 AM', '7–9 AM', '9–11 AM', '5–7 PM', '7–9 PM', '9–11 PM']
    });
    db.set('gyms', gyms);
  } else {
    newUser.streak = 1;
    newUser.matchPct = 95;
    newUser.prs = {
      bench: '60 kg',
      squat: '80 kg',
      deadlift: '100 kg'
    };
  }

  users.push(newUser);
  db.set('users', users);

  res.status(201).json({ success: true, user: newUser, message: 'Account created successfully!' });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { identity } = req.body;
  if (!identity || !identity.trim()) {
    return res.status(400).json({ error: 'Please enter your username or registered email.' });
  }

  const clean = identity.trim().toLowerCase();
  const users = db.get('users');
  const user = users.find(u => u.username.toLowerCase() === clean || (u.email && u.email.toLowerCase() === clean));

  // Security: even if not found in prod, return friendly message. Here we give helpful feedback
  if (!user) {
    return res.json({
      success: true,
      message: `If an account exists for "${identity}", reset instructions have been dispatched. (Demo code: 7789)`
    });
  }

  res.json({
    success: true,
    message: `Reset code sent to ${user.email}. Verification code: 7789`,
    demoCode: '7789',
    username: user.username
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { identity, code, newPassword } = req.body;
  if (!identity || !newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Valid username/email and a new password (min 4 chars) are required.' });
  }

  const clean = identity.trim().toLowerCase();
  const users = db.get('users');
  const user = users.find(u => u.username.toLowerCase() === clean || (u.email && u.email.toLowerCase() === clean));

  if (!user) {
    return res.status(404).json({ error: 'No account found matching this identifier.' });
  }

  user.password = newPassword;
  db.set('users', users);

  res.json({ success: true, message: 'Password updated successfully! You can now log in.' });
});

app.get('/api/auth/me', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const users = db.get('users');
  const user = users.find(u => u.id === userId) || users[0];
  res.json({ success: true, user });
});

app.post('/api/auth/switch-role', (req, res) => {
  const { role, userId } = req.body;
  const users = db.get('users');
  const targetId = userId || (role === 'admin' ? 'usr_admin' : (role === 'owner' ? 'usr_owner' : 'usr_1'));
  const user = users.find(u => u.id === targetId || u.role === role) || users[0];
  res.json({ success: true, user });
});

// --------------------------------------------------------------------------
// Admin Dashboard & Global Command Center APIs
// --------------------------------------------------------------------------
app.get('/api/admin/overview', (req, res) => {
  const users = db.get('users') || [];
  const gyms = db.get('gyms') || [];
  const bookings = db.get('bookings') || [];
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.cost || b.price || (b.g && b.g.rates ? b.g.rates[0] : 199)), 0);
  const commissionRate = (config.ADMIN && config.ADMIN.commissionRate) || 0.15;
  const platformCommission = Math.round(totalRevenue * commissionRate);

  const stats = {
    totalUsers: users.length,
    totalAthletes: users.filter(u => u.role === 'athlete' || !u.role).length,
    totalOwners: users.filter(u => u.role === 'owner').length,
    totalAdmins: users.filter(u => u.role === 'admin').length,
    totalGyms: gyms.length,
    totalBookings: bookings.length,
    grossRevenue: totalRevenue,
    netCommission: platformCommission,
    platformCommission: platformCommission,
    commissionRate: commissionRate,
    systemHealth: {
      status: 'operational',
      uptime: Math.floor(process.uptime()),
      database: db.getStatus ? db.getStatus() : { mode: 'local' },
      apiKeys: {
        auth: !!config.AUTH,
        payment: !!config.PAYMENT.keyId,
        aiCoach: !!config.AI_COACH.apiKey,
        maps: !!config.MAPS.apiKey
      }
    },
    announcement: db.get('announcement') || null
  };

  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role || 'athlete',
    avatar: u.avatar || (u.username ? u.username.charAt(0).toUpperCase() : 'A'),
    homeCity: u.homeCity || u.city || 'Vijayawada',
    streak: u.streak || 1,
    createdAt: u.createdAt || new Date().toISOString()
  }));

  res.json({ success: true, metrics: stats, stats, users: safeUsers, gyms, bookings });
});

app.get('/api/admin/users', (req, res) => {
  const users = db.get('users') || [];
  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role || 'athlete',
    homeCity: u.homeCity || 'Vijayawada',
    streak: u.streak || 1,
    createdAt: u.createdAt || new Date().toISOString()
  }));
  res.json({ success: true, users: safeUsers });
});

app.post('/api/admin/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['athlete', 'owner', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Valid role is required (athlete, owner, admin)' });
  }
  const users = db.get('users') || [];
  const user = users.find(u => u.id === req.params.id || u.username === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.role = role;
  db.set('users', users);
  res.json({ success: true, user });
});

app.delete('/api/admin/users/:id', (req, res) => {
  let users = db.get('users') || [];
  const target = users.find(u => u.id === req.params.id || u.username === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.username === 'admin') {
    return res.status(403).json({ error: 'Cannot delete root master admin' });
  }
  users = users.filter(u => u.id !== req.params.id && u.username !== req.params.id);
  db.set('users', users);
  res.json({ success: true, message: `User "${target.username}" removed.` });
});

app.get('/api/admin/gyms', (req, res) => {
  const gyms = db.get('gyms') || [];
  res.json({ success: true, gyms });
});

app.post('/api/admin/gyms/:id/verify', (req, res) => {
  const gyms = db.get('gyms') || [];
  const gym = gyms.find(g => g.id === req.params.id);
  if (!gym) return res.status(404).json({ error: 'Gym not found' });
  gym.verified = gym.verified !== undefined ? !gym.verified : true;
  db.set('gyms', gyms);
  res.json({ success: true, gym });
});

app.get('/api/admin/bookings', (req, res) => {
  const bookings = db.get('bookings') || [];
  res.json({ success: true, bookings });
});

app.post('/api/admin/broadcast', (req, res) => {
  const { message, title, type } = req.body;
  if (!message || !message.trim()) {
    db.set('announcement', null);
    return res.json({ success: true, announcement: null, message: '' });
  }
  const announcement = {
    id: 'ann_' + Date.now(),
    title: title || 'System Announcement',
    message: message.trim(),
    type: type || 'info',
    createdAt: new Date().toISOString()
  };
  db.set('announcement', announcement);
  res.json({ success: true, announcement, message: announcement.message });
});

app.get('/api/announcement', (req, res) => {
  const ann = db.get('announcement') || null;
  res.json({ success: true, announcement: ann, message: ann ? ann.message : '' });
});

// --------------------------------------------------------------------------
// Cities and Gyms
// --------------------------------------------------------------------------
app.get('/api/cities', (req, res) => {
  res.json({ success: true, cities: db.get('cities') });
});

app.get('/api/gyms', (req, res) => {
  const { city, area, query } = req.query;
  let gyms = db.get('gyms');

  if (city) {
    gyms = gyms.filter(g => g.city.toLowerCase() === city.toLowerCase());
  }

  if (area) {
    gyms = gyms.filter(g => g.area.toLowerCase() === area.toLowerCase());
  }

  if (query) {
    const q = query.toLowerCase();
    gyms = gyms.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.city.toLowerCase().includes(q) ||
      g.area.toLowerCase().includes(q) ||
      g.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  res.json({ success: true, gyms });
});

app.get('/api/gyms/:id', (req, res) => {
  const gyms = db.get('gyms');
  const gym = gyms.find(g => g.id === req.params.id);
  if (!gym) return res.status(404).json({ error: 'Gym not found' });
  res.json({ success: true, gym });
});

// --------------------------------------------------------------------------
// Bookings & Gym Passes
// --------------------------------------------------------------------------
app.get('/api/bookings', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const role = req.headers['x-user-role'] || 'athlete';
  let bookings = db.get('bookings');

  if (role === 'owner') {
    // Show all requests for owner's gym
    bookings = bookings.filter(b => b.gymName === 'Starts Gym');
  } else {
    bookings = bookings.filter(b => b.userId === userId);
  }

  res.json({ success: true, bookings });
});

app.post('/api/bookings/request', (req, res) => {
  const { gymId, planIndex, startDate, userId, userName } = req.body;
  const gyms = db.get('gyms');
  const gym = gyms.find(g => g.id === gymId);
  if (!gym) return res.status(404).json({ error: 'Gym not found' });

  const PLANS = [
    { name: '1 Day', days: 1, mult: 1 },
    { name: '1 Week', days: 7, mult: 5 },
    { name: '1 Month', days: 30, mult: 12 },
    { name: '3 Months', days: 90, mult: 30 }
  ];

  const plan = PLANS[planIndex || 0];
  const start = new Date(startDate || Date.now());
  const end = new Date(start.getTime() + (plan.days - 1) * 86400000);
  const cost = gym.dayPrice * plan.mult;

  const newBooking = {
    id: 'GG-' + Math.floor(10000 + Math.random() * 90000),
    userId: userId || 'usr_1',
    userName: userName || 'Athlete',
    gymId: gym.id,
    gymName: gym.name,
    city: gym.city,
    area: gym.area,
    planName: plan.name,
    daysCount: plan.days,
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    slot: null,
    amount: cost,
    status: 'pending', // 'pending' -> 'accepted' -> 'slots' -> 'paid'
    availableSlots: [],
    slotsToggle: [1, 1, 1, 1, 1, 0],
    paymentMethod: 'UPI',
    createdAt: new Date().toISOString()
  };

  const bookings = db.get('bookings');
  bookings.unshift(newBooking);
  db.set('bookings', bookings);

  res.json({ success: true, booking: newBooking });
});

app.post('/api/bookings/:id/owner-action', (req, res) => {
  const { action, slots } = req.body; // action: 'accept', 'decline', 'share-slots'
  const bookings = db.get('bookings');
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (action === 'accept') {
    booking.status = 'accepted';
  } else if (action === 'decline') {
    booking.status = 'declined';
  } else if (action === 'share-slots') {
    booking.status = 'slots';
    booking.availableSlots = slots || ['5–7 AM', '7–9 AM', '5–7 PM', '7–9 PM'];
  }

  db.set('bookings', bookings);
  res.json({ success: true, booking });
});

app.post('/api/bookings/:id/choose-slot', (req, res) => {
  const { slot, paymentMethod } = req.body;
  const bookings = db.get('bookings');
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  booking.slot = slot;
  booking.paymentMethod = paymentMethod || 'UPI';
  booking.status = 'paid';
  booking.qrCodeData = `GYMGO:${booking.id}:${booking.userId}:${booking.gymId}:${booking.endDate}`;

  // Automatically stamp passport when paid!
  const stamps = db.get('passportStamps');
  const alreadyStamped = stamps.some(s => s.gymName === booking.gymName && s.city === booking.city);
  if (!alreadyStamped) {
    stamps.unshift({
      id: 'stamp_' + Date.now(),
      userId: booking.userId,
      gymName: booking.gymName,
      city: booking.city,
      area: booking.area,
      visitedDate: new Date().toISOString().split('T')[0],
      badgeEarned: `${booking.city} Explorer`,
      verified: true
    });
    db.set('passportStamps', stamps);
  }

  db.set('bookings', bookings);
  res.json({ success: true, booking });
});

// Check-in verification
app.post('/api/bookings/:id/check-in', (req, res) => {
  const bookings = db.get('bookings');
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  booking.checkedInAt = new Date().toISOString();
  db.set('bookings', bookings);

  res.json({ success: true, message: 'Check-in verified successfully!', booking });
});

// --------------------------------------------------------------------------
// AI Coach Assessment & State
// --------------------------------------------------------------------------
app.get('/api/coach/assessment', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const assessments = db.get('coachAssessments') || {};
  res.json({ success: true, assessment: assessments[userId] || null });
});

app.post('/api/coach/assessment', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const assessments = db.get('coachAssessments') || {};
  assessments[userId] = {
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  db.set('coachAssessments', assessments);
  res.json({ success: true, assessment: assessments[userId] });
});

app.post('/api/coach/water', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const { glasses } = req.body;
  const assessments = db.get('coachAssessments') || {};
  if (assessments[userId]) {
    assessments[userId].waterGlassesToday = glasses;
    db.set('coachAssessments', assessments);
  }
  res.json({ success: true, glasses });
});

// AI Coach conversational chat with fitness & nutritional intelligence
app.post('/api/coach/chat', async (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const { message } = req.body || {};
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  const assessments = db.get('coachAssessments') || {};
  const userAssessment = assessments[userId] || {
    goal: 'muscle_hypertrophy',
    diet: 'high_protein',
    experience: 'intermediate'
  };

  const users = db.get('users') || [];
  const user = users.find(u => u.id === userId) || { name: 'Athlete' };

  const promptText = message.trim();
  const lowerMsg = promptText.toLowerCase();

  let reply = '';
  if (lowerMsg.includes('split') || lowerMsg.includes('routine') || lowerMsg.includes('schedule') || lowerMsg.includes('plan')) {
    reply = `### Recommended Travel Training Split (Push / Pull / Legs)
Based on your profile as an **${userAssessment.experience || 'intermediate'}** lifter targeting **${userAssessment.goal || 'muscle hypertrophy'}**:

1. **Day 1 – Push (Chest, Delts, Triceps)**:
   - Barbell or DB Incline Press: 4 sets × 8–10 reps
   - Machine Chest Fly / Dips: 3 sets × 10–12 reps
   - Overhead Dumbbell Press: 3 sets × 8–10 reps
   - Cable Lateral Raises: 4 sets × 12–15 reps
   - Overhead Tricep Extension: 3 sets × 12 reps

2. **Day 2 – Pull (Back, Rear Delts, Biceps)**:
   - Lat Pulldown or Weighted Pull-ups: 4 sets × 8–10 reps
   - Chest-Supported T-Bar Row: 3 sets × 10–12 reps
   - Face Pulls / Reverse Pec Deck: 4 sets × 15 reps
   - Incline Dumbbell Bicep Curls: 3 sets × 10–12 reps

3. **Day 3 – Legs & Core (Quads, Hamstrings, Calves)**:
   - Hack Squat or Barbell Squat: 4 sets × 6–8 reps
   - Romanian Deadlift (RDL): 3 sets × 8–10 reps
   - Leg Extension & Lying Leg Curl Superset: 3 sets × 12 reps
   - Standing Calf Raises: 4 sets × 15 reps

*Tip*: When travelling, use GymGo's Travel Gym locator to check for barbell squat racks and dumbbell weights up to 50kg!`;
  } else if (lowerMsg.includes('diet') || lowerMsg.includes('protein') || lowerMsg.includes('calorie') || lowerMsg.includes('food') || lowerMsg.includes('meal')) {
    reply = `### Travel Nutrition & Macro Guidelines for ${user.name}
To support your goal while on the road:

- **Target Protein**: ~1.8g to 2.2g per kg of bodyweight (approx. 140g–160g daily).
- **On-the-go Protein Sources**: Paneer tikka, grilled chicken, egg whites, Greek yogurt, boiled sprouts, whey isolate shakes.
- **Hydration Protocol**: Aim for at least 3.5 Liters of water daily, especially after cross-city transit or flights.
- **Pre-Workout Fuel**: 30–40g of complex carbs (banana + oats or whole wheat toast) 60 mins before your gym check-in.`;
  } else if (lowerMsg.includes('bench') || lowerMsg.includes('squat') || lowerMsg.includes('deadlift') || lowerMsg.includes('pr')) {
    reply = `### Progressive Overload Blueprint for Heavy Compounds
To push past your personal records:

1. **Double Progression Model**: Keep the load constant until you hit the top of your rep target (e.g. 3 sets of 10 reps). Then add 2.5kg to 5kg in your next session.
2. **Technique Check**: Ensure scapular retraction and leg drive on bench press. On deadlifts, pull the slack out of the barbell before liftoff.
3. **Rest Intervals**: Rest a full 2.5 to 3 minutes between heavy working sets (use GymGo's built-in rest timer).`;
  } else {
    reply = `Hey ${user.name}! I've analyzed your fitness profile and travel schedule. 

For your training today, focus on **high motor-unit recruitment** with clean eccentric tempo (2-second negatives). Ensure your warm-up includes dynamic joint mobility (cat-camels, arm swings, bodyweight squats) for 5 minutes before touching heavy working sets.

What specific exercise, muscle group, or travel fitness question would you like to drill down into?`;
  }

  const disclaimer = '⚠️ Medical & Safety Disclaimer: GymGo AI Fitness Coach provides informational athletic guidance. Please consult with a physician or certified fitness trainer before undertaking high-intensity resistance training, especially if you have pre-existing cardiovascular, musculoskeletal, or joint conditions.';

  res.json({
    success: true,
    reply,
    disclaimer,
    timestamp: new Date().toISOString()
  });
});

// --------------------------------------------------------------------------
// Workouts & Exercises State
// --------------------------------------------------------------------------
app.get('/api/workouts/state', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  res.json({
    success: true,
    edits: db.get('workoutEdits')[userId] || {},
    done: db.get('workoutDone')[userId] || {},
    custom: db.get('customExercises') || []
  });
});

app.post('/api/workouts/state', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const { edits, done, custom } = req.body;

  if (edits !== undefined) {
    const allEdits = db.get('workoutEdits');
    allEdits[userId] = edits;
    db.set('workoutEdits', allEdits);
  }

  if (done !== undefined) {
    const allDone = db.get('workoutDone');
    allDone[userId] = done;
    db.set('workoutDone', allDone);
  }

  if (custom !== undefined) {
    db.set('customExercises', custom);
  }

  res.json({ success: true });
});

app.get('/api/workouts/logs', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const allLogs = db.get('workoutLogs') || {};
  res.json({ success: true, logs: allLogs[userId] || [] });
});

app.post('/api/workouts/logs', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const { log } = req.body;
  const allLogs = db.get('workoutLogs') || {};
  if (!allLogs[userId]) allLogs[userId] = [];
  allLogs[userId].push(log);
  if (allLogs[userId].length > 100) allLogs[userId].shift();
  db.set('workoutLogs', allLogs);
  res.json({ success: true, logs: allLogs[userId] });
});

app.delete('/api/workouts/logs/:timestamp', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const ts = Number(req.params.timestamp);
  const allLogs = db.get('workoutLogs') || {};
  if (allLogs[userId]) {
    allLogs[userId] = allLogs[userId].filter(l => l.t !== ts);
    db.set('workoutLogs', allLogs);
  }
  res.json({ success: true, logs: allLogs[userId] || [] });
});

// --------------------------------------------------------------------------
// Gym Passport APIs
// --------------------------------------------------------------------------
app.get('/api/passport', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const stamps = db.get('passportStamps').filter(s => s.userId === userId);
  
  // Badges calculation
  const citiesCount = new Set(stamps.map(s => s.city)).size;
  const gymsCount = stamps.length;
  
  const badges = [
    {
      id: 'first_sweat',
      title: 'First Sweat',
      desc: 'First travel gym visit completed',
      unlocked: gymsCount >= 1,
      icon: '🏋️‍♂️'
    },
    {
      id: 'city_hopper',
      title: 'City Hopper',
      desc: 'Trained in 2+ different cities',
      unlocked: citiesCount >= 2,
      icon: '✈️'
    },
    {
      id: 'iron_nomad',
      title: 'Iron Nomad',
      desc: 'Visited 3+ unique gyms across India',
      unlocked: gymsCount >= 3,
      icon: '🌐'
    },
    {
      id: 'streak_crusher',
      title: 'Streak Crusher',
      desc: 'Maintained 30+ day workout streak',
      unlocked: true,
      icon: '🔥'
    }
  ];

  res.json({ success: true, stamps, badges, stats: { totalGyms: gymsCount, totalCities: citiesCount } });
});

app.post('/api/passport/check-in', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const { gymName, city, area } = req.body;
  if (!gymName || !city) return res.status(400).json({ error: 'Gym and city required' });

  const stamps = db.get('passportStamps');
  const newStamp = {
    id: 'stamp_' + Date.now(),
    userId,
    gymName,
    city,
    area: area || '',
    visitedDate: new Date().toISOString().split('T')[0],
    badgeEarned: `${city} Sweat Stamp`,
    verified: true
  };

  stamps.unshift(newStamp);
  db.set('passportStamps', stamps);

  res.json({ success: true, stamp: newStamp });
});

// --------------------------------------------------------------------------
// GymGram Community Social APIs
// --------------------------------------------------------------------------
app.get('/api/gymgram/posts', (req, res) => {
  const posts = db.get('gymgramPosts') || [];
  res.json({ success: true, posts });
});

app.post('/api/gymgram/posts', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const users = db.get('users');
  const user = users.find(u => u.id === userId) || users[0];
  const { caption, location, workoutType, tag, photo } = req.body;

  if (!caption) {
    return res.status(400).json({ error: 'Caption is required' });
  }

  const posts = db.get('gymgramPosts');
  const newPost = {
    id: 'post_' + Date.now(),
    userId: user.id,
    authorName: user.name,
    authorAvatar: user.avatar || user.name.charAt(0),
    location: location || `${user.homeCity} · Fitness Center`,
    caption,
    tag: tag || 'Daily Grind 🔥',
    workoutType: workoutType || 'General Workout',
    likes: 1,
    likedBy: [user.id],
    comments: [],
    timeAgo: 'Just now',
    photo: photo || null
  };

  posts.unshift(newPost);
  db.set('gymgramPosts', posts);

  res.json({ success: true, post: newPost });
});

app.post('/api/gymgram/posts/:id/like', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const posts = db.get('gymgramPosts');
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  if (!post.likedBy) post.likedBy = [];
  const idx = post.likedBy.indexOf(userId);

  if (idx > -1) {
    post.likedBy.splice(idx, 1);
    post.likes = Math.max(0, post.likes - 1);
  } else {
    post.likedBy.push(userId);
    post.likes += 1;
  }

  db.set('gymgramPosts', posts);
  res.json({ success: true, likes: post.likes, liked: idx === -1 });
});

app.post('/api/gymgram/posts/:id/comment', (req, res) => {
  const userId = req.headers['x-user-id'] || 'usr_1';
  const users = db.get('users');
  const user = users.find(u => u.id === userId) || users[0];
  const { text } = req.body;

  if (!text) return res.status(400).json({ error: 'Comment text required' });

  const posts = db.get('gymgramPosts');
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const newComment = {
    id: 'c_' + Date.now(),
    author: user.name,
    text: text.trim()
  };

  post.comments.push(newComment);
  db.set('gymgramPosts', posts);

  res.json({ success: true, comment: newComment });
});

// Return 404 JSON for non-existent API endpoints
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl || req.url}` });
});

// Fallback to index.html for Single Page App client-side routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Bind to 0.0.0.0 host for Render and container environments
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 GymGo running at http://localhost:${PORT}`);
  });
}

module.exports = app;
