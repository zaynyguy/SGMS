// File: backend/src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header is required.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Access token is missing or invalid.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
      }
      return res.status(403).json({ message: 'Forbidden: Invalid token.' });
    }
    req.user = user; // This payload contains { id, username, name, role, permissions }
    next();
  });
};

exports.authorizePermissions = (requiredPermissions) => {
  return (req, res, next) => {
    const userPermissions = req.user?.permissions || [];
    const hasPermission = requiredPermissions.some(requiredPerm => userPermissions.includes(requiredPerm));

    // A simplified check for a 'super admin' permission, if you have one
    const isSuperAdmin = userPermissions.includes('manage:all');

    if (hasPermission || isSuperAdmin) {
      next();
    } else {
      res.status(403).json({ message: 'Forbidden: You do not have the necessary permissions to perform this action.' });
    }
  };
};