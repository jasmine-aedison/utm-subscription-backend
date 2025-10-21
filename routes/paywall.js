const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const { supabase } = require('../src/lib/supabase');
const { stripe } = require('../config/stripe');
const { firebaseAuth, optionalFirebaseAuth } = require('../middleware/firebaseAuth');
const { logger } = require('../utils/logger');

const Device = require('../models/Device');
const UserSubscription = require('../models/UserSubscription');
const LicenseKey = require('../models/LicenseKey');
const StripePlan = require('../models/StripePlan');

const router = express.Router();

// Rate limiting for sensitive endpoints
const trialRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many trial requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const licenseRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: 'Too many license redemption attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Validation schemas
const startGuestTrialSchema = Joi.object({
  device_id: Joi.string().required().min(1).max(255)
});

const checkSubscriptionSchema = Joi.object({
  guest_id: Joi.string().uuid().optional(),
  id_token: Joi.string().optional()
});

const createCheckoutSessionSchema = Joi.object({
  guest_id: Joi.string().uuid().optional(),
  price_id: Joi.string().required(),
  cancel_url: Joi.string().uri().required(),
  success_url: Joi.string().uri().required(),
  customer_email: Joi.string().email().optional(),
  uid: Joi.string().optional()
});

const redeemLicenseSchema = Joi.object({
  key: Joi.string().required().min(1).max(255),
  guest_id: Joi.string().uuid().optional(),
  id_token: Joi.string().optional()
});

const linkGuestSchema = Joi.object({
  guest_id: Joi.string().uuid().required()
});

// POST /api/start-guest-trial
router.post('/start-guest-trial', trialRateLimit, async (req, res) => {
  try {
    // Validate request
    const { error, value } = startGuestTrialSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { device_id } = value;

    // Check if device already exists
    let device = await Device.getByDeviceId(device_id);
    
    if (device) {
      // Device exists, return existing trial info
      return res.json({
        success: true,
        ...device.toPublicJSON()
      });
    }

    // Create new device with trial
    device = await Device.create(device_id);
    
    // Create user subscription for the trial
    await UserSubscription.create({
      device_id: device.id,
      status: 'trial',
      trial_start: device.trialStart,
      trial_end: device.trialEnd
    });

    logger.info(`✅ Started guest trial for device: ${device_id}`);

    res.json({
      success: true,
      ...device.toPublicJSON()
    });
  } catch (error) {
    logger.error('❌ Failed to start guest trial:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start guest trial'
    });
  }
});

// GET /api/check-subscription
router.get('/check-subscription', optionalFirebaseAuth, async (req, res) => {
  try {
    const { guest_id } = req.query;
    const { uid } = req.user || {};

    let subscription = null;

    if (uid) {
      // Authenticated user - check by UID
      subscription = await UserSubscription.getByUid(uid);
    } else if (guest_id) {
      // Guest user - check by guest ID
      const device = await Device.getById(guest_id);
      if (device) {
        subscription = await UserSubscription.getByDeviceId(device.id);
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either guest_id or Firebase authentication required'
      });
    }

    if (!subscription) {
      return res.json({
        success: true,
        status: 'none',
        plan: null,
        trialStart: null,
        trialEnd: null,
        licenseKey: null
      });
    }

    // Get plan info if available
    let plan = null;
    if (subscription.planId) {
      plan = await StripePlan.getByPlanKey(subscription.planId);
    }

    res.json({
      success: true,
      status: subscription.getSubscriptionStatus(),
      plan: plan ? plan.toPublicJSON() : null,
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      licenseKey: subscription.planId && subscription.planId.startsWith('license_') ? {
        plan_id: subscription.planId,
        expires_at: null // License keys don't have expiry in subscription
      } : null
    });
  } catch (error) {
    logger.error('❌ Failed to check subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check subscription status'
    });
  }
});

// GET /api/plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await StripePlan.getAll();
    
    res.json({
      success: true,
      plans: plans.map(plan => plan.toPublicJSON())
    });
  } catch (error) {
    logger.error('❌ Failed to get plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get plans'
    });
  }
});

// POST /api/create-checkout-session
router.post('/create-checkout-session', async (req, res) => {
  try {
    // Validate request
    const { error, value } = createCheckoutSessionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { guest_id, price_id, cancel_url, success_url, customer_email, uid } = value;

    // Verify price_id exists in our plans
    const plan = await StripePlan.getByStripePriceId(price_id);
    if (!plan) {
      return res.status(400).json({
        success: false,
        error: 'Invalid price ID'
      });
    }

    let customerId = null;
    let metadata = {};

    if (uid) {
      // Authenticated user - find or create customer
      const subscription = await UserSubscription.getByUid(uid);
      if (subscription && subscription.stripeCustomerId) {
        customerId = subscription.stripeCustomerId;
      } else {
        // Create new customer
        const customer = await stripe.customers.create({
          email: customer_email,
          metadata: { uid, source: 'utm_app' }
        });
        customerId = customer.id;
      }
      metadata.uid = uid;
    } else if (guest_id) {
      // Guest user
      metadata.guest_id = guest_id;
      
      // Create customer for guest
      const customer = await stripe.customers.create({
        email: customer_email,
        metadata: { guest_id, source: 'utm_app' }
      });
      customerId = customer.id;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either uid or guest_id required'
      });
    }

    // Determine trial end date if applicable
    let trialEnd = null;
    if (guest_id) {
      const device = await Device.getById(guest_id);
      if (device && device.isTrialActive()) {
        trialEnd = Math.floor(new Date(device.trialEnd).getTime() / 1000);
      }
    } else if (uid) {
      const subscription = await UserSubscription.getByUid(uid);
      if (subscription && subscription.isTrial()) {
        trialEnd = Math.floor(new Date(subscription.trialEnd).getTime() / 1000);
      }
    }

    // Create checkout session
    const sessionConfig = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: price_id,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: success_url,
      cancel_url: cancel_url,
      metadata
    };

    // Add trial end if applicable
    if (trialEnd) {
      sessionConfig.subscription_data = {
        trial_end: trialEnd
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    logger.info(`✅ Created checkout session: ${session.id}`);

    res.json({
      success: true,
      checkoutUrl: session.url
    });
  } catch (error) {
    logger.error('❌ Failed to create checkout session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session'
    });
  }
});

// POST /api/redeem-license
router.post('/redeem-license', licenseRateLimit, async (req, res) => {
  try {
    // Validate request
    const { error, value } = redeemLicenseSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { key, guest_id, id_token } = value;
    const { uid } = req.user || {};

    // Get license key
    const licenseKey = await LicenseKey.getByKey(key);
    if (!licenseKey) {
      return res.status(400).json({
        success: false,
        error: 'Invalid license key'
      });
    }

    // Check if license key is valid for redemption
    if (!licenseKey.isValidForRedemption()) {
      return res.status(400).json({
        success: false,
        error: licenseKey.isRedeemed() ? 'License key has already been redeemed' : 'License key has expired'
      });
    }

    let boundUid = null;
    let boundDeviceId = null;

    if (uid) {
      // Authenticated user
      boundUid = uid;
    } else if (guest_id) {
      // Guest user
      const device = await Device.getById(guest_id);
      if (!device) {
        return res.status(400).json({
          success: false,
          error: 'Invalid guest ID'
        });
      }
      boundDeviceId = device.id;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either authentication or guest_id required'
      });
    }

    // Redeem license key
    await licenseKey.redeem(boundUid, boundDeviceId);

    // Create or update user subscription
    const subscriptionData = {
      plan_id: `license_${licenseKey.planId}`,
      status: 'active',
      trial_start: null,
      trial_end: null
    };

    if (boundUid) {
      subscriptionData.uid = boundUid;
    } else {
      subscriptionData.device_id = boundDeviceId;
    }

    await UserSubscription.create(subscriptionData);

    logger.info(`✅ Redeemed license key: ${key}`);

    res.json({
      success: true,
      ...licenseKey.toPublicJSON()
    });
  } catch (error) {
    logger.error('❌ Failed to redeem license:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to redeem license'
    });
  }
});

// POST /api/link-guest (authenticated)
router.post('/link-guest', firebaseAuth, async (req, res) => {
  try {
    // Validate request
    const { error, value } = linkGuestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { guest_id } = value;
    const { uid } = req.user;

    // Get device
    const device = await Device.getById(guest_id);
    if (!device) {
      return res.status(400).json({
        success: false,
        error: 'Invalid guest ID'
      });
    }

    // Check if device is already linked
    if (device.linkedUid) {
      return res.status(400).json({
        success: false,
        error: 'Device is already linked to an account'
      });
    }

    // Link device to UID
    await device.linkToUid(uid);

    // Get or create user subscription
    let subscription = await UserSubscription.getByUid(uid);
    if (!subscription) {
      // Create new subscription with trial info
      subscription = await UserSubscription.create({
        uid: uid,
        status: device.subscriptionStatus,
        trial_start: device.trialStart,
        trial_end: device.trialEnd
      });
    } else {
      // Update existing subscription with trial info if it doesn't have one
      if (!subscription.trialStart && device.trialStart) {
        await subscription.update({
          trial_start: device.trialStart,
          trial_end: device.trialEnd,
          status: device.subscriptionStatus
        });
      }
    }

    logger.info(`✅ Linked guest ${guest_id} to UID: ${uid}`);

    res.json({
      success: true,
      subscription: subscription.toPublicJSON()
    });
  } catch (error) {
    logger.error('❌ Failed to link guest:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to link guest to account'
    });
  }
});

// GET /api/my-subscription (authenticated)
router.get('/my-subscription', firebaseAuth, async (req, res) => {
  try {
    const { uid } = req.user;

    const subscription = await UserSubscription.getByUid(uid);
    if (!subscription) {
      return res.json({
        success: true,
        status: 'none',
        plan: null,
        trialStart: null,
        trialEnd: null
      });
    }

    // Get plan info if available
    let plan = null;
    if (subscription.planId) {
      plan = await StripePlan.getByPlanKey(subscription.planId);
    }

    res.json({
      success: true,
      status: subscription.getSubscriptionStatus(),
      plan: plan ? plan.toPublicJSON() : null,
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      isActive: subscription.isActive(),
      isTrial: subscription.isTrial(),
      trialDaysRemaining: subscription.getTrialDaysRemaining()
    });
  } catch (error) {
    logger.error('❌ Failed to get user subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription status'
    });
  }
});

module.exports = router;
