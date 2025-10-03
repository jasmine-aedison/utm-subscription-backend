#!/bin/bash

# UTM Backend Deployment Script
# This script deploys the UTM subscription backend to various platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="utm-subscription-backend"
REGION="us-central1"
SERVICE_NAME="utm-backend"

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

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    log_info "Dependencies check passed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    npm ci --only=production
    log_info "Dependencies installed"
}

# Run tests
run_tests() {
    log_info "Running tests..."
    if npm test; then
        log_info "Tests passed"
    else
        log_error "Tests failed"
        exit 1
    fi
}

# Build application
build_app() {
    log_info "Building application..."
    # Add any build steps here if needed
    log_info "Application built"
}

# Deploy to Google Cloud Run
deploy_gcloud() {
    log_info "Deploying to Google Cloud Run..."
    
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed"
        exit 1
    fi
    
    # Build and deploy
    gcloud run deploy $SERVICE_NAME \
        --source . \
        --platform managed \
        --region $REGION \
        --allow-unauthenticated \
        --set-env-vars NODE_ENV=production
    
    log_info "Deployed to Google Cloud Run"
}

# Deploy to Docker
deploy_docker() {
    log_info "Deploying with Docker..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Build Docker image
    docker build -t $PROJECT_NAME .
    
    # Run container
    docker run -d \
        --name $PROJECT_NAME \
        -p 3000:3000 \
        --env-file .env \
        $PROJECT_NAME
    
    log_info "Deployed with Docker"
}

# Deploy with PM2
deploy_pm2() {
    log_info "Deploying with PM2..."
    
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 is not installed"
        exit 1
    fi
    
    # Stop existing process
    pm2 stop $PROJECT_NAME 2>/dev/null || true
    pm2 delete $PROJECT_NAME 2>/dev/null || true
    
    # Start new process
    pm2 start server.js --name $PROJECT_NAME
    pm2 save
    
    log_info "Deployed with PM2"
}

# Setup database
setup_database() {
    log_info "Setting up database..."
    node scripts/setup-database.js
    log_info "Database setup completed"
}

# Main deployment function
deploy() {
    local platform=$1
    
    log_info "Starting deployment to $platform..."
    
    check_dependencies
    install_dependencies
    run_tests
    build_app
    
    case $platform in
        "gcloud")
            deploy_gcloud
            ;;
        "docker")
            deploy_docker
            ;;
        "pm2")
            deploy_pm2
            ;;
        *)
            log_error "Unknown platform: $platform"
            log_info "Available platforms: gcloud, docker, pm2"
            exit 1
            ;;
    esac
    
    log_info "Deployment completed successfully!"
}

# Show usage
show_usage() {
    echo "Usage: $0 [platform] [options]"
    echo ""
    echo "Platforms:"
    echo "  gcloud    Deploy to Google Cloud Run"
    echo "  docker    Deploy with Docker"
    echo "  pm2       Deploy with PM2"
    echo ""
    echo "Options:"
    echo "  --setup-db    Setup database after deployment"
    echo "  --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 gcloud"
    echo "  $0 docker --setup-db"
    echo "  $0 pm2"
}

# Parse arguments
PLATFORM=""
SETUP_DB=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --setup-db)
            SETUP_DB=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            if [[ -z "$PLATFORM" ]]; then
                PLATFORM=$1
            else
                log_error "Unknown argument: $1"
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Check if platform is provided
if [[ -z "$PLATFORM" ]]; then
    log_error "Platform is required"
    show_usage
    exit 1
fi

# Run deployment
deploy $PLATFORM

# Setup database if requested
if [[ "$SETUP_DB" == true ]]; then
    setup_database
fi

log_info "Deployment completed successfully!"
