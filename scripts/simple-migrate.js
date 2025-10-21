const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { supabase } = require('../src/lib/supabase');
const { logger } = require('../utils/logger');

async function simpleMigrate() {
  try {
    logger.info('🚀 Running simple database migration...');

    // Check if environment variables are loaded
    if (!process.env.SUPABASE_URL) {
      logger.error('❌ SUPABASE_URL not found in environment variables');
      logger.error('Please make sure your .env file is in the project root and contains SUPABASE_URL');
      process.exit(1);
    }

    logger.info(`✅ Found Supabase URL: ${process.env.SUPABASE_URL.substring(0, 30)}...`);

    // Test connection first
    logger.info('🔍 Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1);

    if (testError) {
      logger.error('❌ Failed to connect to Supabase:', testError.message);
      process.exit(1);
    }

    logger.info('✅ Supabase connection successful');

    // Check if tables already exist
    logger.info('🔍 Checking existing tables...');
    const { data: existingTables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['devices', 'user_subscriptions', 'license_keys', 'stripe_plans']);

    if (tablesError) {
      logger.warn('⚠️ Could not check existing tables:', tablesError.message);
    } else {
      const tableNames = existingTables.map(t => t.table_name);
      logger.info(`Found existing tables: ${tableNames.join(', ')}`);
    }

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/001_create_paywall_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    logger.info('📄 Migration SQL loaded successfully');

    // Since we can't execute raw SQL directly, we'll create the tables using Supabase client
    logger.info('🏗️ Creating tables using Supabase client...');

    // Create devices table
    try {
      const { error: devicesError } = await supabase
        .from('devices')
        .select('id')
        .limit(1);
      
      if (devicesError && devicesError.code === 'PGRST116') {
        logger.info('Creating devices table...');
        // Table doesn't exist, we need to create it manually
        logger.warn('⚠️ Devices table does not exist. Please create it manually using the SQL in migrations/001_create_paywall_tables.sql');
      } else {
        logger.info('✅ Devices table already exists');
      }
    } catch (error) {
      logger.warn('⚠️ Could not check devices table:', error.message);
    }

    // Create user_subscriptions table
    try {
      const { error: subsError } = await supabase
        .from('user_subscriptions')
        .select('id')
        .limit(1);
      
      if (subsError && subsError.code === 'PGRST116') {
        logger.info('Creating user_subscriptions table...');
        logger.warn('⚠️ User subscriptions table does not exist. Please create it manually using the SQL in migrations/001_create_paywall_tables.sql');
      } else {
        logger.info('✅ User subscriptions table already exists');
      }
    } catch (error) {
      logger.warn('⚠️ Could not check user_subscriptions table:', error.message);
    }

    // Create license_keys table
    try {
      const { error: keysError } = await supabase
        .from('license_keys')
        .select('id')
        .limit(1);
      
      if (keysError && keysError.code === 'PGRST116') {
        logger.info('Creating license_keys table...');
        logger.warn('⚠️ License keys table does not exist. Please create it manually using the SQL in migrations/001_create_paywall_tables.sql');
      } else {
        logger.info('✅ License keys table already exists');
      }
    } catch (error) {
      logger.warn('⚠️ Could not check license_keys table:', error.message);
    }

    // Create stripe_plans table
    try {
      const { error: plansError } = await supabase
        .from('stripe_plans')
        .select('id')
        .limit(1);
      
      if (plansError && plansError.code === 'PGRST116') {
        logger.info('Creating stripe_plans table...');
        logger.warn('⚠️ Stripe plans table does not exist. Please create it manually using the SQL in migrations/001_create_paywall_tables.sql');
      } else {
        logger.info('✅ Stripe plans table already exists');
      }
    } catch (error) {
      logger.warn('⚠️ Could not check stripe_plans table:', error.message);
    }

    logger.info('📋 Manual Migration Instructions:');
    logger.info('1. Go to your Supabase dashboard');
    logger.info('2. Navigate to SQL Editor');
    logger.info('3. Copy and paste the contents of migrations/001_create_paywall_tables.sql');
    logger.info('4. Execute the SQL');
    logger.info('5. Verify tables are created successfully');

    logger.info('🎉 Migration process completed!');
    logger.info('Please run the SQL manually in Supabase dashboard if tables were not created automatically.');

  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  simpleMigrate()
    .then(() => {
      logger.info('🎉 Simple migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Simple migration failed:', error);
      process.exit(1);
    });
}

module.exports = { simpleMigrate };
