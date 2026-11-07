const crypto = require('crypto');
const config = require('../../api_keys/keys');

const SECRET = config.SECURITY && config.SECURITY.qrPassSalt ? config.SECURITY.qrPassSalt : 'gymgo_qr_auth_salt_99812';

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64url');
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * Generate a cryptographically signed, expiring QR token
 */
function generateQrToken(booking, gymId, userId, validHours = 24) {
  const now = Date.now();
  const exp = now + validHours * 3600 * 1000;
  
  const payload = {
    v: 1,
    bid: booking.id,
    gid: gymId || booking.gymId,
    uid: userId || booking.userId,
    slot: booking.slot || 'Open slot',
    exp: Math.floor(exp / 1000),
    iat: Math.floor(now / 1000)
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', SECRET).update(encodedPayload).digest('base64url');

  return `GYMGO.V1.${encodedPayload}.${signature}`;
}

/**
 * Verify a signed QR token
 */
function verifyQrToken(tokenString, expectedGymId = null) {
  if (!tokenString || typeof tokenString !== 'string') {
    return { valid: false, error: 'Empty or invalid QR token string' };
  }

  const parts = tokenString.trim().split('.');
  if (parts.length !== 4 || parts[0] !== 'GYMGO' || parts[1] !== 'V1') {
    return { valid: false, error: 'Malformed token structure. Not a certified GymGo QR pass.' };
  }

  const encodedPayload = parts[2];
  const givenSignature = parts[3];

  // Recompute signature
  const expectedSignature = crypto.createHmac('sha256', SECRET).update(encodedPayload).digest('base64url');

  const givenBuf = Buffer.from(givenSignature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (givenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(givenBuf, expectedBuf)) {
    return { valid: false, error: 'Digital signature mismatch. QR token has been forged or corrupted.' };
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (err) {
    return { valid: false, error: 'Unreadable token payload.' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSec) {
    return { valid: false, error: 'QR Pass has expired. Please renew your travel pass.', payload };
  }

  if (expectedGymId && payload.gid && payload.gid !== expectedGymId) {
    return {
      valid: false,
      error: `Access Denied: This pass is valid for facility ID "${payload.gid}", not your gym ("${expectedGymId}").`,
      payload
    };
  }

  return { valid: true, payload };
}

module.exports = {
  generateQrToken,
  verifyQrToken
};

