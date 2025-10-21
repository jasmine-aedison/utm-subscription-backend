require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkDatabaseSchema() {
  try {
    console.log('🔍 Checking database schema...');
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing Supabase environment variables');
      process.exit(1);
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('✅ Supabase client created');

    // Check if tables exist
    const tables = ['devices', 'user_subscriptions', 'license_keys', 'stripe_plans'];
    
    for (const table of tables) {
      try {
        console.log(`\n🔍 Checking table: ${table}`);
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (error) {
          console.log(`❌ Table ${table} error:`, error.message);
        } else {
          console.log(`✅ Table ${table} exists and accessible`);
        }
      } catch (err) {
        console.log(`❌ Table ${table} not accessible:`, err.message);
      }
    }

    // Check license_keys table structure specifically
    console.log('\n🔍 Checking license_keys table structure...');
    try {
      const { data, error } = await supabase
        .from('license_keys')
        .select('*')
        .limit(1);

      if (error) {
        console.log('❌ license_keys table error:', error.message);
        if (error.message.includes('bound_uid')) {
          console.log('💡 The license_keys table exists but is missing the bound_uid column');
          console.log('💡 Please run the corrected migration SQL in Supabase dashboard');
        }
      } else {
        console.log('✅ license_keys table structure is correct');
      }
    } catch (err) {
      console.log('❌ Could not check license_keys structure:', err.message);
    }

  } catch (error) {
    console.error('❌ Schema check failed:', error);
  }
}

checkDatabaseSchema();
