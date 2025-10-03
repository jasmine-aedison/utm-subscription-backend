#!/bin/bash

# Firebase Setup Script for UTM Subscription System
# This script helps set up Firebase project for the UTM subscription system

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

# Check if Firebase CLI is installed
check_firebase_cli() {
    log_info "Checking Firebase CLI..."
    
    if ! command -v firebase &> /dev/null; then
        log_error "Firebase CLI is not installed"
        log_info "Install it with: npm install -g firebase-tools"
        exit 1
    fi
    
    log_info "Firebase CLI is installed"
}

# Login to Firebase
firebase_login() {
    log_step "Logging into Firebase..."
    firebase login
    log_info "Logged into Firebase"
}

# Create Firebase project
create_firebase_project() {
    log_step "Creating Firebase project..."
    
    read -p "Enter project ID (utm-subscription-system): " PROJECT_ID
    PROJECT_ID=${PROJECT_ID:-utm-subscription-system}
    
    read -p "Enter project name (UTM Subscription System): " PROJECT_NAME
    PROJECT_NAME=${PROJECT_NAME:-UTM Subscription System}
    
    log_info "Creating project: $PROJECT_ID"
    
    # Create project
    firebase projects:create $PROJECT_ID --display-name "$PROJECT_NAME"
    
    log_info "Project created: $PROJECT_ID"
}

# Enable Firebase services
enable_firebase_services() {
    log_step "Enabling Firebase services..."
    
    # Enable Authentication
    log_info "Enabling Authentication..."
    firebase auth:enable
    
    # Enable Firestore
    log_info "Enabling Firestore..."
    firebase firestore:enable
    
    # Enable Functions (optional)
    log_info "Enabling Cloud Functions..."
    firebase functions:enable
    
    log_info "Firebase services enabled"
}

# Configure Authentication
configure_authentication() {
    log_step "Configuring Authentication..."
    
    log_info "Authentication providers to enable:"
    echo "1. Email/Password"
    echo "2. Google"
    echo "3. Apple"
    echo "4. All of the above"
    
    read -p "Select option (1-4): " AUTH_OPTION
    
    case $AUTH_OPTION in
        1)
            log_info "Email/Password authentication will be enabled in Firebase Console"
            ;;
        2)
            log_info "Google authentication will be enabled in Firebase Console"
            ;;
        3)
            log_info "Apple authentication will be enabled in Firebase Console"
            ;;
        4)
            log_info "All authentication providers will be enabled in Firebase Console"
            ;;
        *)
            log_warn "Invalid option, skipping authentication configuration"
            ;;
    esac
    
    log_info "Please configure authentication providers in Firebase Console:"
    log_info "https://console.firebase.google.com/project/$PROJECT_ID/authentication/providers"
}

# Configure Firestore
configure_firestore() {
    log_step "Configuring Firestore..."
    
    log_info "Setting up Firestore security rules..."
    
    # Create firestore.rules file
    cat > firestore.rules << 'EOF'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Subscriptions are readable by the user, writable by server
    match /subscriptions/{subscriptionId} {
      allow read: if request.auth != null && 
        (resource.data.userId == request.auth.uid || 
         request.auth.token.hasActiveSubscription == true);
      allow write: if false; // Only server can write
    }
    
    // License keys are readable by server only
    match /license_keys/{licenseKey} {
      allow read, write: if false; // Server only
    }
    
    // Analytics are readable by server only
    match /analytics/{document} {
      allow read, write: if false; // Server only
    }
  }
}
EOF
    
    log_info "Firestore rules created"
}

# Generate service account key
generate_service_account() {
    log_step "Generating service account key..."
    
    log_info "Please follow these steps:"
    log_info "1. Go to Firebase Console > Project Settings > Service Accounts"
    log_info "2. Click 'Generate new private key'"
    log_info "3. Download the JSON file"
    log_info "4. Save it as 'firebase-service-account.json' in the backend directory"
    
    read -p "Press Enter when you have downloaded the service account key..."
    
    if [[ -f "firebase-service-account.json" ]]; then
        log_info "Service account key found"
        
        # Extract values for .env file
        log_info "Extracting values for .env file..."
        
        PROJECT_ID=$(cat firebase-service-account.json | jq -r '.project_id')
        PRIVATE_KEY_ID=$(cat firebase-service-account.json | jq -r '.private_key_id')
        PRIVATE_KEY=$(cat firebase-service-account.json | jq -r '.private_key')
        CLIENT_EMAIL=$(cat firebase-service-account.json | jq -r '.client_email')
        CLIENT_ID=$(cat firebase-service-account.json | jq -r '.client_id')
        AUTH_URI=$(cat firebase-service-account.json | jq -r '.auth_uri')
        TOKEN_URI=$(cat firebase-service-account.json | jq -r '.token_uri')
        AUTH_PROVIDER_X509_CERT_URL=$(cat firebase-service-account.json | jq -r '.auth_provider_x509_cert_url')
        CLIENT_X509_CERT_URL=$(cat firebase-service-account.json | jq -r '.client_x509_cert_url')
        
        # Create .env file
        cat > .env << EOF
# Firebase Configuration
FIREBASE_PROJECT_ID=$PROJECT_ID
FIREBASE_PRIVATE_KEY_ID=$PRIVATE_KEY_ID
FIREBASE_PRIVATE_KEY="$PRIVATE_KEY"
FIREBASE_CLIENT_EMAIL=$CLIENT_EMAIL
FIREBASE_CLIENT_ID=$CLIENT_ID
FIREBASE_AUTH_URI=$AUTH_URI
FIREBASE_TOKEN_URI=$TOKEN_URI
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=$AUTH_PROVIDER_X509_CERT_URL
FIREBASE_CLIENT_X509_CERT_URL=$CLIENT_X509_CERT_URL
EOF
        
        log_info ".env file created with Firebase configuration"
    else
        log_error "Service account key not found"
        log_info "Please download it and run this script again"
        exit 1
    fi
}

# Setup Firestore indexes
setup_firestore_indexes() {
    log_step "Setting up Firestore indexes..."
    
    log_info "Creating firestore.indexes.json..."
    
    cat > firestore.indexes.json << 'EOF'
{
  "indexes": [
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "email",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "subscriptions",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "subscriptions",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "stripeSubscriptionId",
          "order": "ASCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
EOF
    
    log_info "Firestore indexes created"
}

# Deploy Firestore rules and indexes
deploy_firestore() {
    log_step "Deploying Firestore configuration..."
    
    if [[ -f "firestore.rules" ]]; then
        firebase deploy --only firestore:rules
        log_info "Firestore rules deployed"
    fi
    
    if [[ -f "firestore.indexes.json" ]]; then
        firebase deploy --only firestore:indexes
        log_info "Firestore indexes deployed"
    fi
}

# Main setup function
main() {
    log_info "Starting Firebase setup for UTM Subscription System..."
    
    check_firebase_cli
    firebase_login
    create_firebase_project
    enable_firebase_services
    configure_authentication
    configure_firestore
    generate_service_account
    setup_firestore_indexes
    deploy_firestore
    
    log_info "Firebase setup completed successfully!"
    log_info "Next steps:"
    log_info "1. Configure authentication providers in Firebase Console"
    log_info "2. Set up Stripe integration"
    log_info "3. Run the backend server"
}

# Run main function
main "$@"
