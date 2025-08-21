const jwt = require('jsonwebtoken');
require('dotenv').config();

// Authenticates a user using a JWT from the request header.
exports.authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token is required.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired. Please log in again.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    console.error('JWT verification error:', error);
    return res.status(401).json({ message: 'Failed to authenticate token.' });
  }
};

// Checks if the user has at least one of the required permissions.
exports.authorizePermissions = (requiredPermissions) => {
  return (req, res, next) => {
    const userPermissions = req.user.permissions;

    if (!userPermissions || !Array.isArray(userPermissions)) {
      return res.status(403).json({ message: 'Access forbidden. Insufficient permissions.' });
    }

    const hasPermission = requiredPermissions.some(permission =>
      userPermissions.includes(permission)
    );

    if (hasPermission) {
      next();
    } else {
      return res.status(403).json({ message: 'Access forbidden. You do not have the required permissions.' });
    }
  };
};

// Checks if the authenticated user is the resource owner.
exports.authorizeResourceOwner = (req, res, next) => {
  const resourceId = req.params.id || req.params.userId;
  const userIdFromToken = req.user.id;

  if (resourceId && parseInt(resourceId) === userIdFromToken) {
    next();
  } else {
    return res.status(403).json({ message: 'Access forbidden. You can only manage your own resources.' });
  }
};