-- Fix license_keys table if it exists with wrong schema
-- First, let's check if the table exists and what columns it has

-- Drop and recreate license_keys table with correct schema
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

-- Create indexes for license_keys
CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(key);
CREATE INDEX IF NOT EXISTS idx_license_keys_bound_uid ON license_keys(bound_uid);
CREATE INDEX IF NOT EXISTS idx_license_keys_bound_device_id ON license_keys(bound_device_id);

-- Also ensure other tables exist with correct schema
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

-- Create all necessary indexes
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_linked_uid ON devices(linked_uid);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_uid ON user_subscriptions(uid);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_device_id ON user_subscriptions(device_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
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
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at 
    BEFORE UPDATE ON user_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default stripe plans (these should be configured based on your Stripe setup)
INSERT INTO stripe_plans (stripe_price_id, plan_key, name, period, amount, currency) VALUES
('price_monthly_pro', 'pro_monthly', 'Pro Monthly', 'monthly', 999, 'usd'),
('price_yearly_pro', 'pro_yearly', 'Pro Yearly', 'yearly', 9999, 'usd'),
('price_lifetime_pro', 'pro_lifetime', 'Pro Lifetime', 'lifetime', 29999, 'usd')
ON CONFLICT (stripe_price_id) DO NOTHING;
