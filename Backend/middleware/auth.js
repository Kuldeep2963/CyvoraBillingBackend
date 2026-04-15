const jwt = require('jsonwebtoken');
const User = require('../models/User');

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;

const auth = async (req, res, next) => {
  const authHeader = req.header('Authorization') || req.header('authorization');

  // Accept both "Bearer <token>" and raw token values.
  if (!authHeader) {
    return res.status(401).json({ error: 'No token, authorization denied' });
  }

  const bearerPrefix = /^Bearer\s+/i;
  const token = bearerPrefix.test(authHeader)
    ? authHeader.replace(bearerPrefix, '').trim()
    : authHeader.trim();

  if (!token) {
    return res.status(401).json({ error: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);

    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'role', 'first_name', 'last_name', 'tokenVersion'],
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found for token' });
    }

    // Any logout/password security event can invalidate all previously issued tokens.
    if (Number(decoded.tv) !== Number(user.tokenVersion || 0)) {
      return res.status(401).json({ error: 'Session expired, please login again' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      tv: user.tokenVersion || 0,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired, please login again' });
    }

    console.error('Auth token verification failed:', err.message);
    return res.status(401).json({ error: 'Token is not valid' });
  }
};

module.exports = auth;
