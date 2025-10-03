# UTM Subscription Backend

A comprehensive backend API for the UTM authentication and subscription system, built with Node.js, Express, Firebase, and Stripe.

## 🚀 Features

- **Firebase Authentication** - Email/password and social login support
- **Stripe Integration** - Monthly, yearly, and lifetime subscription handling
- **Payment Processing** - Secure payment processing with webhooks
- **License Key System** - Support for license key redemption
- **User Management** - Complete user profile and subscription management
- **Webhook Handling** - Real-time subscription status updates
- **Security** - Rate limiting, input validation, and error handling

## 📋 Prerequisites

- Node.js 18+ 
- Firebase project with Authentication and Firestore
- Stripe account with API keys
- Git (for version control)

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/utm-subscription-backend.git
   cd utm-subscription-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Run the complete setup:**
   ```bash
   ./scripts/setup-complete.sh
   ```

## 🔧 Configuration

### Environment Variables

Copy `env.example` to `.env` and configure:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Price IDs (create these in Stripe dashboard)
STRIPE_MONTHLY_PRICE_ID=price_monthly_id
STRIPE_YEARLY_PRICE_ID=price_yearly_id
STRIPE_LIFETIME_PRICE_ID=price_lifetime_id
```

## 🚀 Quick Start

### Automated Setup
```bash
# Run the complete setup script
./scripts/setup-complete.sh
```

### Manual Setup
```bash
# 1. Install dependencies
npm install

# 2. Set up Firebase
./scripts/setup-firebase.sh

# 3. Set up Stripe
./scripts/setup-stripe.sh

# 4. Initialize database
node scripts/setup-database.js

# 5. Start development server
npm run dev
```

## 📚 API Documentation

### Authentication Endpoints

#### POST `/api/auth/verify`
Verify Firebase ID token and create/get user
```json
{
  "idToken": "firebase_id_token"
}
```

#### GET `/api/auth/me`
Get current user profile

#### PUT `/api/auth/me`
Update user profile
```json
{
  "displayName": "John Doe",
  "photoURL": "https://example.com/photo.jpg"
}
```

### Subscription Endpoints

#### GET `/api/subscriptions/me`
Get user's current subscription

#### POST `/api/subscriptions/create`
Create new subscription
```json
{
  "plan": "monthly",
  "paymentMethodId": "pm_xxx"
}
```

#### POST `/api/subscriptions/cancel`
Cancel subscription
```json
{
  "immediately": false
}
```

#### POST `/api/subscriptions/redeem-license`
Redeem license key
```json
{
  "licenseKey": "UTM-ABCD1234-EFGH5678-IJKL9012"
}
```

### Webhook Endpoints

#### POST `/api/webhooks/stripe`
Stripe webhook endpoint for subscription events

## 🔒 Security Features

- **Rate Limiting** - Prevents abuse with configurable limits
- **Input Validation** - Joi-based request validation
- **Authentication** - Firebase ID token verification
- **Authorization** - Subscription-based access control
- **Error Handling** - Comprehensive error logging and handling
- **CORS** - Configurable cross-origin resource sharing

## 📊 Monitoring

- **Logging** - Winston-based logging with file rotation
- **Health Checks** - `/health` endpoint for monitoring
- **Error Tracking** - Detailed error logging and reporting

## 🚀 Deployment

### Using Docker
```bash
docker-compose up -d
```

### Using PM2
```bash
npm install -g pm2
pm2 start server.js --name utm-backend
pm2 save
pm2 startup
```

### Using Google Cloud Run
```bash
gcloud run deploy utm-backend --source . --platform managed --region us-central1
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📝 Development

### Project Structure
```
├── config/           # Configuration files
├── models/           # Data models
├── routes/           # API routes
├── middleware/        # Middleware functions
├── scripts/          # Setup and deployment scripts
├── utils/            # Utility functions
├── logs/             # Log files
└── tests/            # Test files
```

### Adding New Features

1. Create new route files in `routes/`
2. Add corresponding models in `models/`
3. Update middleware as needed
4. Add tests in `tests/`
5. Update documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes
4. Add tests for new functionality
5. Commit your changes: `git commit -m 'Add new feature'`
6. Push to the branch: `git push origin feature/new-feature`
7. Submit a pull request

## 📞 Support

For support with the backend API, please:
1. Check the documentation
2. Search existing issues
3. Create a new issue with detailed information

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [UTM Frontend](https://github.com/your-org/UTM) - The main UTM application
- [UTM Documentation](https://docs.utm.app) - Complete documentation

## 📈 Roadmap

- [ ] GraphQL API support
- [ ] Advanced analytics
- [ ] Multi-tenant support
- [ ] Advanced caching
- [ ] Microservices architecture