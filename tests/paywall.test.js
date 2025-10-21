const request = require('supertest');
const app = require('../server');
const { supabase } = require('../src/lib/supabase');
const { logger } = require('../utils/logger');

// Mock Firebase Admin SDK
jest.mock('firebase-admin', () => ({
  auth: () => ({
    verifyIdToken: jest.fn()
  }),
  apps: [],
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn()
  }
}));

const admin = require('firebase-admin');

describe('Paywall System', () => {
  let mockFirebaseUser;
  let testDeviceId;
  let testGuestId;
  let testLicenseKey;

  beforeAll(async () => {
    // Setup test data
    testDeviceId = 'test-device-' + Date.now();
    mockFirebaseUser = {
      uid: 'test-uid-' + Date.now(),
      email: 'test@example.com',
      email_verified: true
    };

    // Mock Firebase token verification
    admin.auth().verifyIdToken.mockResolvedValue(mockFirebaseUser);
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await supabase.from('user_subscriptions').delete().like('uid', 'test-uid-%');
      await supabase.from('devices').delete().like('device_id', 'test-device-%');
      await supabase.from('license_keys').delete().like('key', '%test%');
    } catch (error) {
      logger.warn('Cleanup failed:', error);
    }
  });

  describe('Guest Trial System', () => {
    test('POST /api/start-guest-trial - should start trial for new device', async () => {
      const response = await request(app)
        .post('/api/start-guest-trial')
        .send({ device_id: testDeviceId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.guest_id).toBeDefined();
      expect(response.body.status).toBe('trial');
      expect(response.body.trial_start).toBeDefined();
      expect(response.body.trial_end).toBeDefined();
      expect(response.body.is_trial_active).toBe(true);

      testGuestId = response.body.guest_id;
    });

    test('POST /api/start-guest-trial - should return existing trial for same device', async () => {
      const response = await request(app)
        .post('/api/start-guest-trial')
        .send({ device_id: testDeviceId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.guest_id).toBe(testGuestId);
      expect(response.body.status).toBe('trial');
    });

    test('GET /api/check-subscription - should return trial status for guest', async () => {
      const response = await request(app)
        .get(`/api/check-subscription?guest_id=${testGuestId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('trial');
      expect(response.body.trialStart).toBeDefined();
      expect(response.body.trialEnd).toBeDefined();
    });

    test('GET /api/check-subscription - should return none for invalid guest', async () => {
      const response = await request(app)
        .get('/api/check-subscription?guest_id=invalid-guest-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('none');
    });
  });

  describe('Authentication System', () => {
    test('GET /api/check-subscription - should work with Firebase token', async () => {
      const response = await request(app)
        .get('/api/check-subscription')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('none'); // No subscription yet
    });

    test('GET /api/check-subscription - should fail with invalid token', async () => {
      admin.auth().verifyIdToken.mockRejectedValueOnce(new Error('Invalid token'));

      const response = await request(app)
        .get('/api/check-subscription')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid');
    });
  });

  describe('License Key System', () => {
    test('POST /api/redeem-license - should redeem valid license key', async () => {
      // First create a test license key
      const { data: licenseData, error: createError } = await supabase
        .from('license_keys')
        .insert({
          key: 'test-license-key-' + Date.now(),
          plan_id: 'pro_monthly',
          single_use: true,
          created_by: 'test-admin'
        })
        .select()
        .single();

      expect(createError).toBeNull();
      testLicenseKey = licenseData.key;

      const response = await request(app)
        .post('/api/redeem-license')
        .send({
          key: testLicenseKey,
          guest_id: testGuestId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.plan_id).toBe('pro_monthly');
    });

    test('POST /api/redeem-license - should fail for already redeemed key', async () => {
      const response = await request(app)
        .post('/api/redeem-license')
        .send({
          key: testLicenseKey,
          guest_id: testGuestId
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already been redeemed');
    });

    test('POST /api/redeem-license - should fail for invalid key', async () => {
      const response = await request(app)
        .post('/api/redeem-license')
        .send({
          key: 'invalid-license-key',
          guest_id: testGuestId
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid license key');
    });
  });

  describe('Guest Linking System', () => {
    test('POST /api/link-guest - should link guest to Firebase user', async () => {
      const response = await request(app)
        .post('/api/link-guest')
        .set('Authorization', 'Bearer valid-token')
        .send({ guest_id: testGuestId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.subscription).toBeDefined();
    });

    test('POST /api/link-guest - should fail for already linked device', async () => {
      const response = await request(app)
        .post('/api/link-guest')
        .set('Authorization', 'Bearer valid-token')
        .send({ guest_id: testGuestId })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already linked');
    });

    test('GET /api/my-subscription - should return user subscription', async () => {
      const response = await request(app)
        .get('/api/my-subscription')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBeDefined();
    });
  });

  describe('Plans System', () => {
    test('GET /api/plans - should return available plans', async () => {
      const response = await request(app)
        .get('/api/plans')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.plans).toBeDefined();
      expect(Array.isArray(response.body.plans)).toBe(true);
    });
  });

  describe('Checkout System', () => {
    test('POST /api/create-checkout-session - should create checkout session for guest', async () => {
      const response = await request(app)
        .post('/api/create-checkout-session')
        .send({
          guest_id: testGuestId,
          price_id: 'price_test_monthly',
          cancel_url: 'https://example.com/cancel',
          success_url: 'https://example.com/success',
          customer_email: 'test@example.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.checkoutUrl).toBeDefined();
    });

    test('POST /api/create-checkout-session - should fail for invalid price ID', async () => {
      const response = await request(app)
        .post('/api/create-checkout-session')
        .send({
          guest_id: testGuestId,
          price_id: 'invalid-price-id',
          cancel_url: 'https://example.com/cancel',
          success_url: 'https://example.com/success'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid price ID');
    });
  });

  describe('Rate Limiting', () => {
    test('POST /api/start-guest-trial - should respect rate limits', async () => {
      // Make multiple requests to trigger rate limit
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/start-guest-trial')
            .send({ device_id: `rate-limit-test-${i}` })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      // Should have some rate limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation', () => {
    test('POST /api/start-guest-trial - should validate required fields', async () => {
      const response = await request(app)
        .post('/api/start-guest-trial')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('device_id');
    });

    test('POST /api/redeem-license - should validate required fields', async () => {
      const response = await request(app)
        .post('/api/redeem-license')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('key');
    });
  });
});

describe('Admin System', () => {
  const adminKey = 'test-admin-key';

  beforeAll(() => {
    process.env.ADMIN_API_KEY = adminKey;
  });

  afterAll(() => {
    delete process.env.ADMIN_API_KEY;
  });

  test('POST /admin/generate-license-keys - should generate license keys', async () => {
    const response = await request(app)
      .post('/admin/generate-license-keys')
      .set('x-admin-key', adminKey)
      .send({
        plan_id: 'pro_monthly',
        count: 5,
        created_by: 'test-admin'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(5);
    expect(response.body.keys).toBeDefined();
    expect(response.body.keys.length).toBe(5);
  });

  test('GET /admin/license-keys - should list license keys', async () => {
    const response = await request(app)
      .get('/admin/license-keys')
      .set('x-admin-key', adminKey)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.license_keys).toBeDefined();
    expect(Array.isArray(response.body.license_keys)).toBe(true);
  });

  test('GET /admin/stats - should return admin statistics', async () => {
    const response = await request(app)
      .get('/admin/stats')
      .set('x-admin-key', adminKey)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.stats).toBeDefined();
    expect(response.body.stats.license_keys).toBeDefined();
    expect(response.body.stats.subscriptions).toBeDefined();
    expect(response.body.stats.devices).toBeDefined();
  });

  test('Admin routes should require admin key', async () => {
    const response = await request(app)
      .get('/admin/license-keys')
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Unauthorized');
  });
});
