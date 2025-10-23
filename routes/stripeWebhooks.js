const express = require('express');
const { verifyWebhookSignature } = require('../config/stripe');
const { logger } = require('../utils/logger');

const UserSubscription = require('../models/UserSubscription');
const Device = require('../models/Device');

const router = express.Router();

// Test endpoint to verify webhook is reachable
router.get('/stripe/test', (req, res) => {
  logger.info('🧪 Webhook test endpoint hit');
  res.json({ 
    message: 'Webhook endpoint is working',
    timestamp: new Date().toISOString(),
    webhook_secret_configured: !!process.env.STRIPE_WEBHOOK_SECRET,
    webhook_secret_length: process.env.STRIPE_WEBHOOK_SECRET ? process.env.STRIPE_WEBHOOK_SECRET.length : 0,
    webhook_secret_prefix: process.env.STRIPE_WEBHOOK_SECRET ? process.env.STRIPE_WEBHOOK_SECRET.substring(0, 10) + '...' : 'Not set',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test endpoint that bypasses signature verification (for testing only)
router.post('/stripe/test', express.raw({ type: 'application/json' }), async (req, res) => {
  logger.info('🧪 Test webhook received (bypassing signature verification)');
  logger.info(`📦 Body length: ${req.body ? req.body.length : 'undefined'}`);
  
  try {
    // Parse the JSON manually for testing
    const event = JSON.parse(req.body.toString());
    logger.info(`✅ Test webhook event type: ${event.type}`);
    
    res.json({ 
      message: 'Test webhook processed successfully',
      event_type: event.type,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Test webhook parsing failed:', error);
    res.status(400).json({ error: 'Failed to parse test webhook' });
  }
});

// Stripe webhook handler - must use raw body parser
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;

  // Log webhook attempt
  logger.info('🔔 Stripe webhook received');
  logger.info(`📝 Headers: ${JSON.stringify(req.headers)}`);
  logger.info(`📦 Body length: ${req.body ? req.body.length : 'undefined'}`);
  logger.info(`🔑 Stripe signature header: ${req.headers['stripe-signature']}`);
  logger.info(`🔐 Webhook secret configured: ${process.env.STRIPE_WEBHOOK_SECRET ? 'Yes' : 'No'}`);
  logger.info(`🔐 Webhook secret length: ${process.env.STRIPE_WEBHOOK_SECRET ? process.env.STRIPE_WEBHOOK_SECRET.length : 'N/A'}`);
  logger.info(`🔐 Webhook secret starts with: ${process.env.STRIPE_WEBHOOK_SECRET ? process.env.STRIPE_WEBHOOK_SECRET.substring(0, 10) + '...' : 'N/A'}`);

  try {
    // Verify webhook signature
    event = verifyWebhookSignature(req.body, req.headers['stripe-signature']);
    logger.info(`✅ Received Stripe webhook: ${event.type}`);
  } catch (error) {
    logger.error('❌ Webhook signature verification failed:', error);
    logger.error(`🔍 Error details: ${error.message}`);
    logger.error(`🔍 Error type: ${error.constructor.name}`);
    logger.error(`🔍 Stripe signature: ${req.headers['stripe-signature']}`);
    logger.error(`🔍 Body type: ${typeof req.body}`);
    logger.error(`🔍 Body is Buffer: ${Buffer.isBuffer(req.body)}`);
    logger.error(`🔍 Body preview: ${req.body ? req.body.toString().substring(0, 100) + '...' : 'undefined'}`);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      default:
        logger.info(`ℹ️ Unhandled webhook event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('❌ Webhook processing failed:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle checkout session completed
async function handleCheckoutSessionCompleted(session) {
  try {
    const { metadata } = session;
    const { uid, guest_id } = metadata;

    if (!uid && !guest_id) {
      logger.warn('⚠️ Checkout session missing metadata uid or guest_id');
      return;
    }

    // Get or create customer
    let customerId = session.customer;
    let subscriptionData = {
      stripe_customer_id: customerId,
      stripe_subscription_id: session.subscription,
      plan_id: null, // Will be set when subscription is created
      status: 'active'
    };

    if (uid) {
      // Authenticated user
      let subscription = await UserSubscription.getByUid(uid);
      if (subscription) {
        await subscription.update(subscriptionData);
      } else {
        await UserSubscription.create({
          uid: uid,
          ...subscriptionData
        });
      }
    } else if (guest_id) {
      // Guest user
      const device = await Device.getById(guest_id);
      if (device) {
        let subscription = await UserSubscription.getByDeviceId(device.id);
        if (subscription) {
          await subscription.update(subscriptionData);
        } else {
          await UserSubscription.create({
            device_id: device.id,
            ...subscriptionData
          });
        }
      }
    }

    logger.info(`✅ Processed checkout session completed: ${session.id}`);
  } catch (error) {
    logger.error('❌ Failed to handle checkout session completed:', error);
    throw error;
  }
}

// Handle invoice payment succeeded
async function handleInvoicePaymentSucceeded(invoice) {
  try {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    const subscription = await UserSubscription.getByStripeSubscriptionId(subscriptionId);
    if (!subscription) {
      logger.warn(`⚠️ Subscription not found for Stripe subscription ID: ${subscriptionId}`);
      return;
    }

    // Update subscription status to active
    await subscription.updateStatus('active');

    logger.info(`✅ Processed invoice payment succeeded: ${invoice.id}`);
  } catch (error) {
    logger.error('❌ Failed to handle invoice payment succeeded:', error);
    throw error;
  }
}

// Handle invoice payment failed
async function handleInvoicePaymentFailed(invoice) {
  try {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    const subscription = await UserSubscription.getByStripeSubscriptionId(subscriptionId);
    if (!subscription) {
      logger.warn(`⚠️ Subscription not found for Stripe subscription ID: ${subscriptionId}`);
      return;
    }

    // Update subscription status to past_due
    await subscription.updateStatus('past_due');

    logger.info(`✅ Processed invoice payment failed: ${invoice.id}`);
  } catch (error) {
    logger.error('❌ Failed to handle invoice payment failed:', error);
    throw error;
  }
}

// Handle subscription created
async function handleSubscriptionCreated(stripeSubscription) {
  try {
    const subscriptionId = stripeSubscription.id;
    const customerId = stripeSubscription.customer;
    const priceId = stripeSubscription.items?.data?.[0]?.price?.id;

    if (!priceId) {
      logger.warn(`⚠️ No price ID found in subscription: ${subscriptionId}`);
      return;
    }

    // Get plan info
    const { StripePlan } = require('../models/StripePlan');
    const plan = await StripePlan.getByStripePriceId(priceId);
    if (!plan) {
      logger.warn(`⚠️ Plan not found for price ID: ${priceId}`);
      return;
    }

    // Find existing subscription by customer ID
    let subscription = await UserSubscription.getByStripeCustomerId(customerId);
    if (subscription) {
      // Update existing subscription
      await subscription.update({
        stripe_subscription_id: subscriptionId,
        plan_id: plan.planKey,
        status: 'active'
      });
    } else {
      // Create new subscription (this shouldn't happen normally)
      logger.warn(`⚠️ No existing subscription found for customer: ${customerId}`);
    }

    logger.info(`✅ Processed subscription created: ${subscriptionId}`);
  } catch (error) {
    logger.error('❌ Failed to handle subscription created:', error);
    throw error;
  }
}

// Handle subscription updated
async function handleSubscriptionUpdated(stripeSubscription) {
  try {
    const subscriptionId = stripeSubscription.id;
    const status = stripeSubscription.status;

    const subscription = await UserSubscription.getByStripeSubscriptionId(subscriptionId);
    if (!subscription) {
      logger.warn(`⚠️ Subscription not found for Stripe subscription ID: ${subscriptionId}`);
      return;
    }

    // Map Stripe status to our status
    let mappedStatus = 'active';
    switch (status) {
      case 'active':
        mappedStatus = 'active';
        break;
      case 'past_due':
        mappedStatus = 'past_due';
        break;
      case 'canceled':
      case 'cancelled':
        mappedStatus = 'canceled';
        break;
      case 'incomplete':
      case 'incomplete_expired':
        mappedStatus = 'expired';
        break;
      case 'trialing':
        mappedStatus = 'trial';
        break;
      case 'unpaid':
        mappedStatus = 'expired';
        break;
      default:
        mappedStatus = 'expired';
    }

    await subscription.updateStatus(mappedStatus);

    logger.info(`✅ Processed subscription updated: ${subscriptionId} -> ${mappedStatus}`);
  } catch (error) {
    logger.error('❌ Failed to handle subscription updated:', error);
    throw error;
  }
}

// Handle subscription deleted
async function handleSubscriptionDeleted(stripeSubscription) {
  try {
    const subscriptionId = stripeSubscription.id;

    const subscription = await UserSubscription.getByStripeSubscriptionId(subscriptionId);
    if (!subscription) {
      logger.warn(`⚠️ Subscription not found for Stripe subscription ID: ${subscriptionId}`);
      return;
    }

    // Update subscription status to canceled
    await subscription.updateStatus('canceled');

    logger.info(`✅ Processed subscription deleted: ${subscriptionId}`);
  } catch (error) {
    logger.error('❌ Failed to handle subscription deleted:', error);
    throw error;
  }
}

module.exports = router;
