const crypto = require('crypto');

/**
 * Hash password with salt using PBKDF2 (SHA-512)
 */
function hashPassword(password) {
  if (!password || typeof password !== 'string') return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `pbkdf2$10000$${salt}$${hash}`;
}

/**
 * Verify password against hashed password or plaintext fallback (for seamless backwards compatibility)
 */
function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;

  // Modern PBKDF2 format
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const hash = parts[3];

    const computed = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
    const givenBuf = Buffer.from(computed);
    const expectedBuf = Buffer.from(hash);
    if (givenBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(givenBuf, expectedBuf);
  }

  // Plaintext fallback for pre-seeded development accounts
  return password === storedHash;
}

module.exports = {
  hashPassword,
  verifyPassword
};

