#!/bin/bash

#
# Backup script for Travel Agent application
# Creates backups of application data, logs, and configuration
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-/tmp/travel-agent-backups}"
ENVIRONMENT="${1:-staging}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

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

# Create backup directory
create_backup_dir() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="${BACKUP_DIR}/${ENVIRONMENT}_${timestamp}"
    
    mkdir -p "$BACKUP_PATH"
    log_info "Created backup directory: $BACKUP_PATH"
}

# Backup application data
backup_data() {
    log_info "Backing up application data"
    
    if docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps backend | grep -q "Up"; then
        # Backup data from running container
        docker-compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T backend tar czf - /app/data 2>/dev/null | cat > "$BACKUP_PATH/data.tar.gz"
        log_info "Application data backed up"
    else
        log_warn "Backend service not running, skipping data backup"
    fi
}

# Backup logs
backup_logs() {
    log_info "Backing up application logs"
    
    if docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps | grep -q "Up"; then
        docker-compose -f "$PROJECT_ROOT/docker-compose.yml" logs > "$BACKUP_PATH/application.log" 2>&1
        log_info "Application logs backed up"
    else
        log_warn "Services not running, skipping log backup"
    fi
}

# Backup configuration
backup_config() {
    log_info "Backing up configuration files"
    
    cd "$PROJECT_ROOT"
    tar czf "$BACKUP_PATH/config.tar.gz" \
        docker-compose.yml \
        backend/package.json \
        backend/package-lock.json \
        frontend/package.json \
        frontend/package-lock.json \
        scripts/ \
        .github/ 2>/dev/null || log_warn "Some config files missing"
    
    log_info "Configuration backed up"
}

# Create backup manifest
create_manifest() {
    log_info "Creating backup manifest"
    
    cat > "$BACKUP_PATH/manifest.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT",
  "backup_type": "full",
  "version": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "files": [
    "data.tar.gz",
    "application.log", 
    "config.tar.gz"
  ],
  "retention_days": $RETENTION_DAYS
}
EOF
    
    log_info "Backup manifest created"
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days"
    
    find "$BACKUP_DIR" -name "${ENVIRONMENT}_*" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true
    
    log_info "Old backups cleaned up"
}

# Main backup function
main() {
    log_info "Starting backup for $ENVIRONMENT environment"
    
    cd "$PROJECT_ROOT"
    
    create_backup_dir
    backup_data
    backup_logs
    backup_config
    create_manifest
    cleanup_old_backups
    
    log_info "Backup completed successfully: $BACKUP_PATH"
    echo "$BACKUP_PATH"
}

# Error handling
trap 'log_error "Backup failed at line $LINENO"; exit 1' ERR

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi