const express = require('express');
const { verifyWebhookSignature } = require('../config/stripe');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { logger } = require('../utils/logger');

const router = express.Router();

// Stripe webhook endpoint
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const payload = req.body;

    // Verify webhook signature
    const event = verifyWebhookSignature(payload, signature);
    
    logger.info(`📨 Received Stripe webhook: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
        
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object);
        break;
        
      default:
        logger.info(`⚠️ Unhandled webhook event type: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    logger.error('❌ Webhook processing failed:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// Handle subscription created
async function handleSubscriptionCreated(subscription) {
  try {
    const { id, customer, status, current_period_start, current_period_end, cancel_at_period_end } = subscription;
    
    // Find user by Stripe customer ID
    const user = await User.getByEmail(subscription.customer_email) || 
                 await findUserByStripeCustomerId(customer);
    
    if (!user) {
      logger.error(`❌ User not found for Stripe customer: ${customer}`);
      return;
    }

    // Create subscription in our database
    const subscriptionData = {
      userId: user.uid,
      stripeSubscriptionId: id,
      stripeCustomerId: customer,
      plan: getPlanFromSubscription(subscription),
      status: status,
      currentPeriodStart: new Date(current_period_start * 1000),
      currentPeriodEnd: new Date(current_period_end * 1000),
      cancelAtPeriodEnd: cancel_at_period_end,
      metadata: {
        source: 'stripe_webhook',
        createdVia: 'webhook'
      }
    };

    const newSubscription = await Subscription.create(subscriptionData);

    // Update user's subscription
    await user.updateSubscription({
      id: newSubscription.id,
      plan: newSubscription.plan,
      status: newSubscription.status,
      expiresAt: newSubscription.currentPeriodEnd,
      stripeSubscriptionId: id
    });

    logger.info(`✅ Created subscription for user: ${user.uid}`);

  } catch (error) {
    logger.error('❌ Failed to handle subscription created:', error);
  }
}

// Handle subscription updated
async function handleSubscriptionUpdated(subscription) {
  try {
    const { id, status, current_period_start, current_period_end, cancel_at_period_end } = subscription;
    
    // Find existing subscription
    const existingSubscription = await Subscription.getByStripeSubscriptionId(id);
    if (!existingSubscription) {
      logger.error(`❌ Subscription not found: ${id}`);
      return;
    }

    // Update subscription
    await existingSubscription.update({
      status: status,
      currentPeriodStart: new Date(current_period_start * 1000),
      currentPeriodEnd: new Date(current_period_end * 1000),
      cancelAtPeriodEnd: cancel_at_period_end
    });

    // Update user's subscription
    const user = await User.getByUid(existingSubscription.userId);
    if (user) {
      await user.updateSubscription({
        ...user.subscription,
        status: status,
        expiresAt: existingSubscription.currentPeriodEnd
      });
    }

    logger.info(`✅ Updated subscription: ${id}`);

  } catch (error) {
    logger.error('❌ Failed to handle subscription updated:', error);
  }
}

// Handle subscription deleted
async function handleSubscriptionDeleted(subscription) {
  try {
    const { id } = subscription;
    
    // Find existing subscription
    const existingSubscription = await Subscription.getByStripeSubscriptionId(id);
    if (!existingSubscription) {
      logger.error(`❌ Subscription not found: ${id}`);
      return;
    }

    // Cancel subscription
    await existingSubscription.cancel();

    // Update user's subscription
    const user = await User.getByUid(existingSubscription.userId);
    if (user) {
      await user.updateSubscription({
        ...user.subscription,
        status: 'cancelled',
        cancelledAt: new Date()
      });
    }

    logger.info(`✅ Cancelled subscription: ${id}`);

  } catch (error) {
    logger.error('❌ Failed to handle subscription deleted:', error);
  }
}

// Handle payment succeeded
async function handlePaymentSucceeded(invoice) {
  try {
    const { subscription, customer } = invoice;
    
    if (!subscription) {
      return; // Not a subscription invoice
    }

    // Find subscription
    const existingSubscription = await Subscription.getByStripeSubscriptionId(subscription);
    if (!existingSubscription) {
      logger.error(`❌ Subscription not found: ${subscription}`);
      return;
    }

    // Update subscription status to active
    await existingSubscription.update({ status: 'active' });

    // Update user's subscription
    const user = await User.getByUid(existingSubscription.userId);
    if (user) {
      await user.updateSubscription({
        ...user.subscription,
        status: 'active'
      });
    }

    logger.info(`✅ Payment succeeded for subscription: ${subscription}`);

  } catch (error) {
    logger.error('❌ Failed to handle payment succeeded:', error);
  }
}

// Handle payment failed
async function handlePaymentFailed(invoice) {
  try {
    const { subscription, customer } = invoice;
    
    if (!subscription) {
      return; // Not a subscription invoice
    }

    // Find subscription
    const existingSubscription = await Subscription.getByStripeSubscriptionId(subscription);
    if (!existingSubscription) {
      logger.error(`❌ Subscription not found: ${subscription}`);
      return;
    }

    // Update subscription status to past_due
    await existingSubscription.update({ status: 'past_due' });

    // Update user's subscription
    const user = await User.getByUid(existingSubscription.userId);
    if (user) {
      await user.updateSubscription({
        ...user.subscription,
        status: 'past_due'
      });
    }

    logger.info(`⚠️ Payment failed for subscription: ${subscription}`);

  } catch (error) {
    logger.error('❌ Failed to handle payment failed:', error);
  }
}

// Handle trial will end
async function handleTrialWillEnd(subscription) {
  try {
    const { id, customer } = subscription;
    
    // Find subscription
    const existingSubscription = await Subscription.getByStripeSubscriptionId(id);
    if (!existingSubscription) {
      logger.error(`❌ Subscription not found: ${id}`);
      return;
    }

    // Update user's subscription
    const user = await User.getByUid(existingSubscription.userId);
    if (user) {
      // TODO: Send notification to user about trial ending
      logger.info(`⚠️ Trial ending soon for user: ${user.uid}`);
    }

  } catch (error) {
    logger.error('❌ Failed to handle trial will end:', error);
  }
}

// Helper function to find user by Stripe customer ID
async function findUserByStripeCustomerId(customerId) {
  try {
    const db = getFirestore();
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).limit(1).get();
    
    if (snapshot.empty) {
      return null;
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    return new User(userData);
  } catch (error) {
    logger.error('❌ Failed to find user by Stripe customer ID:', error);
    return null;
  }
}

// Helper function to get plan from subscription
function getPlanFromSubscription(subscription) {
  const { items } = subscription;
  if (!items || !items.data || items.data.length === 0) {
    return 'unknown';
  }

  const priceId = items.data[0].price.id;
  
  // Map price IDs to plans
  const priceToPlan = {
    [process.env.STRIPE_MONTHLY_PRICE_ID]: 'monthly',
    [process.env.STRIPE_YEARLY_PRICE_ID]: 'yearly',
    [process.env.STRIPE_LIFETIME_PRICE_ID]: 'lifetime'
  };

  return priceToPlan[priceId] || 'unknown';
}

module.exports = router;
