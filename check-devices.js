const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function checkDevices() {
  try {
    console.log('🔍 Checking devices in database...');
    
    const { data, error } = await supabase
      .from('devices')
      .select('id, device_id, trial_start, trial_end, subscription_status')
      .limit(10);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log('📋 Devices found:');
    data.forEach((device, index) => {
      console.log(`${index + 1}. ID: ${device.id}`);
      console.log(`   Device ID: ${device.device_id}`);
      console.log(`   Trial Start: ${device.trial_start}`);
      console.log(`   Trial End: ${device.trial_end}`);
      console.log(`   Status: ${device.subscription_status}`);
      console.log('---');
    });
    
    if (data.length === 0) {
      console.log('❌ No devices found in database');
    }
    
  } catch (error) {
    console.error('❌ Failed to check devices:', error);
  }
}

checkDevices();
