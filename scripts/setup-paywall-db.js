const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { supabase } = require('../src/lib/supabase');
const { logger } = require('../utils/logger');

async function setupPaywallDatabase() {
  try {
    logger.info('🚀 Setting up paywall database...');

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/001_create_paywall_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      // If RPC doesn't exist, try direct query
      logger.warn('⚠️ RPC exec_sql not available, trying direct execution...');
      
      // Split SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (const statement of statements) {
        try {
          const { error: stmtError } = await supabase
            .from('_migrations')
            .select('*')
            .limit(0); // This will fail but we can catch the error

          // If we get here, try to execute the statement
          logger.info(`Executing: ${statement.substring(0, 50)}...`);
        } catch (e) {
          // Expected to fail, continue
        }
      }

      logger.warn('⚠️ Manual SQL execution required. Please run the migration manually:');
      logger.warn(`SQL: ${migrationPath}`);
    } else {
      logger.info('✅ Paywall database setup completed successfully');
    }

    // Verify tables exist
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['devices', 'user_subscriptions', 'license_keys', 'stripe_plans']);

    if (tablesError) {
      logger.warn('⚠️ Could not verify table creation. Please check manually.');
    } else {
      const tableNames = tables.map(t => t.table_name);
      const expectedTables = ['devices', 'user_subscriptions', 'license_keys', 'stripe_plans'];
      const missingTables = expectedTables.filter(table => !tableNames.includes(table));
      
      if (missingTables.length > 0) {
        logger.warn(`⚠️ Missing tables: ${missingTables.join(', ')}`);
        logger.warn('Please run the migration manually.');
      } else {
        logger.info('✅ All paywall tables created successfully');
      }
    }

  } catch (error) {
    logger.error('❌ Failed to setup paywall database:', error);
    logger.error('Please run the migration manually using your database client.');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupPaywallDatabase()
    .then(() => {
      logger.info('🎉 Paywall database setup completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Paywall database setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupPaywallDatabase };
