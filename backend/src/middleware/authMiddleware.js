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
        return res.status(401).json({ message: 'Session expired. Please log in again.' });
      }
      return res.status(403).json({ message: 'Forbidden: Invalid token.' });
    }

    req.user = user; // Contains { id, username, name, role, permissions }
    next();
  });
};

exports.authorizePermissions = (requiredPermissions) => (req, res, next) => {
  const userPermissions = req.user?.permissions || [];
  const isSuperAdmin = userPermissions.includes('manage:all');

  const hasPermission = requiredPermissions.some(perm => userPermissions.includes(perm));

  if (hasPermission || isSuperAdmin) {
    return next();
  }

  res.status(403).json({ message: 'Forbidden: You lack necessary permissions.' });
};
