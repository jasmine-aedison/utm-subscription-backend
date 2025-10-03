const admin = require('firebase-admin');
const { logger } = require('../utils/logger');

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  try {
    // Check if Firebase is already initialized
    if (admin.apps.length > 0) {
      return admin.app();
    }

    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });

    logger.info('✅ Firebase Admin SDK initialized successfully');
    return admin.app();
  } catch (error) {
    logger.error('❌ Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
};

// Get Firestore instance
const getFirestore = () => {
  const app = initializeFirebase();
  return admin.firestore(app);
};

// Get Auth instance
const getAuth = () => {
  const app = initializeFirebase();
  return admin.auth(app);
};

// Verify Firebase ID token
const verifyIdToken = async (idToken) => {
  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    logger.error('❌ Failed to verify Firebase ID token:', error);
    throw new Error('Invalid authentication token');
  }
};

// Create custom token
const createCustomToken = async (uid, additionalClaims = {}) => {
  try {
    const auth = getAuth();
    const customToken = await auth.createCustomToken(uid, additionalClaims);
    return customToken;
  } catch (error) {
    logger.error('❌ Failed to create custom token:', error);
    throw error;
  }
};

// Get user by UID
const getUser = async (uid) => {
  try {
    const auth = getAuth();
    const userRecord = await auth.getUser(uid);
    return userRecord;
  } catch (error) {
    logger.error('❌ Failed to get user:', error);
    throw error;
  }
};

// Update user claims
const setCustomUserClaims = async (uid, claims) => {
  try {
    const auth = getAuth();
    await auth.setCustomUserClaims(uid, claims);
    logger.info(`✅ Updated custom claims for user ${uid}`);
  } catch (error) {
    logger.error('❌ Failed to set custom user claims:', error);
    throw error;
  }
};

module.exports = {
  initializeFirebase,
  getFirestore,
  getAuth,
  verifyIdToken,
  createCustomToken,
  getUser,
  setCustomUserClaims
};
