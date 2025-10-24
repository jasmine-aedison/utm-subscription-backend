const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function checkLicenseKeys() {
  try {
    console.log('🔍 Checking license keys in database...');
    
    const { data, error } = await supabase
      .from('license_keys')
      .select('key, plan_id, expires_at, redeemed_at')
      .limit(10);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log('📋 License keys found:');
    data.forEach((key, index) => {
      console.log(`${index + 1}. Key: ${key.key}`);
      console.log(`   Plan: ${key.plan_id}`);
      console.log(`   Expires: ${key.expires_at || 'Never'}`);
      console.log(`   Redeemed: ${key.redeemed_at || 'No'}`);
      console.log('---');
    });
    
    if (data.length === 0) {
      console.log('❌ No license keys found in database');
    }
    
  } catch (error) {
    console.error('❌ Failed to check license keys:', error);
  }
}

checkLicenseKeys();
