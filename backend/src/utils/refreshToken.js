
const crypto = require('crypto');
const bcrypt = require('bcrypt');

function generateRefreshTokenValue() {
  return crypto.randomBytes(48).toString('hex'); 
}

async function hashToken(token) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(token, salt);
}

async function compareTokenHash(token, hash) {
  return bcrypt.compare(token, hash);
}

module.exports = { generateRefreshTokenValue, hashToken, compareTokenHash };
