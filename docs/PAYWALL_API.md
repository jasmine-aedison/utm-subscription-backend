# UTM Paywall API Documentation

This document describes the paywall subsystem API endpoints for the UTM subscription backend.

## Overview

The paywall system supports:
- Guest 3-day trials (one per device)
- Firebase-authenticated users
- Stripe Checkout integration (multiple plans & periods)
- Manual license keys (single-use or expiry)
- Device-based trial tracking
- Guest-to-user account linking

## Base URL

```
https://your-api-domain.com/api
```

## Authentication

### Firebase Authentication
Protected endpoints require a Firebase ID token in the Authorization header:
```
Authorization: Bearer <firebase-id-token>
```

### Admin Authentication
Admin endpoints require an admin API key:
```
x-admin-key: <admin-api-key>
```

## Public Endpoints

### Start Guest Trial

Start a 3-day trial for a guest device.

**Endpoint:** `POST /api/start-guest-trial`

**Request Body:**
```json
{
  "device_id": "unique-device-identifier"
}
```

**Response:**
```json
{
  "success": true,
  "guest_id": "uuid",
  "trial_start": "2025-01-18T10:00:00Z",
  "trial_end": "2025-01-21T10:00:00Z",
  "status": "trial",
  "is_trial_active": true,
  "trial_days_remaining": 3
}
```

**Rate Limit:** 5 requests per 15 minutes per IP

### Check Subscription Status

Check subscription status for guest or authenticated user.

**Endpoint:** `GET /api/check-subscription`

**Query Parameters:**
- `guest_id` (optional): Guest ID for device-based check
- Requires Firebase token in Authorization header for authenticated check

**Response:**
```json
{
  "success": true,
  "status": "trial|active|expired|none",
  "plan": {
    "id": "price_monthly_pro",
    "plan_key": "pro_monthly",
    "name": "Pro Monthly",
    "period": "monthly",
    "amount": 999,
    "currency": "usd",
    "formatted_price": "$9.99",
    "is_lifetime": false,
    "is_recurring": true
  },
  "trialStart": "2025-01-18T10:00:00Z",
  "trialEnd": "2025-01-21T10:00:00Z",
  "licenseKey": {
    "plan_id": "pro_monthly",
    "expires_at": null,
    "bound_to": { "uid": "firebase_uid" }
  }
}
```

### Get Available Plans

Get list of available subscription plans.

**Endpoint:** `GET /api/plans`

**Response:**
```json
{
  "success": true,
  "plans": [
    {
      "id": "price_monthly_pro",
      "plan_key": "pro_monthly",
      "name": "Pro Monthly",
      "period": "monthly",
      "amount": 999,
      "currency": "usd",
      "formatted_price": "$9.99",
      "price_per_month": 999,
      "savings_percentage": 0,
      "is_lifetime": false,
      "is_recurring": true
    }
  ]
}
```

### Create Checkout Session

Create a Stripe Checkout session for subscription purchase.

**Endpoint:** `POST /api/create-checkout-session`

**Request Body:**
```json
{
  "guest_id": "uuid (optional)",
  "price_id": "price_monthly_pro",
  "cancel_url": "https://app.example.com/cancel",
  "success_url": "https://app.example.com/success",
  "customer_email": "user@example.com (optional)",
  "uid": "firebase_uid (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_test_..."
}
```

### Redeem License Key

Redeem a license key for subscription access.

**Endpoint:** `POST /api/redeem-license`

**Request Body:**
```json
{
  "key": "UTM-XXXX-XXXX-XXXX",
  "guest_id": "uuid (optional)",
  "id_token": "firebase_id_token (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "plan_id": "pro_monthly",
  "expires_at": null,
  "bound_to": { "uid": "firebase_uid" }
}
```

**Rate Limit:** 10 requests per 15 minutes per IP

## Authenticated Endpoints

### Link Guest to Account

Link a guest trial to a Firebase user account.

**Endpoint:** `POST /api/link-guest`

**Headers:** `Authorization: Bearer <firebase-id-token>`

**Request Body:**
```json
{
  "guest_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "subscription": {
    "status": "trial",
    "plan": null,
    "trialStart": "2025-01-18T10:00:00Z",
    "trialEnd": "2025-01-21T10:00:00Z",
    "isActive": false,
    "isTrial": true,
    "trialDaysRemaining": 3
  }
}
```

### Get My Subscription

Get current user's subscription information.

**Endpoint:** `GET /api/my-subscription`

**Headers:** `Authorization: Bearer <firebase-id-token>`

**Response:**
```json
{
  "success": true,
  "status": "active",
  "plan": {
    "id": "price_monthly_pro",
    "plan_key": "pro_monthly",
    "name": "Pro Monthly",
    "period": "monthly",
    "amount": 999,
    "currency": "usd",
    "formatted_price": "$9.99",
    "is_lifetime": false,
    "is_recurring": true
  },
  "trialStart": null,
  "trialEnd": null,
  "isActive": true,
  "isTrial": false,
  "trialDaysRemaining": 0
}
```

## Admin Endpoints

### Generate License Keys

Generate license keys for distribution.

**Endpoint:** `POST /admin/generate-license-keys`

**Headers:** `x-admin-key: <admin-api-key>`

**Request Body:**
```json
{
  "plan_id": "pro_monthly",
  "count": 100,
  "expires_at": "2025-12-31T23:59:59Z (optional)",
  "single_use": true,
  "created_by": "admin_user_id"
}
```

**Response:**
```json
{
  "success": true,
  "count": 100,
  "plan_id": "pro_monthly",
  "keys": [
    "UTM-1234-5678-9ABC",
    "UTM-1234-5678-9ABD",
    "..."
  ],
  "expires_at": "2025-12-31T23:59:59Z",
  "single_use": true,
  "created_by": "admin_user_id"
}
```

### Revoke License Key

Revoke a license key.

**Endpoint:** `POST /admin/revoke-license`

**Headers:** `x-admin-key: <admin-api-key>`

**Request Body:**
```json
{
  "key": "UTM-1234-5678-9ABC"
}
```

**Response:**
```json
{
  "success": true,
  "message": "License key revoked successfully"
}
```

### List License Keys

Get paginated list of license keys.

**Endpoint:** `GET /admin/license-keys`

**Headers:** `x-admin-key: <admin-api-key>`

**Query Parameters:**
- `plan_id` (optional): Filter by plan
- `created_by` (optional): Filter by creator
- `limit` (optional): Results per page (default: 50, max: 100)
- `offset` (optional): Page offset (default: 0)

**Response:**
```json
{
  "success": true,
  "license_keys": [
    {
      "id": "uuid",
      "plan_id": "pro_monthly",
      "expires_at": null,
      "single_use": true,
      "bound_uid": "firebase_uid",
      "bound_device_id": null,
      "redeemed_at": "2025-01-18T10:00:00Z",
      "created_by": "admin_user_id",
      "created_at": "2025-01-18T10:00:00Z",
      "is_redeemed": true,
      "is_expired": false,
      "is_valid_for_redemption": false
    }
  ],
  "pagination": {
    "total": 1000,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

### Get Admin Statistics

Get system statistics for admin dashboard.

**Endpoint:** `GET /admin/stats`

**Headers:** `x-admin-key: <admin-api-key>`

**Response:**
```json
{
  "success": true,
  "stats": {
    "license_keys": {
      "total": 1000,
      "redeemed": 750,
      "unredeemed": 250,
      "redemption_rate": "75.00"
    },
    "subscriptions": {
      "active": 500,
      "total": 750
    },
    "devices": {
      "trial": 100,
      "total": 1000
    },
    "plans": {
      "pro_monthly": {
        "total": 500,
        "redeemed": 400
      },
      "pro_yearly": {
        "total": 300,
        "redeemed": 250
      }
    }
  }
}
```

## Webhook Endpoints

### Stripe Webhooks

Handle Stripe webhook events for subscription management.

**Endpoint:** `POST /webhook/stripe`

**Headers:** `stripe-signature: <stripe-signature>`

**Supported Events:**
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid token/key)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Rate Limiting

- **Guest Trial:** 5 requests per 15 minutes per IP
- **License Redemption:** 10 requests per 15 minutes per IP
- **General API:** 100 requests per 15 minutes per IP

## Security Considerations

1. **Device ID Hashing:** Device IDs are hashed server-side for security
2. **License Key Hashing:** License keys are hashed in the database
3. **Firebase Token Verification:** All protected endpoints verify Firebase tokens
4. **Admin Key Protection:** Admin endpoints require valid API key
5. **Rate Limiting:** Prevents abuse of sensitive endpoints
6. **Input Validation:** All inputs are validated using Joi schemas

## Business Logic

### Trial Continuation
When a user purchases a subscription during their trial period, the trial continues until the original trial end date before charging begins.

### One Trial Per Device
Each device can only have one trial. Attempting to start a trial on a device that already had one returns the existing trial information.

### License Key Binding
License keys are bound to either a Firebase UID (authenticated users) or device ID (guest users) upon first redemption.

### Guest Linking
When a guest links their account to Firebase, their trial information is preserved and the device is marked as linked to prevent multiple trials.

## Database Schema

### Devices Table
- `id` (UUID, Primary Key)
- `device_id` (TEXT, Unique, Hashed)
- `created_at` (TIMESTAMP)
- `last_seen` (TIMESTAMP)
- `linked_uid` (TEXT, Nullable)
- `trial_start` (TIMESTAMP, Nullable)
- `trial_end` (TIMESTAMP, Nullable)
- `subscription_status` (TEXT, Default: 'none')

### User Subscriptions Table
- `id` (UUID, Primary Key)
- `uid` (TEXT, Nullable)
- `device_id` (TEXT, Nullable)
- `email` (TEXT, Nullable)
- `stripe_customer_id` (TEXT, Nullable)
- `stripe_subscription_id` (TEXT, Nullable)
- `plan_id` (TEXT, Nullable)
- `status` (TEXT)
- `trial_start` (TIMESTAMP, Nullable)
- `trial_end` (TIMESTAMP, Nullable)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### License Keys Table
- `id` (UUID, Primary Key)
- `key` (TEXT, Unique, Hashed)
- `plan_id` (TEXT)
- `expires_at` (TIMESTAMP, Nullable)
- `single_use` (BOOLEAN, Default: true)
- `bound_uid` (TEXT, Nullable)
- `bound_device_id` (TEXT, Nullable)
- `redeemed_at` (TIMESTAMP, Nullable)
- `created_by` (TEXT, Nullable)
- `created_at` (TIMESTAMP)

### Stripe Plans Table
- `id` (SERIAL, Primary Key)
- `stripe_price_id` (TEXT, Unique)
- `plan_key` (TEXT)
- `name` (TEXT)
- `period` (TEXT)
- `amount` (INTEGER)
- `currency` (TEXT, Default: 'usd')
- `created_at` (TIMESTAMP)
