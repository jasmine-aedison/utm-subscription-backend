# UTM Paywall System

A comprehensive paywall subsystem for the UTM subscription backend that supports guest trials, Firebase authentication, Stripe Checkout, and manual license keys.

## Features

- **Guest 3-Day Trials**: One trial per device, no signup required
- **Firebase Authentication**: Seamless user authentication and account linking
- **Stripe Integration**: Multiple subscription plans and billing periods
- **License Key System**: Manual license keys with expiry and single-use options
- **Device Tracking**: Secure device-based trial management
- **Guest Linking**: Convert guest trials to authenticated user accounts
- **Admin Panel**: License key generation and management
- **Rate Limiting**: Protection against abuse
- **Comprehensive API**: RESTful endpoints for all functionality

## Quick Start

### 1. Database Setup

Run the database migrations to create the paywall tables:

```bash
npm run migrate
```

### 2. Environment Variables

Add these environment variables to your `.env` file:

```env
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Firebase
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Security
ADMIN_API_KEY=your_admin_api_key
DEVICE_ID_SECRET=your_device_id_secret
LICENSE_KEY_SECRET=your_license_key_secret
```

### 3. Configure Stripe Plans

Update the `stripe_plans` table with your actual Stripe price IDs:

```sql
UPDATE stripe_plans SET stripe_price_id = 'price_1234567890' WHERE plan_key = 'pro_monthly';
UPDATE stripe_plans SET stripe_price_id = 'price_0987654321' WHERE plan_key = 'pro_yearly';
UPDATE stripe_plans SET stripe_price_id = 'price_1122334455' WHERE plan_key = 'pro_lifetime';
```

### 4. Start the Server

```bash
npm start
```

## API Usage

### Guest Trial Flow

1. **Start Trial**
```bash
curl -X POST http://localhost:3000/api/start-guest-trial \
  -H "Content-Type: application/json" \
  -d '{"device_id": "unique-device-id"}'
```

2. **Check Status**
```bash
curl "http://localhost:3000/api/check-subscription?guest_id=GUEST_ID"
```

3. **Link to Account** (when user signs up)
```bash
curl -X POST http://localhost:3000/api/link-guest \
  -H "Authorization: Bearer FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"guest_id": "GUEST_ID"}'
```

### Subscription Purchase

1. **Create Checkout Session**
```bash
curl -X POST http://localhost:3000/api/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{
    "guest_id": "GUEST_ID",
    "price_id": "price_monthly_pro",
    "cancel_url": "https://app.example.com/cancel",
    "success_url": "https://app.example.com/success",
    "customer_email": "user@example.com"
  }'
```

2. **Check Subscription Status**
```bash
curl -H "Authorization: Bearer FIREBASE_TOKEN" \
  "http://localhost:3000/api/my-subscription"
```

### License Key Management

1. **Generate License Keys** (Admin)
```bash
curl -X POST http://localhost:3000/admin/generate-license-keys \
  -H "x-admin-key: ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_id": "pro_monthly",
    "count": 100,
    "created_by": "admin_user"
  }'
```

2. **Redeem License Key**
```bash
curl -X POST http://localhost:3000/api/redeem-license \
  -H "Content-Type: application/json" \
  -d '{
    "key": "UTM-1234-5678-9ABC",
    "guest_id": "GUEST_ID"
  }'
```

## Database Schema

### Devices Table
Tracks guest device sessions and trials:
- `id`: UUID primary key
- `device_id`: Hashed device identifier (unique)
- `trial_start`: Trial start timestamp
- `trial_end`: Trial end timestamp
- `linked_uid`: Firebase UID if linked to account
- `subscription_status`: Current status

### User Subscriptions Table
Manages all subscription data:
- `id`: UUID primary key
- `uid`: Firebase UID (nullable for guests)
- `device_id`: Device ID (nullable for authenticated users)
- `stripe_customer_id`: Stripe customer ID
- `stripe_subscription_id`: Stripe subscription ID
- `plan_id`: Plan identifier
- `status`: Subscription status
- `trial_start/trial_end`: Trial information

### License Keys Table
Manages manual license keys:
- `id`: UUID primary key
- `key`: Hashed license key (unique)
- `plan_id`: Associated plan
- `expires_at`: Expiry date (null = lifetime)
- `single_use`: Single-use flag
- `bound_uid/device_id`: Binding information
- `redeemed_at`: Redemption timestamp

### Stripe Plans Table
Mirrors Stripe price configuration:
- `id`: Serial primary key
- `stripe_price_id`: Stripe price ID (unique)
- `plan_key`: Logical plan identifier
- `name`: Display name
- `period`: Billing period
- `amount`: Price in cents
- `currency`: Currency code

## Business Logic

### Trial Management
- Each device gets exactly one 3-day trial
- Trials are tracked by hashed device ID
- Trial information is preserved when linking to Firebase account
- Trial continues until original end date even after purchase

### Subscription States
- `none`: No subscription or trial
- `trial`: Active trial period
- `active`: Paid subscription active
- `expired`: Trial or subscription expired
- `past_due`: Payment failed
- `canceled`: Subscription canceled

### License Key Binding
- License keys bind to either Firebase UID or device ID
- Single-use keys cannot be redeemed twice
- Expired keys cannot be redeemed
- Binding happens on first redemption

### Guest Account Linking
- Guest trials can be linked to Firebase accounts
- Trial information is preserved during linking
- Device is marked as linked to prevent multiple trials
- Subscription data is migrated to user account

## Security Features

### Device ID Hashing
Device IDs are hashed server-side using HMAC-SHA256 to prevent enumeration attacks.

### License Key Hashing
License keys are hashed in the database to prevent exposure if database is compromised.

### Rate Limiting
- Guest trial: 5 requests per 15 minutes per IP
- License redemption: 10 requests per 15 minutes per IP
- General API: 100 requests per 15 minutes per IP

### Input Validation
All inputs are validated using Joi schemas to prevent injection attacks.

### Firebase Token Verification
All protected endpoints verify Firebase ID tokens using the Firebase Admin SDK.

## Admin Operations

### Generate License Keys
```bash
npm run admin:generate-keys -- --plan=pro_monthly --count=100 --expires=2025-12-31
```

### List License Keys
```bash
curl -H "x-admin-key: ADMIN_KEY" \
  "http://localhost:3000/admin/license-keys?limit=50&offset=0"
```

### Get Statistics
```bash
curl -H "x-admin-key: ADMIN_KEY" \
  "http://localhost:3000/admin/stats"
```

## Testing

Run the comprehensive test suite:

```bash
npm test
```

The test suite covers:
- Guest trial functionality
- Authentication flows
- License key redemption
- Guest account linking
- Rate limiting
- Input validation
- Admin operations

## Deployment

### Environment Setup
1. Set up PostgreSQL database
2. Configure Supabase connection
3. Set up Firebase project
4. Configure Stripe account
5. Set environment variables
6. Run database migrations

### Stripe Webhook Configuration
Configure your Stripe webhook endpoint:
- URL: `https://your-domain.com/webhook/stripe`
- Events: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.*`

### Monitoring
- Monitor webhook delivery in Stripe dashboard
- Check application logs for errors
- Monitor database performance
- Track subscription metrics

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify Supabase credentials
   - Check database permissions
   - Ensure tables exist

2. **Firebase Authentication Failures**
   - Verify Firebase project configuration
   - Check private key format
   - Ensure Firebase Admin SDK is properly initialized

3. **Stripe Webhook Failures**
   - Verify webhook secret
   - Check webhook endpoint URL
   - Monitor webhook delivery logs

4. **Rate Limiting Issues**
   - Check IP-based limits
   - Verify rate limit configuration
   - Monitor for abuse patterns

### Debug Mode
Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

### Health Checks
Monitor system health:
```bash
curl http://localhost:3000/health
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the API documentation
- Review the test suite for usage examples
- Consult the troubleshooting guide
