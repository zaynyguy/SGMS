const jwt = require('jsonwebtoken');
require('dotenv').config();

function authenticateJWT(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid token' });
  }
  try {
    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function authorizePermissions(required) {
  return (req, res, next) => {
    const perms = req.user?.permissions || [];
    const ok = required.some(r => perms.includes(r));
    if (!ok) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

module.exports = { authenticateJWT, authorizePermissions };
