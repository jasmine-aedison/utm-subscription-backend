const { verifyIdToken } = require('../config/firebase');
const { logger } = require('../utils/logger');

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify Firebase ID token
    const decodedToken = await verifyIdToken(token);
    
    // Add user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
      hasActiveSubscription: decodedToken.hasActiveSubscription || false,
      canAccessWindows: decodedToken.canAccessWindows || false
    };

    next();
  } catch (error) {
    logger.error('❌ Authentication failed:', error);
    res.status(401).json({ 
      error: 'Invalid or expired token',
      message: error.message 
    });
  }
};

// Authorization middleware - requires active subscription
const requireSubscription = (req, res, next) => {
  if (!req.user.hasActiveSubscription) {
    return res.status(403).json({ 
      error: 'Active subscription required',
      message: 'You need an active subscription to access this feature'
    });
  }
  next();
};

// Authorization middleware - requires Windows access
const requireWindowsAccess = (req, res, next) => {
  if (!req.user.canAccessWindows) {
    return res.status(403).json({ 
      error: 'Windows access required',
      message: 'You need an active subscription to access Windows VMs'
    });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireSubscription,
  requireWindowsAccess
};
