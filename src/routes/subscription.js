const express = require('express');
const { supabase } = require('../lib/supabase');
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/redeem-license', auth, async (req, res) => {
  try {
    const { licenseKey } = req.body;
    const userId = req.user.supabaseUserId;

    const { data: key } = await supabase
      .from('license_keys')
      .select('*')
      .eq('key', licenseKey)
      .eq('is_redeemed', false)
      .maybeSingle();
    if (!key) return res.status(400).json({ success: false, error: 'Invalid or redeemed key' });

    await supabase.from('license_keys').update({
      is_redeemed: true, redeemed_by: userId, redeemed_at: new Date()
    }).eq('id', key.id);

    await supabase.from('subscriptions').insert({
      user_id: userId,
      subscription_type: 'lifetime',
      status: 'active',
      start_date: new Date()
    });

    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/me', auth, async (req, res) => {
  const { supabaseUserId } = req.user;
  const { data: ent } = await supabase
    .from('v_user_entitlement')
    .select('*')
    .eq('user_id', supabaseUserId)
    .maybeSingle();
  const hasActive = ent ? (ent.has_lifetime || ent.has_active_sub) : false;
  res.json({ success: true, subscription: { hasActive } });
});

module.exports = router;