require('dotenv').config();
const { supabase } = require('./src/lib/supabase');

async function debugLicenseKey() {
  try {
    console.log('🔍 Checking license key in database...');
    
    // Check if the exact key exists
    const { data: exactMatch, error: exactError } = await supabase
      .from('license_keys')
      .select('*')
      .eq('key', 'AES-LIFE-2024-WXYZ-ABCD-EFGH-IJKL')
      .single();
    
    console.log('Exact match result:', { data: exactMatch, error: exactError });
    
    // Check all license keys to see what's actually in the database
    const { data: allKeys, error: allError } = await supabase
      .from('license_keys')
      .select('key, id, plan_id, expires_at, redeemed_at')
      .limit(10);
    
    console.log('All license keys:', allKeys);
    console.log('All keys error:', allError);
    
    // Check if there are any keys that contain "AES"
    const { data: aesKeys, error: aesError } = await supabase
      .from('license_keys')
      .select('key, id, plan_id, expires_at, redeemed_at')
      .ilike('key', '%AES%');
    
    console.log('Keys containing AES:', aesKeys);
    console.log('AES keys error:', aesError);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugLicenseKey();
