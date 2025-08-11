#!/bin/bash

# LetsOrder Server Setup Script
# This script sets up a fresh Ubuntu 22.04 LTS server for LetsOrder deployment
# Usage: ./setup-server.sh <server-ip> <ssh-key-path>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
LETSORDER_USER="letsorder"
LETSORDER_HOME="/home/$LETSORDER_USER"
LETSORDER_DIR="/opt/letsorder"

# Function to print colored output
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check arguments
if [ $# -ne 2 ]; then
    error "Usage: $0 <server-ip> <ssh-key-path>"
fi

SERVER_IP="$1"
SSH_KEY_PATH="$2"

# Check if SSH key exists
if [ ! -f "$SSH_KEY_PATH" ]; then
    error "SSH key file not found: $SSH_KEY_PATH"
fi

log "Starting LetsOrder server setup for $SERVER_IP"

# Test SSH connection
log "Testing SSH connection..."
if ! ssh -i "$SSH_KEY_PATH" -o ConnectTimeout=10 -o BatchMode=yes root@"$SERVER_IP" exit; then
    error "Cannot connect to server via SSH. Please check server IP and SSH key."
fi

log "SSH connection successful. Starting server configuration..."

# Create setup script to run on server
SETUP_SCRIPT=$(cat << 'REMOTE_SCRIPT'
#!/bin/bash
set -e

# Suppress debconf warnings for non-interactive installs
export DEBIAN_FRONTEND=noninteractive

log() {
    echo -e "\033[0;32m[$(date +'%Y-%m-%d %H:%M:%S')] $1\033[0m"
}

error() {
    echo -e "\033[0;31m[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1\033[0m"
    exit 1
}

LETSORDER_USER="letsorder"
LETSORDER_HOME="/home/$LETSORDER_USER"
LETSORDER_DIR="/opt/letsorder"

log "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt update && apt upgrade -y

log "Installing dependencies..."
apt install -y nginx sqlite3 curl unzip ufw fail2ban

log "Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

log "Creating letsorder user..."
if ! id "$LETSORDER_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$LETSORDER_USER"
    usermod -aG sudo "$LETSORDER_USER"
    log "Created user: $LETSORDER_USER"
else
    log "User $LETSORDER_USER already exists"
fi

log "Setting up SSH keys for letsorder user..."
mkdir -p "$LETSORDER_HOME/.ssh"
if [ -f /root/.ssh/authorized_keys ]; then
    if [ ! -f "$LETSORDER_HOME/.ssh/authorized_keys" ] || ! cmp -s /root/.ssh/authorized_keys "$LETSORDER_HOME/.ssh/authorized_keys"; then
        cp /root/.ssh/authorized_keys "$LETSORDER_HOME/.ssh/"
        log "SSH keys copied to letsorder user"
    else
        log "SSH keys already up to date for letsorder user"
    fi
    chown -R "$LETSORDER_USER:$LETSORDER_USER" "$LETSORDER_HOME/.ssh"
    chmod 700 "$LETSORDER_HOME/.ssh"
    chmod 600 "$LETSORDER_HOME/.ssh/authorized_keys"
else
    error "No authorized_keys found for root user"
fi

log "Disabling root SSH login..."
SSH_CONFIG_CHANGED=false

if ! grep -q "^PermitRootLogin no" /etc/ssh/sshd_config; then
    sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
    SSH_CONFIG_CHANGED=true
    log "Root SSH login disabled"
else
    log "Root SSH login already disabled"
fi

if ! grep -q "^PasswordAuthentication no" /etc/ssh/sshd_config; then
    sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
    SSH_CONFIG_CHANGED=true
    log "Password authentication disabled"
else
    log "Password authentication already disabled"
fi

if [ "$SSH_CONFIG_CHANGED" = true ]; then
    log "Restarting SSH service due to configuration changes"
    systemctl restart sshd
else
    log "SSH configuration unchanged, no restart needed"
fi

log "Installing Litestream..."
if [ ! -f /usr/local/bin/litestream ]; then
    curl -L https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64-static.tar.gz | tar -xz -C /usr/local/bin
    log "Litestream installed"
else
    log "Litestream already installed"
fi

log "Creating LetsOrder directory structure..."
mkdir -p "$LETSORDER_DIR"/{bin,data,config,logs,backups}
chown -R "$LETSORDER_USER:$LETSORDER_USER" "$LETSORDER_DIR"

log "Creating SSL certificate directory..."
mkdir -p /etc/ssl/cloudflare
chown root:root /etc/ssl/cloudflare
chmod 700 /etc/ssl/cloudflare

log "Configuring fail2ban..."
if [ ! -f /etc/fail2ban/jail.local ]; then
    cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
EOF
    log "fail2ban configuration created"
else
    log "fail2ban already configured"
fi

systemctl enable fail2ban
systemctl restart fail2ban

log "Server setup completed successfully!"
log "Next steps:"
log "1. Configure CloudFlare certificates"
log "2. Set up nginx configuration" 
log "3. Deploy LetsOrder application"

REMOTE_SCRIPT
)

# Upload and execute setup script
log "Uploading setup script to server..."
echo "$SETUP_SCRIPT" | ssh -i "$SSH_KEY_PATH" root@"$SERVER_IP" "cat > /tmp/setup-letsorder.sh && chmod +x /tmp/setup-letsorder.sh"

log "Executing setup script on server..."
ssh -i "$SSH_KEY_PATH" root@"$SERVER_IP" "/tmp/setup-letsorder.sh"

# Clean up
log "Cleaning up temporary files..."
ssh -i "$SSH_KEY_PATH" root@"$SERVER_IP" "rm -f /tmp/setup-letsorder.sh"

log "Server setup completed successfully!"
log "You can now SSH to the server using: ssh -i $SSH_KEY_PATH $LETSORDER_USER@$SERVER_IP"

warn "IMPORTANT: Root SSH access has been disabled. Use the letsorder user for all future access."
warn "Next steps:"
warn "1. Run deploy-release.sh to deploy the application"
warn "2. Configure CloudFlare certificates using your API token"
warn "3. Test the deployment"