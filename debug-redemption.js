require('dotenv').config();
const LicenseKey = require('./models/LicenseKey');

async function debugRedemption() {
  try {
    console.log('🔍 Debugging license redemption...');
    
    const key = 'AES-LIFE-2024-WXYZ-ABCD-EFGH-IJKL';
    console.log('Looking for key:', key);
    
    // Test the getByKey method
    const licenseKey = await LicenseKey.getByKey(key);
    console.log('LicenseKey.getByKey result:', licenseKey);
    
    if (licenseKey) {
      console.log('License key found!');
      console.log('isRedeemed():', licenseKey.isRedeemed());
      console.log('isExpired():', licenseKey.isExpired());
      console.log('isValidForRedemption():', licenseKey.isValidForRedemption());
      console.log('redeemedAt:', licenseKey.redeemedAt);
      console.log('expiresAt:', licenseKey.expiresAt);
    } else {
      console.log('❌ License key not found!');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugRedemption();
