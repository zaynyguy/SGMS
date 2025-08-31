const rateLimit = require("express-rate-limit");

// Limit login requests to 10 per minute per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Too many login attempts from this IP, please try again after 15 minutes.",
  },
});

module.exports = { loginLimiter };
