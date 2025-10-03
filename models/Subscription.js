const { getFirestore } = require('../config/firebase');
const { logger } = require('../utils/logger');

class Subscription {
  constructor(data) {
    this.id = data.id;
    this.userId = data.userId;
    this.stripeSubscriptionId = data.stripeSubscriptionId;
    this.stripeCustomerId = data.stripeCustomerId;
    this.plan = data.plan; // 'monthly', 'yearly', 'lifetime'
    this.status = data.status; // 'active', 'cancelled', 'expired', 'past_due'
    this.currentPeriodStart = data.currentPeriodStart;
    this.currentPeriodEnd = data.currentPeriodEnd;
    this.cancelAtPeriodEnd = data.cancelAtPeriodEnd || false;
    this.cancelledAt = data.cancelledAt;
    this.trialEnd = data.trialEnd;
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Create subscription in Firestore
  static async create(subscriptionData) {
    try {
      const db = getFirestore();
      const subscriptionRef = db.collection('subscriptions').doc();
      
      const subscription = new Subscription({
        id: subscriptionRef.id,
        ...subscriptionData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await subscriptionRef.set({
        id: subscription.id,
        userId: subscription.userId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeCustomerId: subscription.stripeCustomerId,
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        cancelledAt: subscription.cancelledAt,
        trialEnd: subscription.trialEnd,
        metadata: subscription.metadata,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      });

      logger.info(`✅ Created subscription: ${subscription.id}`);
      return subscription;
    } catch (error) {
      logger.error('❌ Failed to create subscription:', error);
      throw error;
    }
  }

  // Get subscription by ID
  static async getById(subscriptionId) {
    try {
      const db = getFirestore();
      const subscriptionDoc = await db.collection('subscriptions').doc(subscriptionId).get();
      
      if (!subscriptionDoc.exists) {
        return null;
      }

      const subscriptionData = subscriptionDoc.data();
      return new Subscription(subscriptionData);
    } catch (error) {
      logger.error('❌ Failed to get subscription by ID:', error);
      throw error;
    }
  }

  // Get subscription by Stripe subscription ID
  static async getByStripeSubscriptionId(stripeSubscriptionId) {
    try {
      const db = getFirestore();
      const subscriptionsRef = db.collection('subscriptions');
      const snapshot = await subscriptionsRef
        .where('stripeSubscriptionId', '==', stripeSubscriptionId)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }

      const subscriptionDoc = snapshot.docs[0];
      const subscriptionData = subscriptionDoc.data();
      return new Subscription(subscriptionData);
    } catch (error) {
      logger.error('❌ Failed to get subscription by Stripe ID:', error);
      throw error;
    }
  }

  // Get user's active subscription
  static async getActiveByUserId(userId) {
    try {
      const db = getFirestore();
      const subscriptionsRef = db.collection('subscriptions');
      const snapshot = await subscriptionsRef
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }

      const subscriptionDoc = snapshot.docs[0];
      const subscriptionData = subscriptionDoc.data();
      return new Subscription(subscriptionData);
    } catch (error) {
      logger.error('❌ Failed to get active subscription:', error);
      throw error;
    }
  }

  // Update subscription
  async update(updateData) {
    try {
      const db = getFirestore();
      const subscriptionRef = db.collection('subscriptions').doc(this.id);
      
      const updateFields = {
        ...updateData,
        updatedAt: new Date()
      };

      await subscriptionRef.update(updateFields);
      
      // Update local instance
      Object.assign(this, updateFields);
      
      logger.info(`✅ Updated subscription: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('❌ Failed to update subscription:', error);
      throw error;
    }
  }

  // Cancel subscription
  async cancel(cancelledAt = new Date()) {
    try {
      await this.update({
        status: 'cancelled',
        cancelledAt: cancelledAt,
        cancelAtPeriodEnd: true
      });
      
      logger.info(`✅ Cancelled subscription: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('❌ Failed to cancel subscription:', error);
      throw error;
    }
  }

  // Check if subscription is active
  isActive() {
    const now = new Date();
    const periodEnd = new Date(this.currentPeriodEnd);
    
    return this.status === 'active' && 
           periodEnd > now && 
           !this.cancelAtPeriodEnd;
  }

  // Check if subscription is in trial
  isTrial() {
    if (!this.trialEnd) {
      return false;
    }
    
    const now = new Date();
    const trialEnd = new Date(this.trialEnd);
    
    return this.status === 'active' && trialEnd > now;
  }

  // Get days until expiry
  getDaysUntilExpiry() {
    const now = new Date();
    const periodEnd = new Date(this.currentPeriodEnd);
    const diffTime = periodEnd - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  // Get plan display name
  getPlanDisplayName() {
    const planNames = {
      'monthly': 'Monthly Subscription',
      'yearly': 'Yearly Subscription',
      'lifetime': 'Lifetime License'
    };
    
    return planNames[this.plan] || this.plan;
  }

  // Get plan price (in cents)
  getPlanPrice() {
    const prices = {
      'monthly': 999, // $9.99
      'yearly': 9999, // $99.99
      'lifetime': 29999 // $299.99
    };
    
    return prices[this.plan] || 0;
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      stripeSubscriptionId: this.stripeSubscriptionId,
      stripeCustomerId: this.stripeCustomerId,
      plan: this.plan,
      status: this.status,
      currentPeriodStart: this.currentPeriodStart,
      currentPeriodEnd: this.currentPeriodEnd,
      cancelAtPeriodEnd: this.cancelAtPeriodEnd,
      cancelledAt: this.cancelledAt,
      trialEnd: this.trialEnd,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Convert to public JSON
  toPublicJSON() {
    return {
      id: this.id,
      plan: this.plan,
      planDisplayName: this.getPlanDisplayName(),
      status: this.status,
      currentPeriodStart: this.currentPeriodStart,
      currentPeriodEnd: this.currentPeriodEnd,
      cancelAtPeriodEnd: this.cancelAtPeriodEnd,
      isActive: this.isActive(),
      isTrial: this.isTrial(),
      daysUntilExpiry: this.getDaysUntilExpiry(),
      price: this.getPlanPrice()
    };
  }
}

module.exports = Subscription;
