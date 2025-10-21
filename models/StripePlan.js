const { supabase } = require('../src/lib/supabase');
const { logger } = require('../utils/logger');

class StripePlan {
  constructor(data) {
    this.id = data.id;
    this.stripePriceId = data.stripe_price_id;
    this.planKey = data.plan_key;
    this.name = data.name;
    this.period = data.period;
    this.amount = data.amount;
    this.currency = data.currency;
    this.createdAt = data.created_at;
  }

  // Create stripe plan
  static async create(planData) {
    try {
      const { data, error } = await supabase
        .from('stripe_plans')
        .insert(planData)
        .select()
        .single();

      if (error) throw error;

      logger.info(`✅ Created stripe plan: ${data.id}`);
      return new StripePlan(data);
    } catch (error) {
      logger.error('❌ Failed to create stripe plan:', error);
      throw error;
    }
  }

  // Get plan by ID
  static async getById(id) {
    try {
      const { data, error } = await supabase
        .from('stripe_plans')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return new StripePlan(data);
    } catch (error) {
      logger.error('❌ Failed to get stripe plan by ID:', error);
      throw error;
    }
  }

  // Get plan by Stripe price ID
  static async getByStripePriceId(stripePriceId) {
    try {
      const { data, error } = await supabase
        .from('stripe_plans')
        .select('*')
        .eq('stripe_price_id', stripePriceId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return new StripePlan(data);
    } catch (error) {
      logger.error('❌ Failed to get stripe plan by price ID:', error);
      throw error;
    }
  }

  // Get plan by plan key
  static async getByPlanKey(planKey) {
    try {
      const { data, error } = await supabase
        .from('stripe_plans')
        .select('*')
        .eq('plan_key', planKey)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return new StripePlan(data);
    } catch (error) {
      logger.error('❌ Failed to get stripe plan by plan key:', error);
      throw error;
    }
  }

  // Get all plans
  static async getAll(options = {}) {
    try {
      let query = supabase
        .from('stripe_plans')
        .select('*')
        .order('amount', { ascending: true });

      if (options.period) {
        query = query.eq('period', options.period);
      }

      if (options.currency) {
        query = query.eq('currency', options.currency);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map(item => new StripePlan(item));
    } catch (error) {
      logger.error('❌ Failed to get stripe plans:', error);
      throw error;
    }
  }

  // Update plan
  async update(updateData) {
    try {
      const { data, error } = await supabase
        .from('stripe_plans')
        .update(updateData)
        .eq('id', this.id)
        .select()
        .single();

      if (error) throw error;

      // Update local instance
      Object.assign(this, data);
      
      logger.info(`✅ Updated stripe plan: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('❌ Failed to update stripe plan:', error);
      throw error;
    }
  }

  // Delete plan
  async delete() {
    try {
      const { error } = await supabase
        .from('stripe_plans')
        .delete()
        .eq('id', this.id);

      if (error) throw error;

      logger.info(`✅ Deleted stripe plan: ${this.id}`);
      return true;
    } catch (error) {
      logger.error('❌ Failed to delete stripe plan:', error);
      throw error;
    }
  }

  // Get formatted price
  getFormattedPrice() {
    const amount = this.amount / 100; // Convert from cents
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency.toUpperCase()
    }).format(amount);
  }

  // Get price per month (for yearly plans)
  getPricePerMonth() {
    if (this.period === 'yearly') {
      return Math.round(this.amount / 12);
    }
    return this.amount;
  }

  // Get savings percentage (for yearly plans)
  getSavingsPercentage() {
    if (this.period !== 'yearly') {
      return 0;
    }

    const monthlyPlan = this.amount / 12;
    const monthlyPrice = monthlyPlan * 12;
    const savings = ((monthlyPrice - this.amount) / monthlyPrice) * 100;
    
    return Math.round(savings);
  }

  // Check if plan is lifetime
  isLifetime() {
    return this.period === 'lifetime';
  }

  // Check if plan is recurring
  isRecurring() {
    return this.period === 'monthly' || this.period === 'yearly';
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      stripePriceId: this.stripePriceId,
      planKey: this.planKey,
      name: this.name,
      period: this.period,
      amount: this.amount,
      currency: this.currency,
      createdAt: this.createdAt,
      formattedPrice: this.getFormattedPrice(),
      pricePerMonth: this.getPricePerMonth(),
      savingsPercentage: this.getSavingsPercentage(),
      isLifetime: this.isLifetime(),
      isRecurring: this.isRecurring()
    };
  }

  // Convert to public JSON (for API responses)
  toPublicJSON() {
    return {
      id: this.stripePriceId,
      plan_key: this.planKey,
      name: this.name,
      period: this.period,
      amount: this.amount,
      currency: this.currency,
      formatted_price: this.getFormattedPrice(),
      price_per_month: this.getPricePerMonth(),
      savings_percentage: this.getSavingsPercentage(),
      is_lifetime: this.isLifetime(),
      is_recurring: this.isRecurring()
    };
  }
}

module.exports = StripePlan;
