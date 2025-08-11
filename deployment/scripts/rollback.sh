#!/bin/bash

# LetsOrder Rollback Script
# This script rolls back to the previous version of LetsOrder
# Usage: ./rollback.sh <server-ip> <ssh-key-path> [--to-backup=backup_file]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LETSORDER_USER="letsorder"
LETSORDER_DIR="/opt/letsorder"

# Function to print colored output
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check arguments
if [ $# -lt 2 ]; then
    error "Usage: $0 <server-ip> <ssh-key-path> [--to-backup=backup_file]"
fi

SERVER_IP="$1"
SSH_KEY_PATH="$2"
TARGET_BACKUP=""

# Parse additional arguments
shift 2
while [[ $# -gt 0 ]]; do
    case $1 in
        --to-backup=*)
            TARGET_BACKUP="${1#*=}"
            shift
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Check if SSH key exists
if [ ! -f "$SSH_KEY_PATH" ]; then
    error "SSH key file not found: $SSH_KEY_PATH"
fi

log "Starting LetsOrder rollback on $SERVER_IP"

# Test SSH connection
log "Testing SSH connection..."
# SSH options for automated connections
SSH_OPTS="-i $SSH_KEY_PATH -o ConnectTimeout=10 -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

if ! ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" exit; then
    error "Cannot connect to server via SSH. Please check server IP and SSH key."
fi

# Create rollback script to run on server
REMOTE_ROLLBACK_SCRIPT=$(cat << 'REMOTE_SCRIPT'
#!/bin/bash
set -e

log() {
    echo -e "\033[0;32m[$(date +'%Y-%m-%d %H:%M:%S')] $1\033[0m"
}

warn() {
    echo -e "\033[1;33m[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1\033[0m"
}

error() {
    echo -e "\033[0;31m[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1\033[0m"
    exit 1
}

LETSORDER_DIR="/opt/letsorder"
TARGET_BACKUP="$1"

log "Starting rollback process on server..."

# Check if service exists
if ! systemctl list-unit-files | grep -q letsorder.service; then
    error "LetsOrder service is not installed"
fi

# Check service status
SERVICE_ACTIVE=$(systemctl is-active letsorder || echo "inactive")
log "Current service status: $SERVICE_ACTIVE"

if [ -n "$TARGET_BACKUP" ]; then
    # Rollback to specific backup
    BACKUP_PATH="$LETSORDER_DIR/backups/$TARGET_BACKUP"
    
    if [ ! -f "$BACKUP_PATH" ]; then
        # Check if it's an S3 backup
        if command -v aws >/dev/null 2>&1; then
            log "Backup not found locally, checking S3..."
            S3_PATH="s3://letsorder-backups/releases/$TARGET_BACKUP"
            if aws s3 ls "$S3_PATH" >/dev/null 2>&1; then
                log "Downloading backup from S3..."
                aws s3 cp "$S3_PATH" "$BACKUP_PATH"
            else
                error "Backup not found: $TARGET_BACKUP (checked locally and S3)"
            fi
        else
            error "Backup not found: $TARGET_BACKUP"
        fi
    fi
    
    log "Rolling back database to: $TARGET_BACKUP"
    
    # Stop service
    log "Stopping LetsOrder service..."
    sudo systemctl stop letsorder
    
    # Create backup of current database
    if [ -f "$LETSORDER_DIR/data/letsorder.db" ]; then
        CURRENT_BACKUP="$LETSORDER_DIR/backups/pre_rollback_$(date +%Y%m%d_%H%M%S).db"
        log "Backing up current database to: $(basename $CURRENT_BACKUP)"
        sqlite3 "$LETSORDER_DIR/data/letsorder.db" ".backup $CURRENT_BACKUP"
    fi
    
    # Restore database
    log "Restoring database from backup..."
    cp "$BACKUP_PATH" "$LETSORDER_DIR/data/letsorder.db"
    chown letsorder:letsorder "$LETSORDER_DIR/data/letsorder.db"
    chmod 644 "$LETSORDER_DIR/data/letsorder.db"
    
else
    # Rollback to previous binary
    if [ ! -f "$LETSORDER_DIR/bin/backend.old" ]; then
        error "No previous binary found at $LETSORDER_DIR/bin/backend.old"
    fi
    
    log "Rolling back to previous binary version..."
    
    # Stop service
    log "Stopping LetsOrder service..."
    sudo systemctl stop letsorder
    
    # Create backup of current binary
    if [ -f "$LETSORDER_DIR/bin/backend" ]; then
        log "Backing up current binary..."
        mv "$LETSORDER_DIR/bin/backend" "$LETSORDER_DIR/bin/backend.rollback"
    fi
    
    # Restore previous binary
    log "Restoring previous binary..."
    mv "$LETSORDER_DIR/bin/backend.old" "$LETSORDER_DIR/bin/backend"
    chmod +x "$LETSORDER_DIR/bin/backend"
fi

# Start service
log "Starting LetsOrder service..."
sudo systemctl start letsorder

# Wait for service to start
log "Waiting for service to start..."
sleep 5

# Check service status
if sudo systemctl is-active --quiet letsorder; then
    log "Service started successfully after rollback"
else
    error "Service failed to start after rollback"
fi

# Test health endpoint
log "Testing health endpoint..."
for i in {1..10}; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health | grep -q "200"; then
        log "✓ Health check passed after rollback"
        break
    else
        if [ $i -eq 10 ]; then
            error "Health check failed after rollback"
        fi
        log "Health check attempt $i failed, retrying..."
        sleep 3
    fi
done

log "Rollback completed successfully!"
log "Service status: $(sudo systemctl is-active letsorder)"

# Show recent logs
log "Recent service logs:"
sudo journalctl -u letsorder --no-pager -n 10

REMOTE_SCRIPT
)

# Show available backups if no specific backup requested
if [ -z "$TARGET_BACKUP" ]; then
    log "Checking available options for rollback..."
    
    # List available backups
    info "Available database backups:"
    ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" \
        "ls -la $LETSORDER_DIR/backups/backup_*.db 2>/dev/null || echo 'No local backups found'"
    
    # Check for previous binary
    info "Previous binary availability:"
    if ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" \
       "[ -f $LETSORDER_DIR/bin/backend.old ]"; then
        info "✓ Previous binary is available for rollback"
    else
        warn "✗ No previous binary found"
    fi
    
    echo ""
    info "Rollback options:"
    info "1. Binary rollback (default): Reverts to the previous binary version"
    info "2. Database rollback: Use --to-backup=backup_filename to restore specific database backup"
    echo ""
    
    read -p "Do you want to proceed with binary rollback? [y/N]: " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Rollback cancelled by user"
        exit 0
    fi
fi

# Execute rollback on server
log "Executing rollback on server..."
echo "$REMOTE_ROLLBACK_SCRIPT" | ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" \
    "cat > /tmp/rollback.sh && chmod +x /tmp/rollback.sh && /tmp/rollback.sh '$TARGET_BACKUP'"

# Verify rollback
log "Verifying rollback..."
HEALTH_URL="https://api.letsorder.app/health"
if command -v curl >/dev/null 2>&1; then
    if curl -s -f "$HEALTH_URL" >/dev/null; then
        log "✓ Rollback verification successful!"
        log "✓ Health endpoint is responding: $HEALTH_URL"
    else
        warn "Health endpoint check failed. Manual verification may be needed."
    fi
fi

log "Rollback completed successfully!"
if [ -n "$TARGET_BACKUP" ]; then
    log "Database restored from: $TARGET_BACKUP"
else
    log "Binary rolled back to previous version"
fi

log ""
log "Post-rollback actions:"
log "1. Test the application functionality"
log "2. Monitor logs: ssh -i $SSH_KEY_PATH $LETSORDER_USER@$SERVER_IP 'sudo journalctl -u letsorder -f'"
log "3. Check service status: ssh -i $SSH_KEY_PATH $LETSORDER_USER@$SERVER_IP 'sudo systemctl status letsorder'"
log "4. If rollback is successful, consider investigating the issue that caused the need for rollback"