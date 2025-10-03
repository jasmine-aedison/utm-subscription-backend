#!/bin/bash

# Complete Setup Script for UTM Subscription System
# This script sets up the entire backend infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_header() {
    echo -e "${PURPLE}[HEADER]${NC} $1"
}

# Check system requirements
check_requirements() {
    log_header "Checking System Requirements"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        log_info "Install Node.js 18+ from https://nodejs.org"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -lt 18 ]]; then
        log_error "Node.js version 18+ is required (current: $(node --version))"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check jq (for JSON parsing)
    if ! command -v jq &> /dev/null; then
        log_warn "jq is not installed (recommended for JSON parsing)"
        log_info "Install with: brew install jq"
    fi
    
    log_success "System requirements check passed"
}

# Install dependencies
install_dependencies() {
    log_header "Installing Dependencies"
    
    log_info "Installing npm packages..."
    npm install
    
    log_success "Dependencies installed"
}

# Setup environment
setup_environment() {
    log_header "Setting Up Environment"
    
    if [[ ! -f ".env" ]]; then
        log_info "Creating .env file from template..."
        cp env.example .env
        
        log_warn "Please edit .env file with your configuration"
        log_info "Required configurations:"
        log_info "- Firebase project settings"
        log_info "- Stripe API keys"
        log_info "- JWT secret"
        
        read -p "Press Enter when you have configured .env file..."
    else
        log_info ".env file already exists"
    fi
    
    log_success "Environment setup completed"
}

# Setup Firebase
setup_firebase() {
    log_header "Setting Up Firebase"
    
    if [[ -f "scripts/setup-firebase.sh" ]]; then
        log_info "Running Firebase setup script..."
        ./scripts/setup-firebase.sh
    else
        log_warn "Firebase setup script not found"
        log_info "Please set up Firebase manually:"
        log_info "1. Create Firebase project"
        log_info "2. Enable Authentication and Firestore"
        log_info "3. Generate service account key"
        log_info "4. Update .env file with Firebase configuration"
    fi
    
    log_success "Firebase setup completed"
}

# Setup Stripe
setup_stripe() {
    log_header "Setting Up Stripe"
    
    if [[ -f "scripts/setup-stripe.sh" ]]; then
        log_info "Running Stripe setup script..."
        ./scripts/setup-stripe.sh
    else
        log_warn "Stripe setup script not found"
        log_info "Please set up Stripe manually:"
        log_info "1. Create Stripe account"
        log_info "2. Create products and prices"
        log_info "3. Set up webhook endpoints"
        log_info "4. Update .env file with Stripe configuration"
    fi
    
    log_success "Stripe setup completed"
}

# Setup database
setup_database() {
    log_header "Setting Up Database"
    
    log_info "Setting up Firestore collections..."
    node scripts/setup-database.js
    
    log_success "Database setup completed"
}

# Test configuration
test_configuration() {
    log_header "Testing Configuration"
    
    log_info "Testing environment variables..."
    
    # Check required environment variables
    REQUIRED_VARS=(
        "FIREBASE_PROJECT_ID"
        "FIREBASE_PRIVATE_KEY"
        "FIREBASE_CLIENT_EMAIL"
        "STRIPE_SECRET_KEY"
        "STRIPE_PUBLISHABLE_KEY"
        "JWT_SECRET"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [[ -z "${!var}" ]]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    log_success "Environment variables check passed"
    
    # Test Firebase connection
    log_info "Testing Firebase connection..."
    if node -e "
        const { initializeFirebase } = require('./config/firebase');
        initializeFirebase();
        console.log('Firebase connection successful');
    " 2>/dev/null; then
        log_success "Firebase connection successful"
    else
        log_error "Firebase connection failed"
        exit 1
    fi
    
    # Test Stripe connection
    log_info "Testing Stripe connection..."
    if node -e "
        const { stripe } = require('./config/stripe');
        stripe.customers.list({ limit: 1 }).then(() => {
            console.log('Stripe connection successful');
        }).catch(() => {
            process.exit(1);
        });
    " 2>/dev/null; then
        log_success "Stripe connection successful"
    else
        log_error "Stripe connection failed"
        exit 1
    fi
}

# Run tests
run_tests() {
    log_header "Running Tests"
    
    if [[ -f "package.json" ]] && grep -q '"test"' package.json; then
        log_info "Running test suite..."
        npm test
        log_success "Tests passed"
    else
        log_warn "No test suite found"
    fi
}

# Start development server
start_dev_server() {
    log_header "Starting Development Server"
    
    log_info "Starting development server..."
    log_info "Server will be available at: http://localhost:3000"
    log_info "Health check: http://localhost:3000/health"
    log_info "API documentation: http://localhost:3000/api"
    
    # Start server in background
    npm run dev &
    SERVER_PID=$!
    
    # Wait a moment for server to start
    sleep 3
    
    # Test health endpoint
    if curl -f http://localhost:3000/health >/dev/null 2>&1; then
        log_success "Development server started successfully"
        log_info "Server PID: $SERVER_PID"
        log_info "To stop the server, run: kill $SERVER_PID"
    else
        log_error "Failed to start development server"
        exit 1
    fi
}

# Show next steps
show_next_steps() {
    log_header "Setup Complete! Next Steps"
    
    echo ""
    log_info "🎉 UTM Subscription Backend is ready!"
    echo ""
    log_info "📋 What's been set up:"
    log_info "✅ Node.js backend API"
    log_info "✅ Firebase Authentication & Firestore"
    log_info "✅ Stripe payment processing"
    log_info "✅ Database collections and indexes"
    log_info "✅ Webhook endpoints"
    log_info "✅ Security and validation"
    echo ""
    log_info "🚀 Next steps:"
    log_info "1. Test the API endpoints"
    log_info "2. Configure your frontend to use the API"
    log_info "3. Set up monitoring and logging"
    log_info "4. Deploy to production"
    echo ""
    log_info "📚 Useful commands:"
    log_info "• Start server: npm run dev"
    log_info "• Run tests: npm test"
    log_info "• Deploy: ./scripts/deploy.sh [platform]"
    log_info "• View logs: tail -f logs/combined.log"
    echo ""
    log_info "🔗 Important URLs:"
    log_info "• API: http://localhost:3000/api"
    log_info "• Health: http://localhost:3000/health"
    log_info "• Firebase Console: https://console.firebase.google.com"
    log_info "• Stripe Dashboard: https://dashboard.stripe.com"
    echo ""
    log_success "Setup completed successfully! 🎉"
}

# Main setup function
main() {
    log_header "UTM Subscription System - Complete Setup"
    log_info "This script will set up the entire backend infrastructure"
    echo ""
    
    check_requirements
    install_dependencies
    setup_environment
    setup_firebase
    setup_stripe
    setup_database
    test_configuration
    run_tests
    start_dev_server
    show_next_steps
}

# Handle script interruption
trap 'log_error "Setup interrupted"; exit 1' INT TERM

# Run main function
main "$@"
