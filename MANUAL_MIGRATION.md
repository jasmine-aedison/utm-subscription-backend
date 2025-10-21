# Manual Database Migration

Since the automated migration is having connection issues, please follow these steps to manually set up the paywall database tables.

## Step 1: Access Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor** (in the left sidebar)

## Step 2: Run the Migration SQL

Copy and paste the following SQL into the SQL Editor and execute it:

```sql
-- Create devices table for guest device sessions
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    linked_uid TEXT NULL,
    trial_start TIMESTAMP NULL,
    trial_end TIMESTAMP NULL,
    subscription_status TEXT NOT NULL DEFAULT 'none' CHECK (subscription_status IN ('none', 'trial', 'active', 'expired'))
);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid TEXT NULL,
    device_id TEXT NULL,
    email TEXT NULL,
    stripe_customer_id TEXT NULL,
    stripe_subscription_id TEXT NULL,
    plan_id TEXT NULL,
    status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'past_due', 'canceled', 'expired')),
    trial_start TIMESTAMP NULL,
    trial_end TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create license_keys table (drop first if exists to fix schema issues)
DROP TABLE IF EXISTS license_keys CASCADE;

CREATE TABLE license_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    plan_id TEXT NOT NULL,
    expires_at TIMESTAMP NULL,
    single_use BOOLEAN DEFAULT true,
    bound_uid TEXT NULL,
    bound_device_id TEXT NULL,
    redeemed_at TIMESTAMP NULL,
    created_by TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create stripe_plans table
CREATE TABLE IF NOT EXISTS stripe_plans (
    id SERIAL PRIMARY KEY,
    stripe_price_id TEXT UNIQUE NOT NULL,
    plan_key TEXT NOT NULL,
    name TEXT NOT NULL,
    period TEXT NOT NULL CHECK (period IN ('monthly', 'yearly', 'lifetime')),
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_linked_uid ON devices(linked_uid);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_uid ON user_subscriptions(uid);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_device_id ON user_subscriptions(device_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(key);
CREATE INDEX IF NOT EXISTS idx_license_keys_bound_uid ON license_keys(bound_uid);
CREATE INDEX IF NOT EXISTS idx_license_keys_bound_device_id ON license_keys(bound_device_id);
CREATE INDEX IF NOT EXISTS idx_stripe_plans_stripe_price_id ON stripe_plans(stripe_price_id);
CREATE INDEX IF NOT EXISTS idx_stripe_plans_plan_key ON stripe_plans(plan_key);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_user_subscriptions_updated_at 
    BEFORE UPDATE ON user_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default stripe plans (these should be configured based on your Stripe setup)
INSERT INTO stripe_plans (stripe_price_id, plan_key, name, period, amount, currency) VALUES
('price_monthly_pro', 'pro_monthly', 'Pro Monthly', 'monthly', 999, 'usd'),
('price_yearly_pro', 'pro_yearly', 'Pro Yearly', 'yearly', 9999, 'usd'),
('price_lifetime_pro', 'pro_lifetime', 'Pro Lifetime', 'lifetime', 29999, 'usd')
ON CONFLICT (stripe_price_id) DO NOTHING;
```

## Step 3: Verify Tables Created

After running the SQL, verify the tables were created by running this query:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('devices', 'user_subscriptions', 'license_keys', 'stripe_plans');
```

You should see all 4 tables listed.

## Step 4: Update Stripe Price IDs

Once the tables are created, update the `stripe_plans` table with your actual Stripe price IDs:

```sql
-- Replace with your actual Stripe price IDs
UPDATE stripe_plans SET stripe_price_id = 'price_1234567890' WHERE plan_key = 'pro_monthly';
UPDATE stripe_plans SET stripe_price_id = 'price_0987654321' WHERE plan_key = 'pro_yearly';
UPDATE stripe_plans SET stripe_price_id = 'price_1122334455' WHERE plan_key = 'pro_lifetime';
```

## Step 5: Test the Connection

After the migration is complete, test your application:

```bash
npm start
```

Then test the health endpoint:

```bash
curl http://localhost:3000/health
```

## Troubleshooting

If you encounter any issues:

1. **Check table permissions**: Make sure your service role key has the necessary permissions
2. **Verify environment variables**: Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set correctly
3. **Check network connectivity**: Make sure your application can reach Supabase
4. **Review logs**: Check the application logs for any error messages

## Next Steps

After the migration is complete:

1. Configure your Stripe webhooks
2. Set up Firebase authentication
3. Deploy to Render
4. Test all API endpoints

The paywall system will be ready to use once the database tables are created!
