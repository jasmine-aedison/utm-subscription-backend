require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testMigration() {
  try {
    console.log('🧪 Testing paywall system migration...');
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Test all tables
    const tables = [
      { name: 'devices', testQuery: () => supabase.from('devices').select('id').limit(1) },
      { name: 'user_subscriptions', testQuery: () => supabase.from('user_subscriptions').select('id').limit(1) },
      { name: 'license_keys', testQuery: () => supabase.from('license_keys').select('id').limit(1) },
      { name: 'stripe_plans', testQuery: () => supabase.from('stripe_plans').select('id').limit(1) }
    ];

    let allTablesWorking = true;

    for (const table of tables) {
      try {
        console.log(`\n🔍 Testing ${table.name}...`);
        const { data, error } = await table.testQuery();
        
        if (error) {
          console.log(`❌ ${table.name}: ${error.message}`);
          allTablesWorking = false;
        } else {
          console.log(`✅ ${table.name}: Working`);
        }
      } catch (err) {
        console.log(`❌ ${table.name}: ${err.message}`);
        allTablesWorking = false;
      }
    }

    if (allTablesWorking) {
      console.log('\n🎉 All tables are working correctly!');
      console.log('✅ Your paywall system is ready to use');
    } else {
      console.log('\n⚠️ Some tables have issues. Please check the migration.');
    }

    // Test specific license_keys columns
    console.log('\n🔍 Testing license_keys columns...');
    try {
      const { data, error } = await supabase
        .from('license_keys')
        .select('id, key, plan_id, bound_uid, bound_device_id, redeemed_at')
        .limit(1);

      if (error) {
        console.log('❌ license_keys columns error:', error.message);
      } else {
        console.log('✅ license_keys has all required columns');
      }
    } catch (err) {
      console.log('❌ license_keys column test failed:', err.message);
    }

  } catch (error) {
    console.error('❌ Migration test failed:', error);
  }
}

testMigration();
