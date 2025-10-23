const { supabase } = require('../src/lib/supabase');
const { logger } = require('../utils/logger');

class PostgresUser {
  constructor(data) {
    this.id = data.id;
    this.firebaseUid = data.firebase_uid;
    this.email = data.email;
    this.displayName = data.display_name;
    this.stripeCustomerId = data.stripe_customer_id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create user in Postgres
  static async create(userData) {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert({
          firebase_uid: userData.uid,
          email: userData.email,
          display_name: userData.displayName,
          stripe_customer_id: userData.stripeCustomerId || null
        })
        .select()
        .single();

      if (error) throw error;

      logger.info(`✅ Created user in Postgres: ${data.id}`);
      return new PostgresUser(data);
    } catch (error) {
      logger.error('❌ Failed to create user in Postgres:', error);
      throw error;
    }
  }

  // Get user by Firebase UID
  static async getByUid(firebaseUid) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('firebase_uid', firebaseUid)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return new PostgresUser(data);
    } catch (error) {
      logger.error('❌ Failed to get user by UID:', error);
      throw error;
    }
  }

  // Get user by email
  static async getByEmail(email) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return new PostgresUser(data);
    } catch (error) {
      logger.error('❌ Failed to get user by email:', error);
      throw error;
    }
  }

  // Update user
  async update(updateData) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', this.id)
        .select()
        .single();

      if (error) throw error;

      // Update local instance
      Object.assign(this, data);
      
      logger.info(`✅ Updated user: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('❌ Failed to update user:', error);
      throw error;
    }
  }

  // Set Stripe customer ID
  async setStripeCustomerId(customerId) {
    try {
      await this.update({ stripe_customer_id: customerId });
      logger.info(`✅ Set Stripe customer ID for user: ${this.id}`);
    } catch (error) {
      logger.error('❌ Failed to set Stripe customer ID:', error);
      throw error;
    }
  }

  // Check if user has active subscription
  hasActiveSubscription() {
    // This will be implemented when we integrate with the subscription system
    return false;
  }

  // Get subscription status
  getSubscriptionStatus() {
    // This will be implemented when we integrate with the subscription system
    return 'none';
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      firebaseUid: this.firebaseUid,
      email: this.email,
      displayName: this.displayName,
      stripeCustomerId: this.stripeCustomerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Convert to public JSON (without sensitive data)
  toPublicJSON() {
    return {
      id: this.id,
      firebaseUid: this.firebaseUid,
      email: this.email,
      displayName: this.displayName,
      stripeCustomerId: this.stripeCustomerId,
      hasActiveSubscription: this.hasActiveSubscription(),
      subscriptionStatus: this.getSubscriptionStatus()
    };
  }
}

module.exports = PostgresUser;
