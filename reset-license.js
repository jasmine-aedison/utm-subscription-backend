require('dotenv').config();
const { supabase } = require('./src/lib/supabase');

async function resetLicense() {
  try {
    console.log('🔄 Resetting license key...');
    
    const { data, error } = await supabase
      .from('license_keys')
      .update({ 
        redeemed_at: null,
        bound_uid: null,
        bound_device_id: null
      })
      .eq('key', 'AES-LIFE-2024-WXYZ-ABCD-EFGH-IJKL')
      .select();
    
    console.log('Reset result:', { data, error });
    
  } catch (error) {
    console.error('❌ Reset failed:', error);
  }
}

resetLicense();
