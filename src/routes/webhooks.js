const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const Stripe = require('stripe');
const { supabase } = require('../lib/supabase');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function mapStripeStatus(s) {
  const map = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete_expired',
    trialing: 'trialing',
    unpaid: 'unpaid'
  };
  return map[s] || 'expired';
}

function typeFromPrice(priceId) {
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return 'monthly';
  if (priceId === process.env.STRIPE_PRICE_YEARLY) return 'yearly';
  if (priceId === process.env.STRIPE_PRICE_LIFETIME) return 'lifetime';
  return 'monthly';
}

router.post('/stripe', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object;
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_customer_id', sub.customer)
      .limit(1);

    if (users && users.length) {
      const userId = users[0].id;
      const status = mapStripeStatus(sub.status);
      const priceId = sub.items?.data?.[0]?.price?.id;
      const start = new Date(sub.current_period_start * 1000);
      const end = sub.cancel_at_period_end ? new Date(sub.current_period_end * 1000) : null;

      await supabase.from('subscriptions').upsert({
        user_id: userId,
        subscription_type: typeFromPrice(priceId),
        status,
        start_date: start,
        end_date: end,
        stripe_subscription_id: sub.id,
        stripe_price_id: priceId,
        last_synced_at: new Date()
      }, { onConflict: 'stripe_subscription_id' });
    }
  }

  res.json({ received: true });
});

module.exports = router;