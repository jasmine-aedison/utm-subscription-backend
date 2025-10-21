const { supabase } = require('../src/lib/supabase');
const { logger } = require('../utils/logger');
const crypto = require('crypto');

class Device {
  constructor(data) {
    this.id = data.id;
    this.deviceId = data.device_id;
    this.createdAt = data.created_at;
    this.lastSeen = data.last_seen;
    this.linkedUid = data.linked_uid;
    this.trialStart = data.trial_start;
    this.trialEnd = data.trial_end;
    this.subscriptionStatus = data.subscription_status;
  }

  // Hash device ID for security
  static hashDeviceId(deviceId) {
    return crypto.createHmac('sha256', process.env.DEVICE_ID_SECRET || 'default-secret')
      .update(deviceId)
      .digest('hex');
  }

  // Create device
  static async create(deviceId) {
    try {
      const hashedDeviceId = Device.hashDeviceId(deviceId);
      const now = new Date();
      const trialEnd = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000)); // 3 days

      const { data, error } = await supabase
        .from('devices')
        .insert({
          device_id: hashedDeviceId,
          trial_start: now.toISOString(),
          trial_end: trialEnd.toISOString(),
          subscription_status: 'trial'
        })
        .select()
        .single();

      if (error) throw error;

      logger.info(`✅ Created device trial: ${data.id}`);
      return new Device(data);
    } catch (error) {
      logger.error('❌ Failed to create device:', error);
      throw error;
    }
  }

  // Get device by device ID
  static async getByDeviceId(deviceId) {
    try {
      const hashedDeviceId = Device.hashDeviceId(deviceId);
      
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('device_id', hashedDeviceId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return new Device(data);
    } catch (error) {
      logger.error('❌ Failed to get device by device ID:', error);
      throw error;
    }
  }

  // Get device by ID
  static async getById(id) {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return new Device(data);
    } catch (error) {
      logger.error('❌ Failed to get device by ID:', error);
      throw error;
    }
  }

  // Update device
  async update(updateData) {
    try {
      const { data, error } = await supabase
        .from('devices')
        .update(updateData)
        .eq('id', this.id)
        .select()
        .single();

      if (error) throw error;

      // Update local instance
      Object.assign(this, data);
      
      logger.info(`✅ Updated device: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('❌ Failed to update device:', error);
      throw error;
    }
  }

  // Link device to Firebase UID
  async linkToUid(uid) {
    try {
      await this.update({ linked_uid: uid });
      logger.info(`✅ Linked device ${this.id} to UID: ${uid}`);
      return this;
    } catch (error) {
      logger.error('❌ Failed to link device to UID:', error);
      throw error;
    }
  }

  // Update last seen
  async updateLastSeen() {
    try {
      await this.update({ last_seen: new Date().toISOString() });
      return this;
    } catch (error) {
      logger.error('❌ Failed to update last seen:', error);
      throw error;
    }
  }

  // Check if trial is active
  isTrialActive() {
    if (this.subscriptionStatus !== 'trial' || !this.trialEnd) {
      return false;
    }
    
    const now = new Date();
    const trialEnd = new Date(this.trialEnd);
    
    return trialEnd > now;
  }

  // Check if trial has expired
  isTrialExpired() {
    if (this.subscriptionStatus !== 'trial' || !this.trialEnd) {
      return false;
    }
    
    const now = new Date();
    const trialEnd = new Date(this.trialEnd);
    
    return trialEnd <= now;
  }

  // Get trial days remaining
  getTrialDaysRemaining() {
    if (!this.isTrialActive()) {
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
      deviceId: this.deviceId,
      createdAt: this.createdAt,
      lastSeen: this.lastSeen,
      linkedUid: this.linkedUid,
      trialStart: this.trialStart,
      trialEnd: this.trialEnd,
      subscriptionStatus: this.subscriptionStatus,
      isTrialActive: this.isTrialActive(),
      isTrialExpired: this.isTrialExpired(),
      trialDaysRemaining: this.getTrialDaysRemaining()
    };
  }

  // Convert to public JSON (for API responses)
  toPublicJSON() {
    return {
      guest_id: this.id,
      trial_start: this.trialStart,
      trial_end: this.trialEnd,
      status: this.subscriptionStatus,
      is_trial_active: this.isTrialActive(),
      trial_days_remaining: this.getTrialDaysRemaining()
    };
  }
}

module.exports = Device;
