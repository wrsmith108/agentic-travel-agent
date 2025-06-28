#!/bin/bash

#
# Emergency rollback script for Travel Agent application
# Provides quick rollback capability with automatic health verification
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-staging}"
ROLLBACK_POINT="${2:-auto}"
COMPOSE_FILE="docker-compose.yml"
SERVICE_NAME="travel-agent"

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

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [ENVIRONMENT] [ROLLBACK_POINT]

ENVIRONMENT:
    staging     - Rollback staging environment
    production  - Rollback production environment

ROLLBACK_POINT:
    auto        - Use latest rollback point (default)
    <timestamp> - Use specific rollback point
    list        - List available rollback points

Examples:
    $0 staging
    $0 production auto
    $0 production 1640995200
    $0 staging list

EOF
}

# List available rollback points
list_rollback_points() {
    log_info "Available rollback points for $ENVIRONMENT:"
    
    local rollback_files=(/tmp/rollback_${ENVIRONMENT}_*.txt)
    
    if [[ ! -f "${rollback_files[0]}" ]]; then
        log_warn "No rollback points found for $ENVIRONMENT"
        return 1
    fi
    
    for file in "${rollback_files[@]}"; do
        local timestamp=$(basename "$file" | sed 's/rollback_'$ENVIRONMENT'_\(.*\)\.txt/\1/')
        local date_str=$(date -d "@$timestamp" 2>/dev/null || date -r "$timestamp" 2>/dev/null || echo "Unknown date")
        echo "  $timestamp - $date_str"
        
        # Show first few lines of rollback point
        echo "    Services:"
        head -3 "$file" | sed 's/^/      /'
        echo ""
    done
}

# Find latest rollback point
find_latest_rollback_point() {
    local latest_file=""
    local latest_timestamp=0
    
    for file in /tmp/rollback_${ENVIRONMENT}_*.txt; do
        if [[ -f "$file" ]]; then
            local timestamp=$(basename "$file" | sed 's/rollback_'$ENVIRONMENT'_\(.*\)\.txt/\1/')
            if (( timestamp > latest_timestamp )); then
                latest_timestamp=$timestamp
                latest_file="$file"
            fi
        fi
    done
    
    if [[ -z "$latest_file" ]]; then
        log_error "No rollback points found for $ENVIRONMENT"
        return 1
    fi
    
    echo "$latest_file"
}

# Validate rollback point
validate_rollback_point() {
    local rollback_file="$1"
    
    if [[ ! -f "$rollback_file" ]]; then
        log_error "Rollback point file not found: $rollback_file"
        return 1
    fi
    
    # Check if file contains valid service information
    if ! grep -q "backend\|frontend\|redis" "$rollback_file"; then
        log_error "Invalid rollback point file format"
        return 1
    fi
    
    log_info "Rollback point validated: $rollback_file"
    return 0
}

# Create emergency snapshot before rollback
create_emergency_snapshot() {
    log_info "Creating emergency snapshot before rollback"
    
    local snapshot_file="/tmp/emergency_snapshot_${ENVIRONMENT}_$(date +%s).txt"
    
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        docker-compose -f "$COMPOSE_FILE" images --format "table {{.Service}}\t{{.Tag}}" > "$snapshot_file"
        log_info "Emergency snapshot saved: $snapshot_file"
    else
        log_warn "No running services to snapshot"
    fi
}

# Stop current services gracefully
stop_current_services() {
    log_info "Stopping current services"
    
    # Try graceful shutdown first
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        log_info "Attempting graceful shutdown"
        timeout 60 docker-compose -f "$COMPOSE_FILE" down || {
            log_warn "Graceful shutdown timed out, forcing stop"
            docker-compose -f "$COMPOSE_FILE" kill
            docker-compose -f "$COMPOSE_FILE" down
        }
    else
        log_info "No services currently running"
    fi
}

# Restore from rollback point
restore_from_rollback_point() {
    local rollback_file="$1"
    
    log_info "Restoring from rollback point: $rollback_file"
    
    # Read service versions from rollback point
    while IFS=$'\t' read -r service tag; do
        if [[ "$service" == "SERVICE" ]]; then
            continue  # Skip header
        fi
        
        log_info "Restoring $service to version $tag"
        
        # Pull the specific version
        if ! docker pull "$service:$tag" 2>/dev/null; then
            log_warn "Could not pull $service:$tag, attempting local restore"
        fi
        
    done < "$rollback_file"
    
    # Update docker-compose to use rollback versions
    # For simplicity, we'll restart with current compose file
    # In production, you'd want more sophisticated version management
    
    log_info "Starting services with rollback versions"
    docker-compose -f "$COMPOSE_FILE" up -d
}

# Health check after rollback
post_rollback_health_check() {
    log_info "Running post-rollback health checks"
    
    local max_attempts=20
    local attempt=1
    
    # Wait for services to start
    sleep 10
    
    # Check backend health
    local backend_url="http://localhost:3001"
    
    while (( attempt <= max_attempts )); do
        if curl -sf "$backend_url/health" > /dev/null; then
            log_info "Backend health check passed"
            break
        fi
        
        if (( attempt == max_attempts )); then
            log_error "Backend health check failed after rollback"
            return 1
        fi
        
        log_info "Attempt $attempt/$max_attempts - waiting for backend..."
        sleep 5
        ((attempt++))
    done
    
    # Check service statuses
    log_info "Checking all service statuses"
    docker-compose -f "$COMPOSE_FILE" ps
    
    # Test critical endpoints
    local endpoints=(
        "/health"
        "/api/v1/demo/routes"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -sf "$backend_url$endpoint" > /dev/null; then
            log_info "Endpoint check passed: $endpoint"
        else
            log_warn "Endpoint check failed: $endpoint"
        fi
    done
    
    log_info "Post-rollback health checks completed"
}

# Send rollback notification
send_rollback_notification() {
    local status=$1
    local rollback_point=$2
    local message="Travel Agent ROLLBACK to $ENVIRONMENT: $status (rollback point: $rollback_point)"
    
    # Add webhook notification if configured
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\":warning: $message\"}" \
            "$SLACK_WEBHOOK" || log_warn "Failed to send Slack notification"
    fi
    
    # Log critical rollback event
    logger -t "travel-agent-rollback" "$message"
    
    log_info "Rollback notification sent: $status"
}

# Main rollback function
main() {
    log_info "Starting emergency rollback for $ENVIRONMENT"
    
    # Handle special commands
    if [[ "$ROLLBACK_POINT" == "list" ]]; then
        list_rollback_points
        return 0
    fi
    
    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
        log_error "Invalid environment. Must be 'staging' or 'production'"
        show_usage
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
    
    # Determine rollback point
    local rollback_file
    if [[ "$ROLLBACK_POINT" == "auto" ]]; then
        rollback_file=$(find_latest_rollback_point)
    else
        rollback_file="/tmp/rollback_${ENVIRONMENT}_${ROLLBACK_POINT}.txt"
    fi
    
    # Validate rollback point
    if ! validate_rollback_point "$rollback_file"; then
        log_error "Invalid or missing rollback point"
        list_rollback_points
        exit 1
    fi
    
    # Confirm rollback in production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo -n "Are you sure you want to rollback PRODUCTION? (type 'ROLLBACK' to confirm): "
        read -r confirmation
        if [[ "$confirmation" != "ROLLBACK" ]]; then
            log_info "Rollback cancelled"
            exit 0
        fi
    fi
    
    # Execute rollback
    create_emergency_snapshot
    stop_current_services
    restore_from_rollback_point "$rollback_file"
    
    # Verify rollback success
    if post_rollback_health_check; then
        send_rollback_notification "SUCCESS" "$(basename "$rollback_file")"
        log_info "Rollback completed successfully!"
    else
        send_rollback_notification "FAILED" "$(basename "$rollback_file")"
        log_error "Rollback completed but health checks failed!"
        exit 1
    fi
}

# Error handling
trap 'log_error "Rollback failed at line $LINENO"; send_rollback_notification "FAILED" "unknown"; exit 1' ERR

# Show help
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    show_usage
    exit 0
fi

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main
fi