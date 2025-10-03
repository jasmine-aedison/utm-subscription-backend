const express = require('express');
const { createSubscription, getSubscription, cancelSubscription, createPaymentIntent, createSetupIntent } = require('../config/stripe');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { logger } = require('../utils/logger');
const { validateSubscriptionRequest } = require('../middleware/validation');

const router = express.Router();

// Get user's subscription
router.get('/me', async (req, res) => {
  try {
    const { uid } = req.user;
    
    const user = await User.getByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscription = await Subscription.getActiveByUserId(uid);
    
    res.json({
      success: true,
      subscription: subscription ? subscription.toPublicJSON() : null,
      hasActiveSubscription: user.hasActiveSubscription(),
      subscriptionStatus: user.getSubscriptionStatus(),
      daysUntilExpiry: user.getDaysUntilExpiry()
    });

  } catch (error) {
    logger.error('❌ Failed to get subscription:', error);
    res.status(500).json({ 
      error: 'Failed to get subscription',
      message: error.message 
    });
  }
});

// Create new subscription
router.post('/create', validateSubscriptionRequest, async (req, res) => {
  try {
    const { uid } = req.user;
    const { plan, paymentMethodId } = req.body;
    
    const user = await User.getByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: 'Stripe customer not found' });
    }

    // Check if user already has an active subscription
    const existingSubscription = await Subscription.getActiveByUserId(uid);
    if (existingSubscription) {
      return res.status(400).json({ 
        error: 'User already has an active subscription',
        subscription: existingSubscription.toPublicJSON()
      });
    }

    // Get plan price ID
    const priceIds = {
      'monthly': process.env.STRIPE_MONTHLY_PRICE_ID,
      'yearly': process.env.STRIPE_YEARLY_PRICE_ID,
      'lifetime': process.env.STRIPE_LIFETIME_PRICE_ID
    };

    const priceId = priceIds[plan];
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    // Create Stripe subscription
    const stripeSubscription = await createSubscription(
      user.stripeCustomerId,
      priceId,
      {
        userId: uid,
        plan: plan,
        source: 'utm_app'
      }
    );

    // Create subscription in our database
    const subscriptionData = {
      userId: uid,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: user.stripeCustomerId,
      plan: plan,
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      metadata: {
        source: 'utm_app',
        plan: plan
      }
    };

    const subscription = await Subscription.create(subscriptionData);

    // Update user's subscription
    await user.updateSubscription({
      id: subscription.id,
      plan: plan,
      status: subscription.status,
      expiresAt: subscription.currentPeriodEnd,
      stripeSubscriptionId: stripeSubscription.id
    });

    res.json({
      success: true,
      subscription: subscription.toPublicJSON(),
      stripeSubscription: {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        clientSecret: stripeSubscription.latest_invoice?.payment_intent?.client_secret
      }
    });

  } catch (error) {
    logger.error('❌ Failed to create subscription:', error);
    res.status(500).json({ 
      error: 'Failed to create subscription',
      message: error.message 
    });
  }
});

// Cancel subscription
router.post('/cancel', async (req, res) => {
  try {
    const { uid } = req.user;
    const { immediately = false } = req.body;
    
    const user = await User.getByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscription = await Subscription.getActiveByUserId(uid);
    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Cancel Stripe subscription
    await cancelSubscription(subscription.stripeSubscriptionId, immediately);

    // Update subscription in our database
    await subscription.cancel();

    // Update user's subscription
    await user.updateSubscription({
      ...user.subscription,
      status: immediately ? 'cancelled' : 'cancelled',
      cancelledAt: new Date()
    });

    res.json({
      success: true,
      message: immediately ? 'Subscription cancelled immediately' : 'Subscription will be cancelled at the end of the current period',
      subscription: subscription.toPublicJSON()
    });

  } catch (error) {
    logger.error('❌ Failed to cancel subscription:', error);
    res.status(500).json({ 
      error: 'Failed to cancel subscription',
      message: error.message 
    });
  }
});

// Create payment intent for lifetime license
router.post('/lifetime-payment', async (req, res) => {
  try {
    const { uid } = req.user;
    const { amount, currency = 'usd' } = req.body;
    
    const user = await User.getByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: 'Stripe customer not found' });
    }

    // Create payment intent
    const paymentIntent = await createPaymentIntent(
      amount,
      currency,
      user.stripeCustomerId,
      {
        userId: uid,
        type: 'lifetime_license',
        source: 'utm_app'
      }
    );

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    logger.error('❌ Failed to create lifetime payment:', error);
    res.status(500).json({ 
      error: 'Failed to create lifetime payment',
      message: error.message 
    });
  }
});

// Create setup intent for saving payment methods
router.post('/setup-payment-method', async (req, res) => {
  try {
    const { uid } = req.user;
    
    const user = await User.getByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: 'Stripe customer not found' });
    }

    // Create setup intent
    const setupIntent = await createSetupIntent(
      user.stripeCustomerId,
      {
        userId: uid,
        source: 'utm_app'
      }
    );

    res.json({
      success: true,
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id
    });

  } catch (error) {
    logger.error('❌ Failed to create setup intent:', error);
    res.status(500).json({ 
      error: 'Failed to create setup intent',
      message: error.message 
    });
  }
});

// Redeem license key
router.post('/redeem-license', async (req, res) => {
  try {
    const { uid } = req.user;
    const { licenseKey } = req.body;
    
    if (!licenseKey) {
      return res.status(400).json({ error: 'License key is required' });
    }

    const user = await User.getByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // TODO: Implement license key validation
    // This would typically involve checking against a database of valid license keys
    // For now, we'll simulate a successful redemption
    
    const isValidLicense = await validateLicenseKey(licenseKey);
    if (!isValidLicense) {
      return res.status(400).json({ error: 'Invalid license key' });
    }

    // Create lifetime subscription
    const subscriptionData = {
      userId: uid,
      stripeSubscriptionId: null, // No Stripe subscription for license keys
      stripeCustomerId: user.stripeCustomerId,
      plan: 'lifetime',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // 100 years
      cancelAtPeriodEnd: false,
      metadata: {
        source: 'license_key',
        licenseKey: licenseKey,
        redeemedAt: new Date()
      }
    };

    const subscription = await Subscription.create(subscriptionData);

    // Update user's subscription
    await user.updateSubscription({
      id: subscription.id,
      plan: 'lifetime',
      status: 'active',
      expiresAt: subscription.currentPeriodEnd,
      licenseKey: licenseKey
    });

    res.json({
      success: true,
      message: 'License key redeemed successfully',
      subscription: subscription.toPublicJSON()
    });

  } catch (error) {
    logger.error('❌ Failed to redeem license key:', error);
    res.status(500).json({ 
      error: 'Failed to redeem license key',
      message: error.message 
    });
  }
});

// Helper function to validate license key
async function validateLicenseKey(licenseKey) {
  // TODO: Implement actual license key validation
  // This could involve checking against a database, external API, or cryptographic validation
  
  // For now, simulate validation with a simple pattern
  const licensePattern = /^UTM-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/;
  return licensePattern.test(licenseKey);
}

module.exports = router;
