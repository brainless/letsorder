#!/bin/bash

# LetsOrder Release Deployment Script
# This script builds and deploys a new release of LetsOrder to the production server
# Usage: ./deploy-release.sh <server-ip> <ssh-key-path> [--skip-backup]

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
BACKUP_RETENTION_LOCAL=5

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check arguments
if [ $# -lt 2 ]; then
    error "Usage: $0 <server-ip> <ssh-key-path> [--skip-backup]"
fi

SERVER_IP="$1"
SSH_KEY_PATH="$2"
SKIP_BACKUP=""

# Parse additional arguments
shift 2
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-backup)
            SKIP_BACKUP="true"
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

# Check if we're in the project root
if [ ! -f "backend/Cargo.toml" ]; then
    error "This script must be run from the project root directory"
fi

# Check required commands
if ! command_exists "git"; then
    error "Git is not installed. Please install git."
fi


# Simple S3-compatible upload function using curl (no AWS CLI needed)
upload_to_s3_compatible() {
    local file_path="$1"
    local s3_key="$2" 
    local bucket="$3"
    local metadata="$4"
    
    # Check if S3 credentials are available
    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$S3_ENDPOINT" ]; then
        log "S3 credentials or endpoint not configured, skipping backup upload"
        return 0
    fi
    
    # Use simple HTTP PUT with basic auth for S3-compatible storage
    local s3_url="${S3_ENDPOINT}/${bucket}/${s3_key}"
    
    log "Uploading backup to ${s3_url}..."
    
    # Try upload with simple approach first (works with many S3-compatible services)
    if curl -X PUT \
        -H "Content-Type: application/octet-stream" \
        -H "x-amz-meta-timestamp: ${metadata}" \
        --user "${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}" \
        --data-binary "@${file_path}" \
        "${s3_url}" >/dev/null 2>&1; then
        log "Successfully uploaded to ${s3_url}"
        return 0
    else
        # Fallback: try without authentication (for public buckets or pre-configured access)
        log "Authenticated upload failed, trying without authentication..."
        if curl -X PUT \
            -H "Content-Type: application/octet-stream" \
            --data-binary "@${file_path}" \
            "${s3_url}" >/dev/null 2>&1; then
            log "Successfully uploaded to ${s3_url} (no auth)"
            return 0
        else
            log "Failed to upload backup to S3-compatible storage, continuing without backup upload"
            return 1
        fi
    fi
}

# Store command line arguments before loading environment
CMD_SERVER_IP="$SERVER_IP"
CMD_SSH_KEY_PATH="$SSH_KEY_PATH"

# Load environment variables
if [ -f "deployment/.env" ]; then
    log "Loading environment variables..."
    set -a
    source deployment/.env
    set +a
else
    warn "No deployment/.env file found. Some features may not work."
fi

# Restore command line arguments (they take precedence over .env)
SERVER_IP="$CMD_SERVER_IP"
SSH_KEY_PATH="$CMD_SSH_KEY_PATH"

log "Starting LetsOrder deployment to $SERVER_IP"

# Security check: Ensure deployment is from main branch only
info "Verifying deployment source branch..."

# Get release information
RELEASE_TAG=$(git describe --tags --always --dirty)
COMMIT_HASH=$(git rev-parse --short HEAD)
BUILD_TIME=$(date -u '+%Y-%m-%d_%H%M%S')

info "Release: $RELEASE_TAG"
info "Commit: $COMMIT_HASH"
info "Build time: $BUILD_TIME"

# Test SSH connection
log "Testing SSH connection..."
# SSH options for automated connections
SSH_OPTS="-i $SSH_KEY_PATH -o ConnectTimeout=10 -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

if ! ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" exit; then
    error "Cannot connect to server via SSH. Please check server IP and SSH key."
fi

# Ensure we're deploying from main branch only
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    error "Deployment must be run from main branch only. Current branch: $CURRENT_BRANCH"
fi

# Get current git commit for deployment
CURRENT_COMMIT=$(git rev-parse HEAD)

log "SSL Certificate Configuration:"
echo ""
echo "This deployment will automatically use HTTPS if Let's Encrypt certificates are available."
echo "Otherwise, it will fall back to HTTP-only configuration."
echo ""
echo "To set up HTTPS after deployment (if not already configured):"
echo "Use Let's Encrypt (free): ./deployment/scripts/setup-letsencrypt.sh $SERVER_IP $SSH_KEY_PATH api.letsorder.app"
echo ""

# Upload deployment configuration files
log "Uploading deployment configuration files to server..."
scp $SSH_OPTS -r deployment/config "$LETSORDER_USER@$SERVER_IP:/tmp/"

# Create deployment script to run on server
REMOTE_DEPLOY_SCRIPT=$(cat << 'REMOTE_SCRIPT'
#!/bin/bash
set -e

log() {
    echo -e "\033[0;32m[$(date +'%Y-%m-%d %H:%M:%S')] $1\033[0m"
}

error() {
    echo -e "\033[0;31m[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1\033[0m"
    exit 1
}

# Simple S3-compatible upload function using curl (no AWS CLI needed)
upload_to_s3_compatible() {
    local file_path="$1"
    local s3_key="$2" 
    local bucket="$3"
    local metadata="$4"
    
    # Check if S3 credentials are available
    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$S3_ENDPOINT" ]; then
        log "S3 credentials or endpoint not configured, skipping backup upload"
        return 0
    fi
    
    # Use simple HTTP PUT with basic auth for S3-compatible storage
    local s3_url="${S3_ENDPOINT}/${bucket}/${s3_key}"
    
    log "Uploading backup to ${s3_url}..."
    
    # Try upload with simple approach first (works with many S3-compatible services)
    if curl -X PUT \
        -H "Content-Type: application/octet-stream" \
        -H "x-amz-meta-timestamp: ${metadata}" \
        --user "${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}" \
        --data-binary "@${file_path}" \
        "${s3_url}" >/dev/null 2>&1; then
        log "Successfully uploaded to ${s3_url}"
        return 0
    else
        # Fallback: try without authentication (for public buckets or pre-configured access)
        log "Authenticated upload failed, trying without authentication..."
        if curl -X PUT \
            -H "Content-Type: application/octet-stream" \
            --data-binary "@${file_path}" \
            "${s3_url}" >/dev/null 2>&1; then
            log "Successfully uploaded to ${s3_url} (no auth)"
            return 0
        else
            log "Failed to upload backup to S3-compatible storage, continuing without backup upload"
            return 1
        fi
    fi
}

LETSORDER_DIR="/opt/letsorder"
RELEASE_TAG="$1"
SKIP_BACKUP="$2"
COMMIT_HASH="$3"
JWT_SECRET="$4"

log "Starting deployment on server..."

# Check if service exists
if systemctl list-unit-files | grep -q letsorder.service; then
    SERVICE_EXISTS="true"
else
    SERVICE_EXISTS="false"
fi

# Install build dependencies if not present
if ! command -v cc >/dev/null 2>&1; then
    log "Installing build dependencies..."
    sudo apt update
    sudo apt install -y build-essential pkg-config libssl-dev
    log "Build dependencies installed"
fi

# Install Rust if not present
if ! command -v cargo >/dev/null 2>&1; then
    log "Installing Rust toolchain..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
    source ~/.cargo/env
    log "Rust toolchain installed"
else
    log "Rust toolchain already available"
fi

# Clone or update repository
REPO_DIR="$LETSORDER_DIR/repo"
if [ ! -d "$REPO_DIR" ]; then
    log "Cloning repository..."
    git clone https://github.com/brainless/letsorder.git "$REPO_DIR"
    chown -R letsorder:letsorder "$REPO_DIR"
else
    log "Updating repository..."
    cd "$REPO_DIR"
    # Reset any local changes that might conflict
    git reset --hard
    git clean -fd
    git fetch origin
fi

cd "$REPO_DIR"

# Ensure we're on main branch first
log "Switching to main branch..."
git checkout main
git pull origin main

# Verify the commit hash exists on main branch
if ! git merge-base --is-ancestor "$COMMIT_HASH" main; then
    log "ERROR: Commit $COMMIT_HASH is not on main branch. Deployment cancelled."
    exit 1
fi

log "Checking out commit: $COMMIT_HASH (verified on main branch)"
# Force checkout to handle any conflicts
git checkout --force "$COMMIT_HASH"

# Build the application on server
log "Building LetsOrder backend on server..."
cd backend
SQLX_OFFLINE=true cargo build --release
BINARY_SIZE=$(du -h target/release/backend | cut -f1)
log "Built binary size: $BINARY_SIZE"

# Create database backup if requested
if [ "$SKIP_BACKUP" != "true" ] && [ -f "$LETSORDER_DIR/data/letsorder.db" ]; then
    log "Creating database backup..."
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$LETSORDER_DIR/backups/backup_${TIMESTAMP}_${RELEASE_TAG}.db"
    
    # Use sqlite3 to create a consistent backup
    sqlite3 "$LETSORDER_DIR/data/letsorder.db" ".backup $BACKUP_FILE"
    
    # Upload to S3-compatible storage using curl
    upload_to_s3_compatible "$BACKUP_FILE" \
        "releases/${RELEASE_TAG}/letsorder.db" \
        "${AWS_S3_BUCKET:-letsorder-backups}" \
        "timestamp=${TIMESTAMP},release=${RELEASE_TAG}"
    
    # Keep only last 5 local backups
    cd "$LETSORDER_DIR/backups"
    ls -t backup_*.db | tail -n +6 | xargs -r rm -f
    log "Database backup completed"
fi

# Stop the service if it exists
if [ "$SERVICE_EXISTS" = "true" ]; then
    log "Stopping LetsOrder service..."
    sudo systemctl stop letsorder || true
fi

# Backup current binary
if [ -f "$LETSORDER_DIR/bin/backend" ]; then
    log "Backing up current binary..."
    cp "$LETSORDER_DIR/bin/backend" "$LETSORDER_DIR/bin/backend.old"
fi

# Install new binary
log "Installing new binary..."
cp "$REPO_DIR/backend/target/release/backend" "$LETSORDER_DIR/bin/"
chmod +x "$LETSORDER_DIR/bin/backend"

# Install configuration files
log "Installing configuration files..."
cp /tmp/config/letsorder.service /tmp/letsorder.service.new

# Choose nginx config based on Let's Encrypt certificate availability
# Use sudo since letsencrypt directory is only accessible by root
if sudo test -f /etc/letsencrypt/live/api.letsorder.app/fullchain.pem; then
    log "Let's Encrypt certificates found - using HTTPS configuration"
    cp /tmp/config/nginx.conf /tmp/nginx.conf.new
else
    log "No Let's Encrypt certificates found - using HTTP-only configuration"
    cp /tmp/config/nginx-http-only.conf /tmp/nginx.conf.new
fi

cp /tmp/config/litestream.yml "$LETSORDER_DIR/config/"

# SSL certificates will be handled by Let's Encrypt setup script if needed

# Install systemd service
if [ ! -f /etc/systemd/system/letsorder.service ] || ! cmp -s /tmp/letsorder.service.new /etc/systemd/system/letsorder.service; then
    log "Installing systemd service..."
    sudo cp /tmp/letsorder.service.new /etc/systemd/system/letsorder.service
    sudo systemctl daemon-reload
    sudo systemctl enable letsorder
fi

# Update nginx configuration
if [ ! -f /etc/nginx/sites-available/letsorder ] || ! cmp -s /tmp/nginx.conf.new /etc/nginx/sites-available/letsorder; then
    log "Installing nginx configuration..."
    sudo cp /tmp/nginx.conf.new /etc/nginx/sites-available/letsorder
    
    # Enable site if not already enabled
    if [ ! -L /etc/nginx/sites-enabled/letsorder ]; then
        sudo ln -sf /etc/nginx/sites-available/letsorder /etc/nginx/sites-enabled/
    fi
    
    # Remove default nginx site
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    if sudo nginx -t; then
        if sudo test -f /etc/letsencrypt/live/api.letsorder.app/fullchain.pem; then
            log "Nginx HTTPS configuration is valid (Let's Encrypt certificates)"
        else
            log "Nginx HTTP-only configuration is valid"
            log "NOTE: Application will run on HTTP until SSL certificates are configured"
        fi
    else
        error "Nginx configuration is invalid"
    fi
fi

# Ensure database directory exists and has correct permissions
log "Setting up database directory and permissions..."
mkdir -p "$LETSORDER_DIR/data"
chown -R letsorder:letsorder "$LETSORDER_DIR"
chmod -R 755 "$LETSORDER_DIR"
chmod 644 "$LETSORDER_DIR/data"/*.db 2>/dev/null || true

# Create production settings file (config crate looks for "settings" without extension)
log "Creating production settings configuration..."
cat > "$LETSORDER_DIR/settings.toml" << EOF
[server]
host = "127.0.0.1"
port = 8080

[database]
url = "sqlite:/opt/letsorder/data/letsorder.db"
max_connections = 10

[jwt]
secret = "${JWT_SECRET:-change-this-secret-in-production}"
expiration_hours = 24
EOF

# Also create without extension as config crate expects
cp "$LETSORDER_DIR/settings.toml" "$LETSORDER_DIR/settings"

chown letsorder:letsorder "$LETSORDER_DIR/settings.toml" "$LETSORDER_DIR/settings"
chmod 644 "$LETSORDER_DIR/settings.toml" "$LETSORDER_DIR/settings"
log "Settings file created with database path: sqlite:/opt/letsorder/data/letsorder.db"

# Set up database configuration
log "Setting up database configuration..."
cd "$LETSORDER_DIR"

# Create the database file manually to ensure proper permissions
log "Ensuring database file exists with correct permissions..."
touch "$LETSORDER_DIR/data/letsorder.db"
chown letsorder:letsorder "$LETSORDER_DIR/data/letsorder.db"
chmod 644 "$LETSORDER_DIR/data/letsorder.db"

# Create symlink for fallback compatibility (backend defaults to ./letsorder.db)
log "Creating symlink for database fallback compatibility..."
rm -f "$LETSORDER_DIR/letsorder.db"  # Remove any existing file/symlink
ln -sf "$LETSORDER_DIR/data/letsorder.db" "$LETSORDER_DIR/letsorder.db"
chown -h letsorder:letsorder "$LETSORDER_DIR/letsorder.db"

log "Database configuration complete. Backend will use settings file or fallback to symlink."

# Start the service
log "Starting LetsOrder service..."
sudo systemctl start letsorder

# Wait for service to start and check health
log "Waiting for service to start..."
sleep 5

# Check if service is running
if sudo systemctl is-active --quiet letsorder; then
    log "Service started successfully"
else
    error "Service failed to start"
fi

# Test health endpoint
for i in {1..10}; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health | grep -q "200"; then
        log "Health check passed"
        break
    else
        if [ $i -eq 10 ]; then
            error "Health check failed after 10 attempts"
        fi
        log "Health check attempt $i failed, retrying..."
        sleep 3
    fi
done

# Reload nginx
log "Reloading nginx..."
sudo systemctl reload nginx

# Clean up temporary files
rm -f /tmp/letsorder.service.new /tmp/nginx.conf.new

# Final certificate check and guidance
if sudo test -f /etc/letsencrypt/live/api.letsorder.app/fullchain.pem; then
    log "✓ Let's Encrypt SSL certificates detected and configured"
    log "✓ Application is running with HTTPS enabled"
else
    log "IMPORTANT: SSL certificates are not set up"
    log "Your application is running on HTTP only"
    log ""
    log "To enable HTTPS/SSL:"
    log "Use Let's Encrypt (free): ./deployment/scripts/setup-letsencrypt.sh [SERVER_IP] [SSH_KEY_PATH] api.letsorder.app"
    log ""
fi

log "Deployment completed successfully!"
log "Service status: $(sudo systemctl is-active letsorder)"
log "Release: $RELEASE_TAG deployed"

REMOTE_SCRIPT
)

# Execute deployment on server
log "Executing deployment on server..."
echo "$REMOTE_DEPLOY_SCRIPT" | ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" \
    "cat > /tmp/deploy.sh && chmod +x /tmp/deploy.sh && /tmp/deploy.sh '$RELEASE_TAG' '$SKIP_BACKUP' '$CURRENT_COMMIT' '${JWT_SECRET:-change-this-secret-in-production}'"

# Clean up temporary files on server
log "Cleaning up temporary files on server..."
ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" "rm -rf /tmp/config /tmp/deploy.sh"

# Verify deployment
log "Verifying deployment..."
HEALTH_URL="http://api.letsorder.app/health"
if command_exists "curl"; then
    if curl -s -f "$HEALTH_URL" >/dev/null; then
        log "✓ Deployment verification successful!"
        log "✓ Health endpoint is responding: $HEALTH_URL"
    else
        warn "Health endpoint check failed. Manual verification may be needed."
        warn "This is normal if DNS is not configured or if using local IP access"
    fi
fi

log "Deployment completed successfully!"
log "Release $RELEASE_TAG has been deployed to $SERVER_IP"
log ""
log "Next steps:"
log "1. Test the application functionality"
log "2. Monitor logs: ssh -i $SSH_KEY_PATH $LETSORDER_USER@$SERVER_IP 'sudo journalctl -u letsorder -f'"
log "3. Check service status: ssh -i $SSH_KEY_PATH $LETSORDER_USER@$SERVER_IP 'sudo systemctl status letsorder'"