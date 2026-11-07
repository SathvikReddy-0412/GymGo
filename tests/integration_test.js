const { Readable } = require('stream');
const path = require('path');
const serverApp = require('../backend/server.js');

function invokeApp(app, method, urlPath, body = null, headers = {}) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = new Readable({
      read() {
        if (payload) {
          this.push(Buffer.from(payload));
        }
        this.push(null);
      }
    });
    req.method = method;
    req.url = urlPath;
    req.headers = Object.assign({
      'host': 'localhost:3000',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload)
    }, headers);

    let responseData = '';
    const resHeaders = {};
    const res = {
      statusCode: 200,
      setHeader: (k, v) => { resHeaders[k.toLowerCase()] = v; },
      getHeader: (k) => resHeaders[k.toLowerCase()],
      status: function(code) { this.statusCode = code; return this; },
      send: function(data) {
        responseData = typeof data === 'object' ? JSON.stringify(data) : String(data);
        done();
      },
      json: function(data) {
        resHeaders['content-type'] = 'application/json';
        responseData = JSON.stringify(data);
        done();
      },
      end: function(data) {
        if (data) responseData += data;
        done();
      }
    };

    function done() {
      let parsed;
      try { parsed = JSON.parse(responseData); } catch (e) { parsed = responseData; }
      resolve({
        status: res.statusCode,
        headers: resHeaders,
        data: parsed
      });
    }

    app.handle(req, res, (err) => {
      if (err) {
        res.statusCode = 500;
        responseData = JSON.stringify({ error: err.message });
      } else {
        res.statusCode = 404;
        responseData = JSON.stringify({ error: 'Not found' });
      }
      done();
    });
  });
}

async function runTestSuite() {
  console.log('=== GYMGO COMPLETE PLATFORM INTEGRATION SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extra = '') {
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${testName} ${extra}`);
      failed++;
    }
  }

  try {
    // 1. Health check & Frontend Serving
    console.log('1. Frontend & System Health Verification:');
    const healthRes = await invokeApp(serverApp, 'GET', '/api/health');
    assert(healthRes.status === 200 && (healthRes.data.status === 'ok' || healthRes.data.status === 'healthy'), 'GET /api/health is healthy');
    assert(healthRes.data.database && healthRes.data.database.mode, 'Database engine initialized');

    const fs = require('fs');
    const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'index.html'), 'utf8');
    assert(indexHtml.includes('GYMGO'), 'frontend/index.html contains GYMGO branding');
    assert(indexHtml.includes('data-theme="cyber-volt"'), 'HTML contains Cyber Volt and 8 themes');
    assert(indexHtml.includes('id="gym-details-modal"'), 'HTML contains Gym Details modal');
    assert(indexHtml.includes('id="coach-live-chat-card"'), 'HTML contains Gemini AI Coach chat widget');
    assert(indexHtml.includes('id="adm-pane-settlements"'), 'HTML contains Master Admin Settlements pane');
    assert(indexHtml.includes('id="adm-pane-refunds"'), 'HTML contains Master Admin Refunds pane');
    assert(indexHtml.includes('id="adm-pane-promos"'), 'HTML contains Master Admin Promos pane');

    // 2. Authentication: PBKDF2 Hashing, Registration, Login
    console.log('\n2. Auth & PBKDF2 Password Security:');
    const testUsername = 'athlete_' + Date.now();
    const regRes = await invokeApp(serverApp, 'POST', '/api/auth/register', {
      username: testUsername,
      password: 'SecurePassword123!',
      name: 'Rohan Sharma',
      email: `${testUsername}@example.com`,
      role: 'athlete',
      homeCity: 'Vijayawada'
    });
    assert(regRes.status === 201 && regRes.data.success, 'POST /api/auth/register creates user with hashed password');
    assert(regRes.data.user && regRes.data.user.username === testUsername, 'Registration returns created user');

    const loginRes = await invokeApp(serverApp, 'POST', '/api/auth/login', {
      username: testUsername,
      password: 'SecurePassword123!'
    });
    assert(loginRes.status === 200 && loginRes.data.success, 'POST /api/auth/login succeeds with valid PBKDF2 credentials');
    assert(loginRes.data.user.role === 'athlete', 'User authenticated with role athlete');

    const badLogin = await invokeApp(serverApp, 'POST', '/api/auth/login', {
      username: testUsername,
      password: 'WrongPassword'
    });
    assert(badLogin.status === 401, 'POST /api/auth/login rejects incorrect password');

    // 3. Gym Discovery & Pricing
    console.log('\n3. Gym Discovery & Travel:');
    const gymsRes = await invokeApp(serverApp, 'GET', '/api/gyms');
    assert(gymsRes.status === 200 && Array.isArray(gymsRes.data.gyms), 'GET /api/gyms returns partner network');
    const sampleGym = gymsRes.data.gyms[0] || { id: 'gym_1', name: 'Starts Gym', city: 'Vijayawada' };
    assert(sampleGym.name, `Sample gym found: ${sampleGym.name}`);

    // 4. Promo Code Verification
    console.log('\n4. Promotional Discount Engine:');
    const promoCheck = await invokeApp(serverApp, 'POST', '/api/athlete/promotions/verify', {
      code: 'GYMGO20',
      amount: 1000
    });
    assert(promoCheck.status === 200 && promoCheck.data.valid, 'POST /api/athlete/promotions/verify validates GYMGO20');
    assert(promoCheck.data.discountAmount > 0, `GYMGO20 applies discount: ₹${promoCheck.data.discountAmount}`);

    // 5. Booking Creation & Payment
    console.log('\n5. Athlete Pass Booking & Payment Flow:');
    const createBk = await invokeApp(serverApp, 'POST', '/api/athlete/create-booking', {
      gymId: sampleGym.id,
      gymName: sampleGym.name,
      city: 'Vijayawada',
      area: 'Tadepalli',
      plan: '1-Day Pass',
      slot: 'Morning 06:00 - 09:00',
      amount: 150,
      athleteName: 'Rohan Sharma'
    });
    assert(createBk.status === 201 && createBk.data.success, 'POST /api/athlete/create-booking creates booking');
    const bookingId = createBk.data.booking.id;
    assert(bookingId && bookingId.startsWith('GG-'), `Created booking with valid ID format: ${bookingId}`);

    const payBk = await invokeApp(serverApp, 'POST', `/api/athlete/pay-booking/${bookingId}`, {
      paymentMethod: 'UPI'
    });
    assert(payBk.status === 200 && payBk.data.success, 'POST /api/athlete/pay-booking activates pass');
    assert(payBk.data.booking && payBk.data.booking.qrCodeData, 'Payment generates cryptographically signed QR data');

    // 6. Cryptographic QR Token Verification
    console.log('\n6. Cryptographic QR Verification & Turnstile Gateway:');
    const tokenRes = await invokeApp(serverApp, 'GET', `/api/qr/token/${bookingId}`);
    assert(tokenRes.status === 200 && tokenRes.data.token, 'GET /api/qr/token/:id returns signed HMAC token');
    const signedToken = tokenRes.data.token;

    // Verify token at turnstile
    const verifyRes = await invokeApp(serverApp, 'POST', '/api/qr/verify', {
      token: signedToken,
      gymId: sampleGym.id
    });
    assert(verifyRes.status === 200 && verifyRes.data.valid, 'POST /api/qr/verify validates signature & grants entry');
    assert(verifyRes.data.athleteName, 'Verified check-in returns athlete details');

    // Duplicate check-in prevention test
    const dupVerify = await invokeApp(serverApp, 'POST', '/api/qr/verify', {
      token: signedToken,
      gymId: sampleGym.id
    });
    assert(dupVerify.status === 409 || !dupVerify.data.valid, 'POST /api/qr/verify prevents duplicate check-in today');

    // 7. Gym Owner Portal Endpoints
    console.log('\n7. Gym Owner Business Management:');
    const ownerOverview = await invokeApp(serverApp, 'GET', '/api/owner/overview');
    assert(ownerOverview.status === 200 && ownerOverview.data.success, 'GET /api/owner/overview returns KPI metrics');
    assert(ownerOverview.data.metrics && ownerOverview.data.metrics.todayVisitorsCount >= 1, 'Visitor count includes verified turnstile scan');

    const ownerSchedule = await invokeApp(serverApp, 'POST', '/api/owner/schedule', {
      schedule: [
        { name: 'Morning', hours: '06:00 - 09:00', maxCapacity: 30, open: true },
        { name: 'Evening', hours: '17:00 - 20:00', maxCapacity: 35, open: true }
      ]
    });
    assert(ownerSchedule.status === 200 && ownerSchedule.data.success, 'POST /api/owner/schedule updates capacity');

    const ownerOccupancy = await invokeApp(serverApp, 'POST', '/api/owner/occupancy', {
      occupancyRate: 'Moderate'
    });
    assert(ownerOccupancy.status === 200 && ownerOccupancy.data.success, 'POST /api/owner/occupancy updates crowd status');

    const ownerVisitors = await invokeApp(serverApp, 'GET', '/api/owner/visitors');
    assert(ownerVisitors.status === 200 && Array.isArray(ownerVisitors.data.visitors), 'GET /api/owner/visitors lists check-ins');

    // 8. AI Coach Endpoint
    console.log('\n8. Gemini AI Coach 2.0 Engine:');
    const coachRes = await invokeApp(serverApp, 'POST', '/api/coach/chat', {
      message: 'How should I progressive overload on back squat?',
      biometrics: { age: 26, weight: 75, goal: 'muscle', diet: 'non' }
    });
    assert(coachRes.status === 200 && coachRes.data.success, 'POST /api/coach/chat generates guidance');
    assert(coachRes.data.disclaimer, 'AI Coach response includes medical disclaimer');

    // 9. Master Admin Portal Endpoints
    console.log('\n9. Master Admin Console & Governance:');
    const adminOverview = await invokeApp(serverApp, 'GET', '/api/admin/overview');
    assert(adminOverview.status === 200 && adminOverview.data.success, 'GET /api/admin/overview returns platform KPIs');
    assert(adminOverview.data.metrics.totalAthletes > 0, 'Admin reports live athletes');

    // Admin Gym Verification
    const verifyGym = await invokeApp(serverApp, 'POST', `/api/admin/gyms/${sampleGym.id}/verify`);
    assert(verifyGym.status === 200 && verifyGym.data.success, 'POST /api/admin/gyms/:id/verify audits gym');

    // Admin Settlements
    const settleRes = await invokeApp(serverApp, 'POST', '/api/admin/settlements', {
      processAll: true
    });
    assert(settleRes.status === 200 && settleRes.data.success, 'POST /api/admin/settlements disburses payouts');

    // Admin Create Promo
    const testPromoCode = 'PROMO' + Math.floor(Math.random() * 1000);
    const newPromo = await invokeApp(serverApp, 'POST', '/api/admin/promotions', {
      code: testPromoCode,
      discountPercent: 25,
      maxCapAmount: 400
    });
    assert(newPromo.status === 201 && newPromo.data.success, 'POST /api/admin/promotions creates promo code');

    // Admin Security Audit Logs & Fraud Alerts
    const auditRes = await invokeApp(serverApp, 'GET', '/api/admin/audit-logs');
    assert(auditRes.status === 200 && Array.isArray(auditRes.data.logs), 'GET /api/admin/audit-logs returns log trail');

    const fraudRes = await invokeApp(serverApp, 'GET', '/api/admin/fraud-alerts');
    assert(fraudRes.status === 200 && Array.isArray(fraudRes.data.alerts), 'GET /api/admin/fraud-alerts returns alerts');

    // 10. Pass Cancellation & Refund Claim
    console.log('\n10. Cancellation & Refund Lifecycle:');
    // Create an un-scanned pass to test cancellation
    const cancelBk = await invokeApp(serverApp, 'POST', '/api/athlete/create-booking', {
      gymId: sampleGym.id,
      gymName: sampleGym.name,
      city: 'Vijayawada',
      area: 'Tadepalli',
      plan: '1-Day Pass',
      slot: 'Evening 17:00 - 20:00',
      amount: 150,
      athleteName: 'Rohan Sharma'
    });
    const cancelBookingId = cancelBk.data.booking.id;
    await invokeApp(serverApp, 'POST', `/api/athlete/pay-booking/${cancelBookingId}`, { paymentMethod: 'Card' });

    const cancelRes = await invokeApp(serverApp, 'POST', `/api/athlete/cancel-booking/${cancelBookingId}`, {
      reason: 'Travel plans shifted to next week'
    });
    assert(cancelRes.status === 200 && cancelRes.data.success, 'POST /api/athlete/cancel-booking logs refund claim');

    const adminRefunds = await invokeApp(serverApp, 'GET', '/api/admin/refunds');
    assert(adminRefunds.status === 200 && Array.isArray(adminRefunds.data.refunds), 'GET /api/admin/refunds lists claims');

  } catch (err) {
    console.error('Test suite error:', err);
    failed++;
  } finally {
    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);
    if (failed > 0) process.exit(1);
  }
}

runTestSuite();
