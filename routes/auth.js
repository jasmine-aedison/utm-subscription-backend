const express = require('express');
const { verifyIdToken, createCustomToken, getUser, setCustomUserClaims } = require('../config/firebase');
const PostgresUser = require('../models/PostgresUser');
const { createCustomer } = require('../config/stripe');
const { logger } = require('../utils/logger');
const { validateAuthRequest } = require('../middleware/validation');

const router = express.Router();

// Verify Firebase token and get/create user
router.post('/verify', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    // Verify Firebase ID token
    const decodedToken = await verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // Check if user exists in our database
    let user = await PostgresUser.getByUid(uid);
    
    if (!user) {
      // Create new user
      const userData = {
        uid,
        email,
        displayName: name,
        photoURL: picture
      };
      
      user = await PostgresUser.create(userData);
      
      // Create Stripe customer
      try {
        const customer = await createCustomer(email, name, {
          uid: uid,
          source: 'utm_app'
        });
        
        await user.setStripeCustomerId(customer.id);
        logger.info(`✅ Created Stripe customer for new user: ${uid}`);
      } catch (stripeError) {
        logger.error('⚠️ Failed to create Stripe customer:', stripeError);
        // Continue without Stripe customer for now
      }
    }

    // Set custom claims for subscription status
    const hasActiveSubscription = user.hasActiveSubscription();
    await setCustomUserClaims(uid, {
      hasActiveSubscription,
      canAccessWindows: hasActiveSubscription,
      subscriptionStatus: user.getSubscriptionStatus()
    });

    // Create custom token with claims
    const customToken = await createCustomToken(uid, {
      hasActiveSubscription,
      canAccessWindows: hasActiveSubscription
    });

    res.json({
      success: true,
      user: user.toPublicJSON(),
      customToken
    });

  } catch (error) {
    logger.error('❌ Auth verification failed:', error);
    res.status(401).json({ 
      error: 'Authentication failed',
      message: error.message 
    });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const { uid } = req.user; // Set by auth middleware
    
    const user = await PostgresUser.getByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: user.toPublicJSON()
    });

  } catch (error) {
    logger.error('❌ Failed to get user:', error);
    res.status(500).json({ 
      error: 'Failed to get user',
      message: error.message 
    });
  }
});

// Update user profile
router.put('/me', async (req, res) => {
  try {
    const { uid } = req.user;
    const { displayName, photoURL } = req.body;
    
    const user = await PostgresUser.getByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (photoURL !== undefined) updateData.photoURL = photoURL;

    await user.update(updateData);

    res.json({
      success: true,
      user: user.toPublicJSON()
    });

  } catch (error) {
    logger.error('❌ Failed to update user:', error);
    res.status(500).json({ 
      error: 'Failed to update user',
      message: error.message 
    });
  }
});

// Delete user account
router.delete('/me', async (req, res) => {
  try {
    const { uid } = req.user;
    
    const user = await PostgresUser.getByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // TODO: Cancel active subscriptions
    // TODO: Delete Stripe customer
    // TODO: Delete user data from Firestore

    res.json({
      success: true,
      message: 'Account deletion initiated'
    });

  } catch (error) {
    logger.error('❌ Failed to delete user:', error);
    res.status(500).json({ 
      error: 'Failed to delete user',
      message: error.message 
    });
  }
});

// Refresh user claims
router.post('/refresh-claims', async (req, res) => {
  try {
    const { uid } = req.user;
    
    const user = await PostgresUser.getByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update custom claims
    const hasActiveSubscription = user.hasActiveSubscription();
    await setCustomUserClaims(uid, {
      hasActiveSubscription,
      canAccessWindows: hasActiveSubscription,
      subscriptionStatus: user.getSubscriptionStatus()
    });

    res.json({
      success: true,
      hasActiveSubscription,
      canAccessWindows: hasActiveSubscription,
      subscriptionStatus: user.getSubscriptionStatus()
    });

  } catch (error) {
    logger.error('❌ Failed to refresh claims:', error);
    res.status(500).json({ 
      error: 'Failed to refresh claims',
      message: error.message 
    });
  }
});

module.exports = router;
