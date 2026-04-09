const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
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
