const express = require('express');
const router = express.Router();
const { login, refreshToken, logout } = require('../controllers/authController');
const { loginLimiter } = require('../middleware/rateLimiter');
router.use(loginLimiter)

router.post('/login', loginLimiter, login);
router.post('/refresh', refreshToken); 
router.post('/logout', logout);

module.exports = router;
