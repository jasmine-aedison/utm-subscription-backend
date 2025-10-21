const { verifyIdToken } = require('../config/firebase');
const { logger } = require('../utils/logger');

// Firebase token verification middleware
const firebaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No valid authorization header provided'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    if (!idToken) {
      return res.status(401).json({
        success: false,
        error: 'No Firebase ID token provided'
      });
    }

    // Verify the Firebase ID token
    const decodedToken = await verifyIdToken(idToken);
    
    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      name: decodedToken.name,
      picture: decodedToken.picture,
      firebaseUid: decodedToken.uid
    };

    logger.info(`✅ Authenticated user: ${decodedToken.uid}`);
    next();
  } catch (error) {
    logger.error('❌ Firebase authentication failed:', error);
    
    if (error.message.includes('Invalid authentication token')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired authentication token'
      });
    }
    
    return res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Optional Firebase auth middleware (doesn't fail if no token)
const optionalFirebaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    if (!idToken) {
      req.user = null;
      return next();
    }

    // Verify the Firebase ID token
    const decodedToken = await verifyIdToken(idToken);
    
    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      name: decodedToken.name,
      picture: decodedToken.picture,
      firebaseUid: decodedToken.uid
    };

    logger.info(`✅ Authenticated user: ${decodedToken.uid}`);
    next();
  } catch (error) {
    logger.warn('⚠️ Optional Firebase authentication failed:', error.message);
    req.user = null;
    next();
  }
};

module.exports = {
  firebaseAuth,
  optionalFirebaseAuth
};
