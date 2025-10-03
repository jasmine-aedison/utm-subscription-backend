const { getFirestore } = require('../config/firebase');
const { logger } = require('../utils/logger');

// Database setup script
const setupDatabase = async () => {
  try {
    const db = getFirestore();
    
    logger.info('🚀 Setting up database collections...');

    // Create collections with initial data
    await createInitialCollections(db);
    
    logger.info('✅ Database setup completed successfully');
    
  } catch (error) {
    logger.error('❌ Database setup failed:', error);
    throw error;
  }
};

// Create initial collections and indexes
const createInitialCollections = async (db) => {
  // Users collection
  const usersRef = db.collection('users');
  await usersRef.doc('_metadata').set({
    version: '1.0.0',
    createdAt: new Date(),
    description: 'Users collection for UTM subscription system'
  });

  // Subscriptions collection
  const subscriptionsRef = db.collection('subscriptions');
  await subscriptionsRef.doc('_metadata').set({
    version: '1.0.0',
    createdAt: new Date(),
    description: 'Subscriptions collection for UTM subscription system'
  });

  // License keys collection
  const licenseKeysRef = db.collection('license_keys');
  await licenseKeysRef.doc('_metadata').set({
    version: '1.0.0',
    createdAt: new Date(),
    description: 'License keys collection for UTM subscription system'
  });

  // Analytics collection
  const analyticsRef = db.collection('analytics');
  await analyticsRef.doc('_metadata').set({
    version: '1.0.0',
    createdAt: new Date(),
    description: 'Analytics collection for UTM subscription system'
  });

  logger.info('✅ Created collections: users, subscriptions, license_keys, analytics');
};

// Create sample license keys
const createSampleLicenseKeys = async () => {
  try {
    const db = getFirestore();
    const licenseKeysRef = db.collection('license_keys');
    
    const sampleKeys = [
      {
        key: 'UTM-ABCD1234-EFGH5678-IJKL9012',
        type: 'lifetime',
        status: 'active',
        createdAt: new Date(),
        expiresAt: null,
        metadata: {
          source: 'admin',
          notes: 'Sample lifetime license key'
        }
      },
      {
        key: 'UTM-MNOP3456-QRST7890-UVWX1234',
        type: 'lifetime',
        status: 'active',
        createdAt: new Date(),
        expiresAt: null,
        metadata: {
          source: 'admin',
          notes: 'Sample lifetime license key'
        }
      }
    ];

    for (const keyData of sampleKeys) {
      await licenseKeysRef.doc(keyData.key).set(keyData);
    }

    logger.info(`✅ Created ${sampleKeys.length} sample license keys`);
    
  } catch (error) {
    logger.error('❌ Failed to create sample license keys:', error);
    throw error;
  }
};

// Create subscription plans
const createSubscriptionPlans = async () => {
  try {
    const db = getFirestore();
    const plansRef = db.collection('subscription_plans');
    
    const plans = [
      {
        id: 'monthly',
        name: 'Monthly Subscription',
        price: 999, // $9.99 in cents
        currency: 'usd',
        interval: 'month',
        stripePriceId: process.env.STRIPE_MONTHLY_PRICE_ID,
        features: [
          'Access to Windows VMs',
          'Priority support',
          'Regular updates'
        ],
        isActive: true,
        createdAt: new Date()
      },
      {
        id: 'yearly',
        name: 'Yearly Subscription',
        price: 9999, // $99.99 in cents
        currency: 'usd',
        interval: 'year',
        stripePriceId: process.env.STRIPE_YEARLY_PRICE_ID,
        features: [
          'Access to Windows VMs',
          'Priority support',
          'Regular updates',
          '2 months free (compared to monthly)'
        ],
        isActive: true,
        createdAt: new Date()
      },
      {
        id: 'lifetime',
        name: 'Lifetime License',
        price: 29999, // $299.99 in cents
        currency: 'usd',
        interval: 'one_time',
        stripePriceId: process.env.STRIPE_LIFETIME_PRICE_ID,
        features: [
          'Access to Windows VMs',
          'Priority support',
          'Regular updates',
          'One-time payment',
          'Lifetime access'
        ],
        isActive: true,
        createdAt: new Date()
      }
    ];

    for (const plan of plans) {
      await plansRef.doc(plan.id).set(plan);
    }

    logger.info(`✅ Created ${plans.length} subscription plans`);
    
  } catch (error) {
    logger.error('❌ Failed to create subscription plans:', error);
    throw error;
  }
};

// Main setup function
const main = async () => {
  try {
    await setupDatabase();
    await createSampleLicenseKeys();
    await createSubscriptionPlans();
    
    logger.info('🎉 Database setup completed successfully!');
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Database setup failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  setupDatabase,
  createSampleLicenseKeys,
  createSubscriptionPlans
};
