const express = require('express');
const admin = require('firebase-admin');
const { supabase } = require('../lib/supabase');
const router = express.Router();

router.post('/verify', async (req, res) => {
  try {
    const { idToken } = req.body;
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = (decoded.email || '').toLowerCase();

    const { data: user, error } = await supabase
      .from('users')
      .upsert({ firebase_uid: uid, email, display_name: decoded.name ?? null }, { onConflict: 'firebase_uid' })
      .select()
      .single();
    if (error) throw error;

    const { data: ent } = await supabase
      .from('v_user_entitlement')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const hasActive = ent ? (ent.has_lifetime || ent.has_active_sub) : false;
    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        email: user.email,
        displayName: user.display_name,
        photoURL: null,
        createdAt: new Date(user.created_at).getTime() / 1000, // Convert to Unix timestamp
        lastLoginAt: new Date().getTime() / 1000, // Convert to Unix timestamp
        subscription: null
      }, 
      hasActiveSubscription: hasActive 
    });
  } catch (e) {
    res.status(401).json({ success: false, error: e.message });
  }
});

module.exports = router;