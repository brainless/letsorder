#!/bin/bash

# LetsOrder Let's Encrypt SSL Setup Script
# This script sets up Let's Encrypt SSL certificates as an alternative to CloudFlare Origin Certificates
# Usage: ./setup-letsencrypt.sh <server-ip> <ssh-key-path> <domain>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
LETSORDER_USER="letsorder"

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
if [ $# -ne 3 ]; then
    error "Usage: $0 <server-ip> <ssh-key-path> <domain>"
fi

SERVER_IP="$1"
SSH_KEY_PATH="$2"
DOMAIN="$3"

# Check if SSH key exists
if [ ! -f "$SSH_KEY_PATH" ]; then
    error "SSH key file not found: $SSH_KEY_PATH"
fi

log "Setting up Let's Encrypt SSL certificates for $DOMAIN on $SERVER_IP"

echo ""
echo "⚠️  IMPORTANT CloudFlare DNS Configuration Required:"
echo ""
echo "Before proceeding, you MUST disable CloudFlare proxy for your domain:"
echo "1. Go to CloudFlare Dashboard → DNS → Records"
echo "2. Find the A record for '$DOMAIN' (or @ for root domain)"
echo "3. Click the orange cloud ☁️ to turn it gray (DNS only mode)"
echo "4. Wait 2-3 minutes for DNS propagation"
echo ""
echo "Why? Let's Encrypt needs direct access to your server to validate domain ownership."
echo "You can re-enable the proxy AFTER certificate installation."
echo ""
read -p "Have you disabled CloudFlare proxy for $DOMAIN? [y/N]: " -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    error "Please disable CloudFlare proxy first, then re-run this script"
fi

log "Checking if domain points directly to server..."
if ! command -v dig >/dev/null 2>&1; then
    log "Installing DNS utilities..."
    sudo apt update && sudo apt install -y dnsutils
fi

RESOLVED_IP=$(dig +short "$DOMAIN" @8.8.8.8 | tail -1)
if [ -z "$RESOLVED_IP" ]; then
    error "Could not resolve domain $DOMAIN. Please check DNS configuration."
elif [ "$RESOLVED_IP" != "$SERVER_IP" ]; then
    error "Domain $DOMAIN resolves to $RESOLVED_IP but server is at $SERVER_IP. Please check DNS configuration and ensure CloudFlare proxy is disabled."
fi
log "DNS check passed: $DOMAIN → $SERVER_IP"

# Test SSH connection
log "Testing SSH connection..."
SSH_OPTS="-i $SSH_KEY_PATH -o ConnectTimeout=10 -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

if ! ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" exit; then
    error "Cannot connect to server via SSH. Please check server IP and SSH key."
fi

# Create Let's Encrypt setup script
LETSENCRYPT_SCRIPT=$(cat << 'REMOTE_SCRIPT'
#!/bin/bash
set -e

log() {
    echo -e "\033[0;32m[$(date +'%Y-%m-%d %H:%M:%S')] $1\033[0m"
}

error() {
    echo -e "\033[0;31m[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1\033[0m"
    exit 1
}

DOMAIN="$1"

log "Installing certbot for Let's Encrypt..."
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

log "Stopping nginx temporarily for certificate generation..."
sudo systemctl stop nginx

log "Generating Let's Encrypt certificate for $DOMAIN..."
sudo certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN"

log "Creating nginx configuration with Let's Encrypt certificates..."
cat > /tmp/nginx-letsencrypt.conf << EOF
# LetsOrder Nginx Configuration with Let's Encrypt SSL
# Rate limiting
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;

# Upstream backend
upstream letsorder_backend {
    server 127.0.0.1:8080 fail_timeout=5s max_fails=3;
    keepalive 32;
}

# HTTP redirect to HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    
    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all other HTTP requests to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL Configuration with Let's Encrypt
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    
    # Logging
    access_log /var/log/nginx/letsorder_access.log;
    error_log /var/log/nginx/letsorder_error.log;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types application/json application/javascript text/css text/javascript text/xml application/xml;
    
    # Health check endpoint (bypasses rate limiting)
    location /health {
        access_log off;
        proxy_pass http://letsorder_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }
    
    # API endpoints with rate limiting
    location /api/ {
        # Apply rate limiting
        limit_req zone=api burst=20 nodelay;
        
        # CORS headers for browser requests
        add_header 'Access-Control-Allow-Origin' 'https://admin.letsorder.app' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
        add_header 'Access-Control-Max-Age' 86400 always;
        
        # Handle preflight requests
        if (\$request_method = 'OPTIONS') {
            return 204;
        }
        
        # Proxy to backend
        proxy_pass http://letsorder_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Timeout settings
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 8k;
        proxy_buffers 8 8k;
        
        # Keep alive
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
    
    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Default location - redirect to documentation or admin
    location / {
        return 301 https://admin.letsorder.app;
    }
}
EOF

log "Installing nginx configuration..."
sudo cp /tmp/nginx-letsencrypt.conf /etc/nginx/sites-available/letsorder
sudo ln -sf /etc/nginx/sites-available/letsorder /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

log "Testing nginx configuration..."
sudo nginx -t

log "Starting nginx..."
sudo systemctl start nginx

log "Setting up automatic certificate renewal..."
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

log "Let's Encrypt SSL setup completed successfully!"
log "Certificate will auto-renew every 12 hours via systemd timer"

REMOTE_SCRIPT
)

# Execute Let's Encrypt setup on server
log "Executing Let's Encrypt setup on server..."
echo "$LETSENCRYPT_SCRIPT" | ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" \
    "cat > /tmp/letsencrypt-setup.sh && chmod +x /tmp/letsencrypt-setup.sh && /tmp/letsencrypt-setup.sh '$DOMAIN'"

# Clean up
log "Cleaning up temporary files..."
ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" "rm -f /tmp/letsencrypt-setup.sh /tmp/nginx-letsencrypt.conf"

log "Let's Encrypt SSL setup completed successfully!"
log "Your site should now be accessible at: https://$DOMAIN"
log ""
log "🔄 IMPORTANT: Re-enable CloudFlare Proxy (Optional)"
log "You can now re-enable CloudFlare's proxy for additional features:"
log "1. Go to CloudFlare Dashboard → DNS → Records"
log "2. Click the gray cloud next to '$DOMAIN' to make it orange ☁️"
log "3. This enables CloudFlare's CDN, DDoS protection, and other features"
log ""
log "Note: Certificate renewals will work even with proxy enabled"
log ""
log "Certificate renewal:"
log "- Certificates will automatically renew via systemd timer"
log "- Check status: ssh -i $SSH_KEY_PATH $LETSORDER_USER@$SERVER_IP 'sudo systemctl status certbot.timer'"
log "- Manual renewal: ssh -i $SSH_KEY_PATH $LETSORDER_USER@$SERVER_IP 'sudo certbot renew'"