try {
  require('dotenv').config({ quiet: true });
} catch (e) {}

const fs = require('fs');
const path = require('path');

const KEYS_FILE = path.join(__dirname, 'api_keys.json');
let keys = {};

try {
  if (fs.existsSync(KEYS_FILE)) {
    const raw = fs.readFileSync(KEYS_FILE, 'utf8');
    keys = JSON.parse(raw);
  }
} catch (e) {
  console.warn('Could not read api_keys.json, using environment or default fallbacks:', e.message);
}

module.exports = {
  PORT: process.env.PORT || (keys.server && keys.server.port) || 3000,
  ENV: process.env.NODE_ENV || (keys.server && keys.server.env) || 'development',
  JWT_SECRET: process.env.JWT_SECRET || (keys.auth && keys.auth.jwtSecret) || (keys.server && keys.server.jwtSecret) || 'gymgo_secret_jwt_key_2026',
  MONGODB_URI: process.env.MONGODB_URI || (keys.server && keys.server.mongoUri) || '',

  AUTH: {
    requireSignUp: (keys.auth && keys.auth.requireSignUp !== undefined) ? keys.auth.requireSignUp : true,
    allowAutoRegisterOnLogin: (keys.auth && keys.auth.allowAutoRegisterOnLogin !== undefined) ? keys.auth.allowAutoRegisterOnLogin : false,
    enforcePasswordMatch: (keys.auth && keys.auth.enforcePasswordMatch !== undefined) ? keys.auth.enforcePasswordMatch : true,
    apiKey: process.env.AUTH_API_KEY || (keys.auth && keys.auth.apiKey) || 'gymgo_auth_api_key_2026_secured',
    jwtSecret: process.env.JWT_SECRET || (keys.auth && keys.auth.jwtSecret) || 'gymgo_jwt_access_token_secret_key_99812',
    minPasswordLength: (keys.auth && keys.auth.minPasswordLength) || 4,
    tokenExpiryDays: (keys.auth && keys.auth.tokenExpiryDays) || 30
  },
  
  PAYMENT: {
    provider: (keys.payment && keys.payment.provider) || 'razorpay',
    keyId: process.env.RAZORPAY_KEY_ID || (keys.payment && keys.payment.razorpayKeyId) || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || (keys.payment && keys.payment.razorpayKeySecret) || '',
    upiVpa: (keys.payment && keys.payment.upiMerchantVpa) || 'gymgo@upi',
    currency: (keys.payment && keys.payment.currency) || 'INR'
  },

  AI_COACH: {
    provider: (keys.aiCoach && keys.aiCoach.provider) || 'gemini',
    apiKey: process.env.GEMINI_API_KEY || (keys.aiCoach && keys.aiCoach.geminiApiKey) || '',
    model: (keys.aiCoach && keys.aiCoach.model) || 'gemini-1.5-flash',
    temperature: (keys.aiCoach && keys.aiCoach.temperature) || 0.7
  },

  MAPS: {
    provider: (keys.maps && keys.maps.provider) || 'google_maps',
    apiKey: process.env.GOOGLE_MAPS_API_KEY || (keys.maps && keys.maps.googleMapsApiKey) || '',
    defaultCity: (keys.maps && keys.maps.defaultCity) || 'Vijayawada'
  },

  SECURITY: {
    qrPassSalt: (keys.security && keys.security.qrPassSalt) || 'gymgo_qr_auth_salt_99812',
    tokenExpiryDays: (keys.security && keys.security.tokenExpiryDays) || 30
  },

  ADMIN: {
    defaultAdminUsername: (keys.admin && keys.admin.defaultAdminUsername) || 'admin',
    masterKey: process.env.ADMIN_MASTER_KEY || (keys.admin && keys.admin.masterKey) || 'gymgo_master_admin_secret_key_2026',
    commissionRate: (keys.admin && keys.admin.commissionRate) || 0.15
  }
};
