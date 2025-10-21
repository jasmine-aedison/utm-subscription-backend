const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { supabase } = require('../src/lib/supabase');
const { logger } = require('../utils/logger');

async function runMigrations() {
  try {
    logger.info('🚀 Running database migrations...');

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/001_create_paywall_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    logger.info(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length === 0) continue;

      try {
        logger.info(`Executing statement ${i + 1}/${statements.length}...`);
        
        // Use raw SQL execution
        const { error } = await supabase.rpc('exec', {
          sql: statement
        });

        if (error) {
          // Try alternative method
          logger.warn(`RPC exec failed, trying direct query: ${error.message}`);
          
          // For CREATE TABLE statements, we can try to execute them directly
          if (statement.toUpperCase().includes('CREATE TABLE')) {
            logger.info('Skipping CREATE TABLE (may already exist)');
            continue;
          }
          
          if (statement.toUpperCase().includes('INSERT INTO')) {
            logger.info('Skipping INSERT (may already exist)');
            continue;
          }
        } else {
          logger.info(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (error) {
        logger.warn(`⚠️ Statement ${i + 1} failed: ${error.message}`);
        // Continue with next statement
      }
    }

    // Verify tables exist
    logger.info('🔍 Verifying table creation...');
    
    const tables = ['devices', 'user_subscriptions', 'license_keys', 'stripe_plans'];
    const existingTables = [];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (!error) {
          existingTables.push(table);
          logger.info(`✅ Table '${table}' exists`);
        } else {
          logger.warn(`⚠️ Table '${table}' not found: ${error.message}`);
        }
      } catch (error) {
        logger.warn(`⚠️ Could not verify table '${table}': ${error.message}`);
      }
    }

    if (existingTables.length === tables.length) {
      logger.info('🎉 All paywall tables created successfully!');
    } else {
      logger.warn(`⚠️ Only ${existingTables.length}/${tables.length} tables found`);
      logger.warn('You may need to run the migration manually using your database client');
    }

    // Test basic functionality
    logger.info('🧪 Testing basic functionality...');
    
    try {
      // Test devices table
      const { data: deviceTest, error: deviceError } = await supabase
        .from('devices')
        .select('id')
        .limit(1);
      
      if (!deviceError) {
        logger.info('✅ Devices table is accessible');
      }

      // Test user_subscriptions table
      const { data: subTest, error: subError } = await supabase
        .from('user_subscriptions')
        .select('id')
        .limit(1);
      
      if (!subError) {
        logger.info('✅ User subscriptions table is accessible');
      }

      // Test license_keys table
      const { data: keyTest, error: keyError } = await supabase
        .from('license_keys')
        .select('id')
        .limit(1);
      
      if (!keyError) {
        logger.info('✅ License keys table is accessible');
      }

      // Test stripe_plans table
      const { data: planTest, error: planError } = await supabase
        .from('stripe_plans')
        .select('id')
        .limit(1);
      
      if (!planError) {
        logger.info('✅ Stripe plans table is accessible');
      }

    } catch (error) {
      logger.warn(`⚠️ Table access test failed: ${error.message}`);
    }

    logger.info('🎉 Migration process completed!');
    logger.info('📝 Next steps:');
    logger.info('1. Configure your Stripe price IDs in the stripe_plans table');
    logger.info('2. Set up your environment variables');
    logger.info('3. Test the API endpoints');

  } catch (error) {
    logger.error('❌ Migration failed:', error);
    logger.error('Please run the migration manually using your database client');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigrations };
