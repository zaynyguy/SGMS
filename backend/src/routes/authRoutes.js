const express = require("express");
const router = express.Router();
const {
  login,
  refreshToken,
  logout,
} = require("../controllers/authController");
const { loginLimiter } = require("../middleware/rateLimiter");
const { validate, authLogin } = require("../utils/validator");
router.use(loginLimiter);

router.post("/login", loginLimiter, validate(authLogin), login);
router.post("/refresh", refreshToken);
router.post("/logout", logout);

module.exports = router;
