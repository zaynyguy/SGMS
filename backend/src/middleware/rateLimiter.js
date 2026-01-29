// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const username = req.body && req.body.username ? String(req.body.username).toLowerCase() : null;
    const ipKey = ipKeyGenerator(req);
    return username ? `${username}:${ipKey}` : ipKey;
  },
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many failed login attempts. Please try again later.',
    });
  },
});

module.exports = { loginLimiter };
