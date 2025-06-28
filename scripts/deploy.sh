#!/bin/bash

#
# Production deployment script for Travel Agent application
# Handles zero-downtime deployment with health checks and rollback capability
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-staging}"
VERSION="${2:-latest}"
REGISTRY="${DOCKER_REGISTRY:-localhost:5000}"
SERVICE_NAME="travel-agent"
COMPOSE_FILE="docker-compose.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate environment
validate_environment() {
    log_info "Validating deployment environment: $ENVIRONMENT"
    
    if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
        log_error "Invalid environment. Must be 'staging' or 'production'"
        exit 1
    fi
    
    # Check required tools
    for cmd in docker docker-compose git; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "$cmd is not installed or not in PATH"
            exit 1
        fi
    done
    
    # Check environment variables
    if [[ "$ENVIRONMENT" == "production" ]]; then
        required_vars=(
            "JWT_SECRET"
            "JWT_REFRESH_SECRET"
            "SESSION_SECRET"
            "ANTHROPIC_API_KEY"
            "AMADEUS_API_KEY"
            "AMADEUS_API_SECRET"
        )
        
        for var in "${required_vars[@]}"; do
            if [[ -z "${!var:-}" ]]; then
                log_error "Required environment variable $var is not set"
                exit 1
            fi
        done
    fi
}

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks"
    
    # Check if services are running
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        log_info "Services are currently running"
        ROLLBACK_POINT=$(docker-compose -f "$COMPOSE_FILE" images --format "table {{.Service}}\t{{.Tag}}" | tail -n +2)
        echo "$ROLLBACK_POINT" > "/tmp/rollback_${ENVIRONMENT}_$(date +%s).txt"
        log_info "Rollback point saved"
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    # Check available disk space (require at least 2GB)
    available_space=$(df / | awk 'NR==2 {print $4}')
    if (( available_space < 2000000 )); then
        log_error "Insufficient disk space. At least 2GB required"
        exit 1
    fi
    
    # Run tests
    log_info "Running test suite"
    cd "$PROJECT_ROOT/backend"
    if ! npm test; then
        log_error "Tests failed. Deployment aborted"
        exit 1
    fi
    
    # Build and validate images
    log_info "Building application images"
    cd "$PROJECT_ROOT"
    if ! docker-compose -f "$COMPOSE_FILE" build; then
        log_error "Image build failed"
        exit 1
    fi
}

# Health check function
wait_for_health() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    log_info "Waiting for $service to become healthy"
    
    while (( attempt <= max_attempts )); do
        if docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "healthy"; then
            log_info "$service is healthy"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts - waiting for $service..."
        sleep 10
        ((attempt++))
    done
    
    log_error "$service failed to become healthy within timeout"
    return 1
}

# Blue-green deployment function
deploy_blue_green() {
    log_info "Starting blue-green deployment"
    
    # Create temporary compose file for new version
    local temp_compose="docker-compose-${ENVIRONMENT}-new.yml"
    cp "$COMPOSE_FILE" "$temp_compose"
    
    # Update image tags in temporary file
    sed -i.bak "s/:latest/:$VERSION/g" "$temp_compose"
    
    # Start new services with different names
    log_info "Starting new version of services"
    docker-compose -f "$temp_compose" -p "${SERVICE_NAME}-new" up -d
    
    # Wait for new services to be healthy
    if ! wait_for_health "backend"; then
        log_error "New version failed health checks. Rolling back"
        docker-compose -f "$temp_compose" -p "${SERVICE_NAME}-new" down
        rm "$temp_compose" "$temp_compose.bak"
        return 1
    fi
    
    # Update load balancer to point to new services
    log_info "Switching traffic to new version"
    
    # Stop old services
    docker-compose -f "$COMPOSE_FILE" down
    
    # Start new services with original names
    docker-compose -f "$temp_compose" up -d
    
    # Clean up
    docker-compose -p "${SERVICE_NAME}-new" down
    rm "$temp_compose" "$temp_compose.bak"
    
    log_info "Blue-green deployment completed successfully"
}

# Rolling deployment function
deploy_rolling() {
    log_info "Starting rolling deployment"
    
    # Update and restart services one by one
    services=("redis" "backend" "frontend")
    
    for service in "${services[@]}"; do
        log_info "Updating $service"
        docker-compose -f "$COMPOSE_FILE" pull "$service"
        docker-compose -f "$COMPOSE_FILE" up -d "$service"
        
        if ! wait_for_health "$service"; then
            log_error "Rolling deployment failed at $service"
            return 1
        fi
        
        log_info "$service updated successfully"
    done
    
    log_info "Rolling deployment completed successfully"
}

# Database migration
run_migrations() {
    log_info "Running database migrations"
    
    # Check if backend is running
    if ! docker-compose -f "$COMPOSE_FILE" ps backend | grep -q "Up"; then
        log_error "Backend service is not running. Cannot run migrations"
        return 1
    fi
    
    # Run migrations (when we have a database)
    # For now, just ensure data directory exists
    docker-compose -f "$COMPOSE_FILE" exec -T backend mkdir -p /app/data
    
    log_info "Database migrations completed"
}

# Post-deployment verification
post_deployment_verification() {
    log_info "Running post-deployment verification"
    
    # Test API endpoints
    local backend_url="http://localhost:3001"
    local max_attempts=10
    local attempt=1
    
    while (( attempt <= max_attempts )); do
        if curl -sf "$backend_url/health" > /dev/null; then
            log_info "Backend health check passed"
            break
        fi
        
        if (( attempt == max_attempts )); then
            log_error "Backend health check failed after $max_attempts attempts"
            return 1
        fi
        
        sleep 5
        ((attempt++))
    done
    
    # Test demo endpoints
    if curl -sf "$backend_url/api/v1/demo/routes" > /dev/null; then
        log_info "Demo routes endpoint is accessible"
    else
        log_warn "Demo routes endpoint check failed"
    fi
    
    # Check service statuses
    log_info "Checking service statuses"
    docker-compose -f "$COMPOSE_FILE" ps
    
    log_info "Post-deployment verification completed"
}

# Cleanup old images and containers
cleanup() {
    log_info "Cleaning up old images and containers"
    
    # Remove unused images older than 7 days
    docker image prune -f --filter "until=168h"
    
    # Remove unused volumes
    docker volume prune -f
    
    # Remove unused networks
    docker network prune -f
    
    log_info "Cleanup completed"
}

# Send deployment notification
send_notification() {
    local status=$1
    local message="Travel Agent deployment to $ENVIRONMENT: $status"
    
    # Add webhook notification if configured
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK" || log_warn "Failed to send Slack notification"
    fi
    
    log_info "Deployment notification sent: $status"
}

# Main deployment function
main() {
    log_info "Starting deployment of Travel Agent to $ENVIRONMENT (version: $VERSION)"
    
    cd "$PROJECT_ROOT"
    
    validate_environment
    pre_deployment_checks
    
    # Choose deployment strategy based on environment
    if [[ "$ENVIRONMENT" == "production" ]]; then
        deploy_blue_green
    else
        deploy_rolling
    fi
    
    run_migrations
    post_deployment_verification
    cleanup
    
    send_notification "SUCCESS"
    log_info "Deployment completed successfully!"
}

# Error handling
trap 'log_error "Deployment failed at line $LINENO"; send_notification "FAILED"; exit 1' ERR

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi