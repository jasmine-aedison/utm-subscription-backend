#!/bin/bash

# Stripe Setup Script for UTM Subscription System
# This script helps set up Stripe for the UTM subscription system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if Stripe CLI is installed
check_stripe_cli() {
    log_info "Checking Stripe CLI..."
    
    if ! command -v stripe &> /dev/null; then
        log_error "Stripe CLI is not installed"
        log_info "Install it with: brew install stripe/stripe-cli/stripe"
        exit 1
    fi
    
    log_info "Stripe CLI is installed"
}

# Login to Stripe
stripe_login() {
    log_step "Logging into Stripe..."
    stripe login
    log_info "Logged into Stripe"
}

# Create products
create_products() {
    log_step "Creating Stripe products..."
    
    # Monthly subscription product
    log_info "Creating monthly subscription product..."
    MONTHLY_PRODUCT=$(stripe products create \
        --name "UTM Monthly Subscription" \
        --description "Monthly subscription for UTM Windows VM access" \
        --metadata source=utm_app \
        --format json | jq -r '.id')
    
    # Yearly subscription product
    log_info "Creating yearly subscription product..."
    YEARLY_PRODUCT=$(stripe products create \
        --name "UTM Yearly Subscription" \
        --description "Yearly subscription for UTM Windows VM access" \
        --metadata source=utm_app \
        --format json | jq -r '.id')
    
    # Lifetime license product
    log_info "Creating lifetime license product..."
    LIFETIME_PRODUCT=$(stripe products create \
        --name "UTM Lifetime License" \
        --description "Lifetime license for UTM Windows VM access" \
        --metadata source=utm_app \
        --format json | jq -r '.id')
    
    log_info "Products created:"
    log_info "Monthly: $MONTHLY_PRODUCT"
    log_info "Yearly: $YEARLY_PRODUCT"
    log_info "Lifetime: $LIFETIME_PRODUCT"
}

# Create prices
create_prices() {
    log_step "Creating Stripe prices..."
    
    # Monthly price
    log_info "Creating monthly price..."
    MONTHLY_PRICE=$(stripe prices create \
        --product $MONTHLY_PRODUCT \
        --unit-amount 999 \
        --currency usd \
        --recurring interval=month \
        --metadata source=utm_app \
        --format json | jq -r '.id')
    
    # Yearly price
    log_info "Creating yearly price..."
    YEARLY_PRICE=$(stripe prices create \
        --product $YEARLY_PRODUCT \
        --unit-amount 9999 \
        --currency usd \
        --recurring interval=year \
        --metadata source=utm_app \
        --format json | jq -r '.id')
    
    # Lifetime price
    log_info "Creating lifetime price..."
    LIFETIME_PRICE=$(stripe prices create \
        --product $LIFETIME_PRODUCT \
        --unit-amount 29999 \
        --currency usd \
        --metadata source=utm_app \
        --format json | jq -r '.id')
    
    log_info "Prices created:"
    log_info "Monthly: $MONTHLY_PRICE"
    log_info "Yearly: $YEARLY_PRICE"
    log_info "Lifetime: $LIFETIME_PRICE"
}

# Create webhook endpoint
create_webhook() {
    log_step "Creating Stripe webhook endpoint..."
    
    read -p "Enter your webhook URL (e.g., https://api.utm.app/api/webhooks/stripe): " WEBHOOK_URL
    
    if [[ -z "$WEBHOOK_URL" ]]; then
        log_warn "No webhook URL provided, skipping webhook creation"
        return
    fi
    
    # Create webhook endpoint
    WEBHOOK_ID=$(stripe webhook_endpoints create \
        --url $WEBHOOK_URL \
        --enabled-events customer.subscription.created \
        --enabled-events customer.subscription.updated \
        --enabled-events customer.subscription.deleted \
        --enabled-events invoice.payment_succeeded \
        --enabled-events invoice.payment_failed \
        --enabled-events customer.subscription.trial_will_end \
        --format json | jq -r '.id')
    
    # Get webhook secret
    WEBHOOK_SECRET=$(stripe webhook_endpoints retrieve $WEBHOOK_ID --format json | jq -r '.secret')
    
    log_info "Webhook created: $WEBHOOK_ID"
    log_info "Webhook secret: $WEBHOOK_SECRET"
}

# Get API keys
get_api_keys() {
    log_step "Getting Stripe API keys..."
    
    # Get publishable key
    PUBLISHABLE_KEY=$(stripe config --format json | jq -r '.publishable_key')
    
    # Get secret key
    SECRET_KEY=$(stripe config --format json | jq -r '.secret_key')
    
    log_info "API keys retrieved"
    log_info "Publishable key: $PUBLISHABLE_KEY"
    log_info "Secret key: $SECRET_KEY"
}

# Update .env file
update_env_file() {
    log_step "Updating .env file..."
    
    if [[ -f ".env" ]]; then
        # Update existing .env file
        sed -i.bak "s/STRIPE_SECRET_KEY=.*/STRIPE_SECRET_KEY=$SECRET_KEY/" .env
        sed -i.bak "s/STRIPE_PUBLISHABLE_KEY=.*/STRIPE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY/" .env
        sed -i.bak "s/STRIPE_WEBHOOK_SECRET=.*/STRIPE_WEBHOOK_SECRET=$WEBHOOK_SECRET/" .env
        sed -i.bak "s/STRIPE_MONTHLY_PRICE_ID=.*/STRIPE_MONTHLY_PRICE_ID=$MONTHLY_PRICE/" .env
        sed -i.bak "s/STRIPE_YEARLY_PRICE_ID=.*/STRIPE_YEARLY_PRICE_ID=$YEARLY_PRICE/" .env
        sed -i.bak "s/STRIPE_LIFETIME_PRICE_ID=.*/STRIPE_LIFETIME_PRICE_ID=$LIFETIME_PRICE/" .env
        
        rm .env.bak
    else
        # Create new .env file
        cat >> .env << EOF

# Stripe Configuration
STRIPE_SECRET_KEY=$SECRET_KEY
STRIPE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=$WEBHOOK_SECRET
STRIPE_MONTHLY_PRICE_ID=$MONTHLY_PRICE
STRIPE_YEARLY_PRICE_ID=$YEARLY_PRICE
STRIPE_LIFETIME_PRICE_ID=$LIFETIME_PRICE
EOF
    fi
    
    log_info ".env file updated with Stripe configuration"
}

# Test webhook
test_webhook() {
    log_step "Testing webhook..."
    
    if [[ -n "$WEBHOOK_ID" ]]; then
        log_info "Testing webhook endpoint..."
        stripe events create --type customer.subscription.created
        
        log_info "Webhook test event sent"
        log_info "Check your webhook endpoint to ensure it's receiving events"
    fi
}

# Create sample customers
create_sample_customers() {
    log_step "Creating sample customers..."
    
    # Create test customer
    TEST_CUSTOMER=$(stripe customers create \
        --email "test@utm.app" \
        --name "Test User" \
        --metadata source=utm_app \
        --format json | jq -r '.id')
    
    log_info "Test customer created: $TEST_CUSTOMER"
}

# Main setup function
main() {
    log_info "Starting Stripe setup for UTM Subscription System..."
    
    check_stripe_cli
    stripe_login
    create_products
    create_prices
    create_webhook
    get_api_keys
    update_env_file
    test_webhook
    create_sample_customers
    
    log_info "Stripe setup completed successfully!"
    log_info "Next steps:"
    log_info "1. Test your webhook endpoint"
    log_info "2. Configure your frontend with the publishable key"
    log_info "3. Run the backend server"
    log_info "4. Test the complete subscription flow"
}

# Run main function
main "$@"
