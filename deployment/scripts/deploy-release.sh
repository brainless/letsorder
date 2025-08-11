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

# CloudFlare certificate setup function
setup_cloudflare_certificates() {
    local domain="$1"
    
    if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ZONE_ID" ]; then
        warn "CloudFlare API credentials not found in environment"
        echo ""
        echo "To automatically set up SSL certificates, please provide:"
        echo "1. CloudFlare API Token (with Zone:SSL and Certificates:Edit permissions)"
        echo "2. CloudFlare Zone ID for your domain"
        echo ""
        echo "You can find these at:"
        echo "  - API Tokens: https://dash.cloudflare.com/profile/api-tokens"
        echo "  - Zone ID: In your domain's overview page (right sidebar)"
        echo ""
        read -p "Do you want to enter CloudFlare credentials now? [y/N]: " -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo ""
            read -p "Enter CloudFlare API Token: " -s CLOUDFLARE_API_TOKEN
            echo ""
            read -p "Enter CloudFlare Zone ID: " CLOUDFLARE_ZONE_ID
            echo ""
        else
            log "Skipping automatic certificate setup"
            log "You'll need to manually place certificates in /etc/ssl/cloudflare/"
            return 1
        fi
    fi
    
    # Validate credentials before proceeding
    log "Validating CloudFlare credentials..."
    local validation_response=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$validation_response" | grep -q '"success":true'; then
        local zone_name=$(echo "$validation_response" | sed -n 's/.*"name":"\([^"]*\)".*/\1/p')
        log "CloudFlare credentials validated for zone: $zone_name"
        
        # Check if zone supports Origin Certificates (paid plans only)
        local plan_name=$(echo "$validation_response" | sed -n 's/.*"plan":{"id":"[^"]*","name":"\([^"]*\)".*/\1/p')
        log "CloudFlare plan: $plan_name"
        
        if echo "$plan_name" | grep -qi "free"; then
            warn "Origin Certificates are not available on CloudFlare Free plan"
            echo ""
            echo "CloudFlare Origin Certificates require a paid plan (Pro, Business, or Enterprise)."
            echo "For the Free plan, you have these alternatives:"
            echo ""
            echo "1. Upgrade to CloudFlare Pro plan (\$20/month) to use Origin Certificates"
            echo "2. Use Let's Encrypt with certbot (free) - run: ./deployment/scripts/setup-letsencrypt.sh $SERVER_IP $SSH_KEY_PATH api.letsorder.app"
            echo "3. Continue with HTTP-only deployment for testing"
            echo ""
            echo "More info: https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/"
            echo ""
            return 1
        fi
        
        # Test Origin Certificate API access for paid plans
        log "Testing Origin Certificate API access..."
        local cert_test_response=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/origin_ca_certificates" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json")
        
        if echo "$cert_test_response" | grep -q '"success":true'; then
            log "Origin Certificate API access confirmed"
        else
            local cert_error=$(echo "$cert_test_response" | sed -n 's/.*"message":"\([^"]*\)".*/\1/p')
            error "Origin Certificate API access failed: $cert_error"
            echo ""
            echo "Your API token needs these specific permissions:"
            echo "  - Zone:Zone:Read"
            echo "  - Zone:SSL and Certificates:Edit"
            echo ""
            echo "Make sure the token includes access to the zone: $zone_name"
            echo ""
            return 1
        fi
    else
        local error_msg=$(echo "$validation_response" | sed -n 's/.*"message":"\([^"]*\)".*/\1/p')
        if [ -z "$error_msg" ]; then
            error_msg="Invalid Zone ID or API token lacks required permissions"
        fi
        
        error "CloudFlare credential validation failed: $error_msg"
        echo ""
        echo "Please check:"
        echo "1. Zone ID is correct (from domain overview page in CloudFlare dashboard)"
        echo "2. API token has these permissions:"
        echo "   - Zone:Zone:Read" 
        echo "   - Zone:SSL and Certificates:Edit"
        echo "3. API token includes the correct zone resources"
        echo ""
        return 1
    fi
    
    log "Setting up CloudFlare Origin Certificate for $domain..."
    
    # Create certificate request with minimal settings
    local cert_request=$(cat << EOF
{
    "type": "origin-rsa",
    "hostnames": ["$domain"],
    "requested_validity": 365
}
EOF
)
    
    log "Sending certificate request to CloudFlare..."
    log "API Endpoint: https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/origin_ca_certificates"
    
    # Request certificate from CloudFlare with more verbose output
    local cert_response=$(curl -s -w "HTTP_STATUS:%{http_code}\n" -X POST \
        "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/origin_ca_certificates" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$cert_request")
    
    local http_status=$(echo "$cert_response" | grep "HTTP_STATUS:" | cut -d: -f2)
    local response_body=$(echo "$cert_response" | sed '/HTTP_STATUS:/d')
    
    log "HTTP Status: $http_status"
    
    if [ "$http_status" = "200" ] && echo "$response_body" | grep -q '"success":true'; then
        log "Certificate request successful"
        
        # Extract certificate and key using more robust JSON parsing
        local certificate=$(echo "$response_body" | sed -n 's/.*"certificate":"\([^"]*\)".*/\1/p' | sed 's/\\n/\n/g')
        local private_key=$(echo "$response_body" | sed -n 's/.*"private_key":"\([^"]*\)".*/\1/p' | sed 's/\\n/\n/g')
        
        if [ -z "$certificate" ] || [ -z "$private_key" ]; then
            error "Failed to extract certificate data from CloudFlare response"
            echo "Response: $response_body"
            return 1
        fi
        
        # Save certificate files
        echo "$certificate" > /tmp/cloudflare_cert.pem
        echo "$private_key" > /tmp/cloudflare_key.pem
        
        # Download CloudFlare Origin CA
        log "Downloading CloudFlare Origin CA certificate..."
        if curl -s -f https://developers.cloudflare.com/ssl/static/origin_ca_ecc_root.pem > /tmp/cloudflare_origin_ca.pem; then
            log "CloudFlare certificates generated successfully"
            return 0
        else
            error "Failed to download CloudFlare Origin CA certificate"
            return 1
        fi
    else
        local error_msg=$(echo "$response_body" | sed -n 's/.*"message":"\([^"]*\)".*/\1/p')
        if [ -z "$error_msg" ]; then
            error_msg="HTTP $http_status - Check API token permissions and zone access"
        fi
        
        error "Failed to generate CloudFlare certificate: $error_msg"
        echo ""
        echo "Full API Response:"
        echo "$response_body"
        echo ""
        echo "This usually means:"
        echo "1. Your API token doesn't have 'Zone:SSL and Certificates:Edit' permission"
        echo "2. The API token doesn't include access to this specific zone"
        echo "3. The zone might not be on a plan that supports Origin Certificates"
        echo ""
        return 1
    fi
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

# Get current git commit for deployment
CURRENT_COMMIT=$(git rev-parse HEAD)

# Set up CloudFlare certificates if needed
DOMAIN="api.letsorder.app"  # Extract from SERVER_HOST env var if available
if [ -n "$SERVER_HOST" ]; then
    DOMAIN="$SERVER_HOST"
fi

log "Checking CloudFlare certificate setup..."
if setup_cloudflare_certificates "$DOMAIN"; then
    log "CloudFlare certificates will be installed during deployment"
    CERT_FILES_AVAILABLE="true"
else
    warn "CloudFlare certificates not set up - deployment will continue but HTTPS will not work"
    warn "The application will run on HTTP only until SSL certificates are configured"
    echo ""
    echo "Options to fix this:"
    echo "1. Upgrade to CloudFlare Pro plan and re-run this script"
    echo "2. Use Let's Encrypt (free): ./deployment/scripts/setup-letsencrypt.sh $SERVER_IP $SSH_KEY_PATH api.letsorder.app"
    echo "3. Continue with HTTP-only deployment for testing"
    echo ""
    read -p "Continue with deployment anyway? [y/N]: " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Deployment cancelled by user"
        exit 0
    fi
    CERT_FILES_AVAILABLE="false"
fi

# Upload deployment configuration files
log "Uploading deployment configuration files to server..."
scp $SSH_OPTS -r deployment/config "$LETSORDER_USER@$SERVER_IP:/tmp/"

# Upload certificate files if available
if [ "$CERT_FILES_AVAILABLE" = "true" ]; then
    log "Uploading CloudFlare certificates to server..."
    scp $SSH_OPTS /tmp/cloudflare_*.pem "$LETSORDER_USER@$SERVER_IP:/tmp/"
fi

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
    git fetch origin
fi

cd "$REPO_DIR"
log "Checking out commit: $COMMIT_HASH"
git checkout "$COMMIT_HASH"

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

# Choose nginx config based on certificate availability
DOMAIN="\${SERVER_HOST:-api.letsorder.app}"
if [ -f /tmp/cloudflare_cert.pem ]; then
    log "Using HTTPS nginx configuration with CloudFlare certificates"
    cp /tmp/config/nginx.conf /tmp/nginx.conf.new
elif [ -f /etc/letsencrypt/live/\$DOMAIN/fullchain.pem ]; then
    log "Using existing HTTPS nginx configuration (Let's Encrypt certificates detected)"
    # Don't overwrite existing Let's Encrypt nginx config
    if [ ! -f /etc/nginx/sites-available/letsorder ] || ! grep -q "letsencrypt" /etc/nginx/sites-available/letsorder; then
        log "Let's Encrypt nginx config not found, using HTTP-only config"
        cp /tmp/config/nginx-http-only.conf /tmp/nginx.conf.new
    else
        log "Keeping existing Let's Encrypt nginx configuration"
        cp /etc/nginx/sites-available/letsorder /tmp/nginx.conf.new
    fi
else
    log "Using HTTP-only nginx configuration (no SSL certificates available)"
    cp /tmp/config/nginx-http-only.conf /tmp/nginx.conf.new
fi

cp /tmp/config/litestream.yml "$LETSORDER_DIR/config/"

# Check and install CloudFlare certificates if available
if [ -f /tmp/cloudflare_cert.pem ]; then
    log "Installing CloudFlare certificates..."
    sudo mkdir -p /etc/ssl/cloudflare
    sudo cp /tmp/cloudflare_cert.pem /etc/ssl/cloudflare/cert.pem
    sudo cp /tmp/cloudflare_key.pem /etc/ssl/cloudflare/key.pem
    sudo cp /tmp/cloudflare_origin_ca.pem /etc/ssl/cloudflare/origin-ca.pem
    sudo chown root:root /etc/ssl/cloudflare/*
    sudo chmod 600 /etc/ssl/cloudflare/*
    log "CloudFlare certificates installed"
fi

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
        if [ -f /etc/ssl/cloudflare/cert.pem ]; then
            log "Nginx HTTPS configuration is valid (CloudFlare certificates)"
        elif [ -f /etc/letsencrypt/live/\$DOMAIN/fullchain.pem ]; then
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
DOMAIN="\${SERVER_HOST:-api.letsorder.app}"
if [ ! -f /etc/ssl/cloudflare/cert.pem ] && [ ! -f /etc/letsencrypt/live/\$DOMAIN/fullchain.pem ]; then
    log "IMPORTANT: SSL certificates are not set up"
    log "Your application is running but HTTPS/SSL is not configured"
    log ""
    log "To complete the setup:"
    log "1. Use Let's Encrypt (free): ./deployment/scripts/setup-letsencrypt.sh \$SERVER_IP \$SSH_KEY_PATH \$DOMAIN"
    log "2. Or upgrade CloudFlare to Pro plan for Origin Certificates"
    log ""
elif [ -f /etc/letsencrypt/live/\$DOMAIN/fullchain.pem ]; then
    log "✓ Let's Encrypt SSL certificates detected and configured"
elif [ -f /etc/ssl/cloudflare/cert.pem ]; then
    log "✓ CloudFlare Origin SSL certificates detected and configured"
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
ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" "rm -rf /tmp/config /tmp/deploy.sh /tmp/cloudflare_*.pem"

# Clean up local temporary files
if [ "$CERT_FILES_AVAILABLE" = "true" ]; then
    log "Cleaning up local certificate files..."
    rm -f /tmp/cloudflare_*.pem
fi

# Verify deployment
log "Verifying deployment..."
HEALTH_URL="https://api.letsorder.app/health"
if command_exists "curl"; then
    if curl -s -f "$HEALTH_URL" >/dev/null; then
        log "✓ Deployment verification successful!"
        log "✓ Health endpoint is responding: $HEALTH_URL"
    else
        warn "Health endpoint check failed. Manual verification may be needed."
    fi
fi

log "Deployment completed successfully!"
log "Release $RELEASE_TAG has been deployed to $SERVER_IP"
log ""
log "Next steps:"
log "1. Test the application functionality"
log "2. Monitor logs: ssh -i $SSH_KEY_PATH $LETSORDER_USER@$SERVER_IP 'sudo journalctl -u letsorder -f'"
log "3. Check service status: ssh -i $SSH_KEY_PATH $LETSORDER_USER@$SERVER_IP 'sudo systemctl status letsorder'"