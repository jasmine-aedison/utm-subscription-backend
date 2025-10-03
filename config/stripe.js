const Stripe = require('stripe');
const { logger } = require('../utils/logger');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  appInfo: {
    name: 'UTM Subscription System',
    version: '1.0.0'
  }
});

// Create customer
const createCustomer = async (email, name, metadata = {}) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        ...metadata,
        source: 'utm_app'
      }
    });
    
    logger.info(`✅ Created Stripe customer: ${customer.id}`);
    return customer;
  } catch (error) {
    logger.error('❌ Failed to create Stripe customer:', error);
    throw error;
  }
};

// Get customer
const getCustomer = async (customerId) => {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer;
  } catch (error) {
    logger.error('❌ Failed to get Stripe customer:', error);
    throw error;
  }
};

// Create subscription
const createSubscription = async (customerId, priceId, metadata = {}) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata: {
        ...metadata,
        source: 'utm_app'
      },
      expand: ['latest_invoice.payment_intent']
    });
    
    logger.info(`✅ Created Stripe subscription: ${subscription.id}`);
    return subscription;
  } catch (error) {
    logger.error('❌ Failed to create Stripe subscription:', error);
    throw error;
  }
};

// Get subscription
const getSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    logger.error('❌ Failed to get Stripe subscription:', error);
    throw error;
  }
};

// Cancel subscription
const cancelSubscription = async (subscriptionId, immediately = false) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: !immediately,
      ...(immediately && { cancel_at: Math.floor(Date.now() / 1000) })
    });
    
    logger.info(`✅ ${immediately ? 'Cancelled' : 'Scheduled cancellation for'} Stripe subscription: ${subscriptionId}`);
    return subscription;
  } catch (error) {
    logger.error('❌ Failed to cancel Stripe subscription:', error);
    throw error;
  }
};

// Create payment intent
const createPaymentIntent = async (amount, currency, customerId, metadata = {}) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: currency.toLowerCase(),
      customer: customerId,
      metadata: {
        ...metadata,
        source: 'utm_app'
      }
    });
    
    logger.info(`✅ Created Stripe payment intent: ${paymentIntent.id}`);
    return paymentIntent;
  } catch (error) {
    logger.error('❌ Failed to create Stripe payment intent:', error);
    throw error;
  }
};

// Create setup intent for saving payment methods
const createSetupIntent = async (customerId, metadata = {}) => {
  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      metadata: {
        ...metadata,
        source: 'utm_app'
      }
    });
    
    logger.info(`✅ Created Stripe setup intent: ${setupIntent.id}`);
    return setupIntent;
  } catch (error) {
    logger.error('❌ Failed to create Stripe setup intent:', error);
    throw error;
  }
};

// Get customer's payment methods
const getPaymentMethods = async (customerId, type = 'card') => {
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: type
    });
    
    return paymentMethods.data;
  } catch (error) {
    logger.error('❌ Failed to get payment methods:', error);
    throw error;
  }
};

// Create price for one-time payments (lifetime licenses)
const createPrice = async (amount, currency, productId, metadata = {}) => {
  try {
    const price = await stripe.prices.create({
      unit_amount: amount * 100, // Convert to cents
      currency: currency.toLowerCase(),
      product: productId,
      metadata: {
        ...metadata,
        source: 'utm_app'
      }
    });
    
    logger.info(`✅ Created Stripe price: ${price.id}`);
    return price;
  } catch (error) {
    logger.error('❌ Failed to create Stripe price:', error);
    throw error;
  }
};

// Verify webhook signature
const verifyWebhookSignature = (payload, signature) => {
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    return event;
  } catch (error) {
    logger.error('❌ Failed to verify Stripe webhook signature:', error);
    throw error;
  }
};

module.exports = {
  stripe,
  createCustomer,
  getCustomer,
  createSubscription,
  getSubscription,
  cancelSubscription,
  createPaymentIntent,
  createSetupIntent,
  getPaymentMethods,
  createPrice,
  verifyWebhookSignature
};
