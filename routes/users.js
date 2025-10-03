const express = require('express');
const User = require('../models/User');
const { logger } = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const { uid } = req.user;
    
    const user = await User.getByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: user.toPublicJSON()
    });

  } catch (error) {
    logger.error('❌ Failed to get user profile:', error);
    res.status(500).json({ 
      error: 'Failed to get user profile',
      message: error.message 
    });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const { uid } = req.user;
    const { displayName, photoURL } = req.body;
    
    const user = await User.getByUid(uid);
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
    logger.error('❌ Failed to update user profile:', error);
    res.status(500).json({ 
      error: 'Failed to update user profile',
      message: error.message 
    });
  }
});

// Get user's subscription history
router.get('/subscription-history', async (req, res) => {
  try {
    const { uid } = req.user;
    
    const user = await User.getByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // TODO: Implement subscription history retrieval
    // This would typically involve querying the subscriptions collection
    // and returning a paginated list of subscription events

    res.json({
      success: true,
      history: [] // Placeholder for now
    });

  } catch (error) {
    logger.error('❌ Failed to get subscription history:', error);
    res.status(500).json({ 
      error: 'Failed to get subscription history',
      message: error.message 
    });
  }
});

// Get user's payment methods
router.get('/payment-methods', async (req, res) => {
  try {
    const { uid } = req.user;
    
    const user = await User.getByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.stripeCustomerId) {
      return res.json({
        success: true,
        paymentMethods: []
      });
    }

    // TODO: Implement payment methods retrieval from Stripe
    // This would involve calling the Stripe API to get saved payment methods

    res.json({
      success: true,
      paymentMethods: [] // Placeholder for now
    });

  } catch (error) {
    logger.error('❌ Failed to get payment methods:', error);
    res.status(500).json({ 
      error: 'Failed to get payment methods',
      message: error.message 
    });
  }
});

// Delete user account
router.delete('/account', async (req, res) => {
  try {
    const { uid } = req.user;
    
    const user = await User.getByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // TODO: Implement account deletion
    // This would involve:
    // 1. Cancelling active subscriptions
    // 2. Deleting Stripe customer
    // 3. Deleting user data from Firestore
    // 4. Sending confirmation email

    res.json({
      success: true,
      message: 'Account deletion initiated. You will receive a confirmation email.'
    });

  } catch (error) {
    logger.error('❌ Failed to delete account:', error);
    res.status(500).json({ 
      error: 'Failed to delete account',
      message: error.message 
    });
  }
});

module.exports = router;
