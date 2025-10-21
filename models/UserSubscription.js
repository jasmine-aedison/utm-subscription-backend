const { supabase } = require('../src/lib/supabase');
const { logger } = require('../utils/logger');

class UserSubscription {
  constructor(data) {
    this.id = data.id;
    this.uid = data.uid;
    this.deviceId = data.device_id;
    this.email = data.email;
    this.stripeCustomerId = data.stripe_customer_id;
    this.stripeSubscriptionId = data.stripe_subscription_id;
    this.planId = data.plan_id;
    this.status = data.status;
    this.trialStart = data.trial_start;
    this.trialEnd = data.trial_end;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create user subscription
  static async create(subscriptionData) {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .insert(subscriptionData)
        .select()
        .single();

      if (error) throw error;

      logger.info(`✅ Created user subscription: ${data.id}`);
      return new UserSubscription(data);
    } catch (error) {
      logger.error('❌ Failed to create user subscription:', error);
      throw error;
    }
  }

  // Get subscription by UID
  static async getByUid(uid) {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('uid', uid)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return new UserSubscription(data);
    } catch (error) {
      logger.error('❌ Failed to get subscription by UID:', error);
      throw error;
    }
  }

  // Get subscription by device ID
  static async getByDeviceId(deviceId) {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return new UserSubscription(data);
    } catch (error) {
      logger.error('❌ Failed to get subscription by device ID:', error);
      throw error;
    }
  }

  // Get subscription by Stripe subscription ID
  static async getByStripeSubscriptionId(stripeSubscriptionId) {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('stripe_subscription_id', stripeSubscriptionId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return new UserSubscription(data);
    } catch (error) {
      logger.error('❌ Failed to get subscription by Stripe subscription ID:', error);
      throw error;
    }
  }

  // Get subscription by Stripe customer ID
  static async getByStripeCustomerId(stripeCustomerId) {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('stripe_customer_id', stripeCustomerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return new UserSubscription(data);
    } catch (error) {
      logger.error('❌ Failed to get subscription by Stripe customer ID:', error);
      throw error;
    }
  }

  // Update subscription
  async update(updateData) {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .update(updateData)
        .eq('id', this.id)
        .select()
        .single();

      if (error) throw error;

      // Update local instance
      Object.assign(this, data);
      
      logger.info(`✅ Updated user subscription: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('❌ Failed to update user subscription:', error);
      throw error;
    }
  }

  // Update subscription status
  async updateStatus(status) {
    try {
      await this.update({ status });
      logger.info(`✅ Updated subscription status to ${status}: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('❌ Failed to update subscription status:', error);
      throw error;
    }
  }

  // Link subscription to UID (for guest linking)
  async linkToUid(uid) {
    try {
      await this.update({ uid });
      logger.info(`✅ Linked subscription ${this.id} to UID: ${uid}`);
      return this;
    } catch (error) {
      logger.error('❌ Failed to link subscription to UID:', error);
      throw error;
    }
  }

  // Check if subscription is active
  isActive() {
    return this.status === 'active';
  }

  // Check if subscription is in trial
  isTrial() {
    if (this.status !== 'trial' || !this.trialEnd) {
      return false;
    }
    
    const now = new Date();
    const trialEnd = new Date(this.trialEnd);
    
    return trialEnd > now;
  }

  // Check if trial has expired
  isTrialExpired() {
    if (this.status !== 'trial' || !this.trialEnd) {
      return false;
    }
    
    const now = new Date();
    const trialEnd = new Date(this.trialEnd);
    
    return trialEnd <= now;
  }

  // Get subscription status for API
  getSubscriptionStatus() {
    if (this.isActive()) {
      return 'active';
    } else if (this.isTrial()) {
      return 'trial';
    } else if (this.status === 'expired' || this.isTrialExpired()) {
      return 'expired';
    } else {
      return 'none';
    }
  }

  // Get trial days remaining
  getTrialDaysRemaining() {
    if (!this.isTrial()) {
      return 0;
    }
    
    const now = new Date();
    const trialEnd = new Date(this.trialEnd);
    const diffTime = trialEnd - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      uid: this.uid,
      deviceId: this.deviceId,
      email: this.email,
      stripeCustomerId: this.stripeCustomerId,
      stripeSubscriptionId: this.stripeSubscriptionId,
      planId: this.planId,
      status: this.status,
      trialStart: this.trialStart,
      trialEnd: this.trialEnd,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isActive: this.isActive(),
      isTrial: this.isTrial(),
      isTrialExpired: this.isTrialExpired(),
      subscriptionStatus: this.getSubscriptionStatus(),
      trialDaysRemaining: this.getTrialDaysRemaining()
    };
  }

  // Convert to public JSON (for API responses)
  toPublicJSON() {
    return {
      status: this.getSubscriptionStatus(),
      plan: this.planId ? { id: this.planId } : null,
      trialStart: this.trialStart,
      trialEnd: this.trialEnd,
      isActive: this.isActive(),
      isTrial: this.isTrial(),
      trialDaysRemaining: this.getTrialDaysRemaining()
    };
  }
}

module.exports = UserSubscription;
