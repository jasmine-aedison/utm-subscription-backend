const { supabase } = require('../src/lib/supabase');
const { logger } = require('../utils/logger');
const crypto = require('crypto');

class LicenseKey {
  constructor(data) {
    this.id = data.id;
    this.key = data.key;
    this.planId = data.plan_id;
    this.expiresAt = data.expires_at;
    this.singleUse = data.single_use;
    this.boundUid = data.bound_uid;
    this.boundDeviceId = data.bound_device_id;
    this.redeemedAt = data.redeemed_at;
    this.createdBy = data.created_by;
    this.createdAt = data.created_at;
  }

  // Generate license key
  static generateKey() {
    // Generate a structured key like UTM-XXXX-XXXX-XXXX
    const segments = [];
    for (let i = 0; i < 3; i++) {
      segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
    }
    return `UTM-${segments.join('-')}`;
  }

  // Hash license key for storage
  static hashKey(key) {
    return crypto.createHmac('sha256', process.env.LICENSE_KEY_SECRET || 'default-secret')
      .update(key)
      .digest('hex');
  }

  // Create license key
  static async create(licenseData) {
    try {
      const key = LicenseKey.generateKey();
      const hashedKey = LicenseKey.hashKey(key);

      const { data, error } = await supabase
        .from('license_keys')
        .insert({
          key: hashedKey,
          plan_id: licenseData.planId,
          expires_at: licenseData.expiresAt,
          single_use: licenseData.singleUse !== false,
          created_by: licenseData.createdBy
        })
        .select()
        .single();

      if (error) throw error;

      logger.info(`✅ Created license key: ${data.id}`);
      return { licenseKey: new LicenseKey(data), plaintextKey: key };
    } catch (error) {
      logger.error('❌ Failed to create license key:', error);
      throw error;
    }
  }

  // Create multiple license keys
  static async createMultiple(planId, count, options = {}) {
    try {
      const keys = [];
      const plaintextKeys = [];

      for (let i = 0; i < count; i++) {
        const key = LicenseKey.generateKey();
        const hashedKey = LicenseKey.hashKey(key);

        const { data, error } = await supabase
          .from('license_keys')
          .insert({
            key: hashedKey,
            plan_id: planId,
            expires_at: options.expiresAt,
            single_use: options.singleUse !== false,
            created_by: options.createdBy
          })
          .select()
          .single();

        if (error) throw error;

        keys.push(new LicenseKey(data));
        plaintextKeys.push(key);
      }

      logger.info(`✅ Created ${count} license keys`);
      return { licenseKeys: keys, plaintextKeys };
    } catch (error) {
      logger.error('❌ Failed to create multiple license keys:', error);
      throw error;
    }
  }

  // Get license key by key
  static async getByKey(key) {
    try {
      const hashedKey = LicenseKey.hashKey(key);
      
      const { data, error } = await supabase
        .from('license_keys')
        .select('*')
        .eq('key', hashedKey)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return new LicenseKey(data);
    } catch (error) {
      logger.error('❌ Failed to get license key by key:', error);
      throw error;
    }
  }

  // Get license key by ID
  static async getById(id) {
    try {
      const { data, error } = await supabase
        .from('license_keys')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return new LicenseKey(data);
    } catch (error) {
      logger.error('❌ Failed to get license key by ID:', error);
      throw error;
    }
  }

  // Get all license keys (with pagination)
  static async getAll(options = {}) {
    try {
      let query = supabase
        .from('license_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      if (options.planId) {
        query = query.eq('plan_id', options.planId);
      }

      if (options.createdBy) {
        query = query.eq('created_by', options.createdBy);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map(item => new LicenseKey(item));
    } catch (error) {
      logger.error('❌ Failed to get license keys:', error);
      throw error;
    }
  }

  // Update license key
  async update(updateData) {
    try {
      const { data, error } = await supabase
        .from('license_keys')
        .update(updateData)
        .eq('id', this.id)
        .select()
        .single();

      if (error) throw error;

      // Update local instance
      Object.assign(this, data);
      
      logger.info(`✅ Updated license key: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('❌ Failed to update license key:', error);
      throw error;
    }
  }

  // Redeem license key
  async redeem(boundUid = null, boundDeviceId = null) {
    try {
      if (this.isRedeemed()) {
        throw new Error('License key has already been redeemed');
      }

      if (this.isExpired()) {
        throw new Error('License key has expired');
      }

      await this.update({
        bound_uid: boundUid,
        bound_device_id: boundDeviceId,
        redeemed_at: new Date().toISOString()
      });

      logger.info(`✅ Redeemed license key: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('❌ Failed to redeem license key:', error);
      throw error;
    }
  }

  // Revoke license key
  async revoke() {
    try {
      await this.update({
        redeemed_at: new Date().toISOString(),
        bound_uid: null,
        bound_device_id: null
      });

      logger.info(`✅ Revoked license key: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('❌ Failed to revoke license key:', error);
      throw error;
    }
  }

  // Check if license key is redeemed
  isRedeemed() {
    return !!this.redeemedAt;
  }

  // Check if license key is expired
  isExpired() {
    if (!this.expiresAt) {
      return false; // No expiry date means lifetime
    }
    
    const now = new Date();
    const expiresAt = new Date(this.expiresAt);
    
    return expiresAt <= now;
  }

  // Check if license key is valid for redemption
  isValidForRedemption() {
    return !this.isRedeemed() && !this.isExpired();
  }

  // Get bound information
  getBoundInfo() {
    if (this.boundUid) {
      return { uid: this.boundUid };
    } else if (this.boundDeviceId) {
      return { deviceId: this.boundDeviceId };
    }
    return null;
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      key: this.key,
      planId: this.planId,
      expiresAt: this.expiresAt,
      singleUse: this.singleUse,
      boundUid: this.boundUid,
      boundDeviceId: this.boundDeviceId,
      redeemedAt: this.redeemedAt,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      isRedeemed: this.isRedeemed(),
      isExpired: this.isExpired(),
      isValidForRedemption: this.isValidForRedemption(),
      boundInfo: this.getBoundInfo()
    };
  }

  // Convert to public JSON (for API responses)
  toPublicJSON() {
    return {
      plan_id: this.planId,
      expires_at: this.expiresAt,
      bound_to: this.getBoundInfo()
    };
  }
}

module.exports = LicenseKey;
