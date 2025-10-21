const admin = require('firebase-admin');
const { supabase } = require('../lib/supabase');

module.exports = async function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, error: 'No token' });

    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;
    const email = (decoded.email || '').toLowerCase();

    const { data: user, error } = await supabase
      .from('users')
      .upsert({ firebase_uid: uid, email, display_name: decoded.name ?? null }, { onConflict: 'firebase_uid' })
      .select()
      .single();

    if (error) throw error;

    req.user = { firebaseUid: uid, email, supabaseUserId: user.id };
    next();
  } catch (e) {
    res.status(401).json({ success: false, error: e.message });
  }
};