const express = require('express');
const Joi = require('joi');
const { logger } = require('../utils/logger');

const LicenseKey = require('../models/LicenseKey');
const StripePlan = require('../models/StripePlan');

const router = express.Router();

// Admin authentication middleware (simple API key check)
const adminAuth = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_API_KEY;
  
  if (!adminKey || adminKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Invalid admin key'
    });
  }
  
  next();
};

// Apply admin auth to all routes
router.use(adminAuth);

// Validation schemas
const generateLicenseKeysSchema = Joi.object({
  plan_id: Joi.string().required(),
  count: Joi.number().integer().min(1).max(1000).required(),
  expires_at: Joi.date().optional(),
  single_use: Joi.boolean().optional().default(true),
  created_by: Joi.string().optional()
});

const revokeLicenseSchema = Joi.object({
  key: Joi.string().required()
});

const listLicenseKeysSchema = Joi.object({
  plan_id: Joi.string().optional(),
  created_by: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).optional().default(50),
  offset: Joi.number().integer().min(0).optional().default(0)
});

// POST /admin/generate-license-keys
router.post('/generate-license-keys', async (req, res) => {
  try {
    // Validate request
    const { error, value } = generateLicenseKeysSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { plan_id, count, expires_at, single_use, created_by } = value;

    // Verify plan exists
    const plan = await StripePlan.getByPlanKey(plan_id);
    if (!plan) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan ID'
      });
    }

    // Generate license keys
    const { licenseKeys, plaintextKeys } = await LicenseKey.createMultiple(plan_id, count, {
      expiresAt: expires_at,
      singleUse: single_use,
      createdBy: created_by
    });

    logger.info(`✅ Generated ${count} license keys for plan: ${plan_id}`);

    res.json({
      success: true,
      count: licenseKeys.length,
      plan_id: plan_id,
      keys: plaintextKeys, // Return plaintext keys only once
      expires_at: expires_at,
      single_use: single_use,
      created_by: created_by
    });
  } catch (error) {
    logger.error('❌ Failed to generate license keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate license keys'
    });
  }
});

// POST /admin/revoke-license
router.post('/revoke-license', async (req, res) => {
  try {
    // Validate request
    const { error, value } = revokeLicenseSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { key } = value;

    // Get license key
    const licenseKey = await LicenseKey.getByKey(key);
    if (!licenseKey) {
      return res.status(404).json({
        success: false,
        error: 'License key not found'
      });
    }

    // Revoke license key
    await licenseKey.revoke();

    logger.info(`✅ Revoked license key: ${key}`);

    res.json({
      success: true,
      message: 'License key revoked successfully'
    });
  } catch (error) {
    logger.error('❌ Failed to revoke license:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke license key'
    });
  }
});

// GET /admin/license-keys
router.get('/license-keys', async (req, res) => {
  try {
    // Validate query parameters
    const { error, value } = listLicenseKeysSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { plan_id, created_by, limit, offset } = value;

    // Get license keys
    const licenseKeys = await LicenseKey.getAll({
      planId: plan_id,
      createdBy: created_by,
      limit: limit,
      offset: offset
    });

    // Get total count for pagination
    const { supabase } = require('../src/lib/supabase');
    let countQuery = supabase
      .from('license_keys')
      .select('*', { count: 'exact', head: true });

    if (plan_id) {
      countQuery = countQuery.eq('plan_id', plan_id);
    }
    if (created_by) {
      countQuery = countQuery.eq('created_by', created_by);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    logger.info(`✅ Retrieved ${licenseKeys.length} license keys`);

    res.json({
      success: true,
      license_keys: licenseKeys.map(key => ({
        id: key.id,
        plan_id: key.planId,
        expires_at: key.expiresAt,
        single_use: key.singleUse,
        bound_uid: key.boundUid,
        bound_device_id: key.boundDeviceId,
        redeemed_at: key.redeemedAt,
        created_by: key.createdBy,
        created_at: key.createdAt,
        is_redeemed: key.isRedeemed(),
        is_expired: key.isExpired(),
        is_valid_for_redemption: key.isValidForRedemption()
      })),
      pagination: {
        total: count,
        limit: limit,
        offset: offset,
        has_more: offset + limit < count
      }
    });
  } catch (error) {
    logger.error('❌ Failed to get license keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get license keys'
    });
  }
});

// GET /admin/license-keys/:id
router.get('/license-keys/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const licenseKey = await LicenseKey.getById(id);
    if (!licenseKey) {
      return res.status(404).json({
        success: false,
        error: 'License key not found'
      });
    }

    res.json({
      success: true,
      license_key: {
        id: licenseKey.id,
        plan_id: licenseKey.planId,
        expires_at: licenseKey.expiresAt,
        single_use: licenseKey.singleUse,
        bound_uid: licenseKey.boundUid,
        bound_device_id: licenseKey.boundDeviceId,
        redeemed_at: licenseKey.redeemedAt,
        created_by: licenseKey.createdBy,
        created_at: licenseKey.createdAt,
        is_redeemed: licenseKey.isRedeemed(),
        is_expired: licenseKey.isExpired(),
        is_valid_for_redemption: licenseKey.isValidForRedemption(),
        bound_info: licenseKey.getBoundInfo()
      }
    });
  } catch (error) {
    logger.error('❌ Failed to get license key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get license key'
    });
  }
});

// GET /admin/stats
router.get('/stats', async (req, res) => {
  try {
    const { supabase } = require('../src/lib/supabase');

    // Get license key stats
    const { data: licenseStats, error: licenseError } = await supabase
      .from('license_keys')
      .select('plan_id, redeemed_at, created_at')
      .order('created_at', { ascending: false });

    if (licenseError) throw licenseError;

    // Get subscription stats
    const { data: subscriptionStats, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .select('status, plan_id, created_at')
      .order('created_at', { ascending: false });

    if (subscriptionError) throw subscriptionError;

    // Get device stats
    const { data: deviceStats, error: deviceError } = await supabase
      .from('devices')
      .select('subscription_status, created_at')
      .order('created_at', { ascending: false });

    if (deviceError) throw deviceError;

    // Calculate stats
    const totalLicenseKeys = licenseStats.length;
    const redeemedLicenseKeys = licenseStats.filter(key => key.redeemed_at).length;
    const activeSubscriptions = subscriptionStats.filter(sub => sub.status === 'active').length;
    const trialDevices = deviceStats.filter(device => device.subscription_status === 'trial').length;

    const planStats = {};
    licenseStats.forEach(key => {
      if (!planStats[key.plan_id]) {
        planStats[key.plan_id] = { total: 0, redeemed: 0 };
      }
      planStats[key.plan_id].total++;
      if (key.redeemed_at) {
        planStats[key.plan_id].redeemed++;
      }
    });

    logger.info('✅ Retrieved admin stats');

    res.json({
      success: true,
      stats: {
        license_keys: {
          total: totalLicenseKeys,
          redeemed: redeemedLicenseKeys,
          unredeemed: totalLicenseKeys - redeemedLicenseKeys,
          redemption_rate: totalLicenseKeys > 0 ? (redeemedLicenseKeys / totalLicenseKeys * 100).toFixed(2) : 0
        },
        subscriptions: {
          active: activeSubscriptions,
          total: subscriptionStats.length
        },
        devices: {
          trial: trialDevices,
          total: deviceStats.length
        },
        plans: planStats
      }
    });
  } catch (error) {
    logger.error('❌ Failed to get admin stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get admin statistics'
    });
  }
});

module.exports = router;
