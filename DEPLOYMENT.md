# Deployment Plan - LetsOrder

This document outlines the complete deployment strategy for the LetsOrder restaurant ordering system.

## Architecture Overview

- **Backend**: Rust Actix Web API deployed on VPS via SSH
- **Database**: SQLite with LiteStream for continuous backups to S3
- **Admin App**: SolidJS app deployed on CloudFlare Pages (admin.yourdomain.com)
- **Menu App**: Astro app deployed on CloudFlare Pages (menu.yourdomain.com)
- **CI/CD**: GitHub Actions for automated deployments from release branch

## 1. VPS Backend Deployment

### 1.1 VPS Requirements

**Minimum Server Specs:**
- 1 vCPU, 1GB RAM (sufficient for <100 concurrent users)
- 10GB SSD storage
- Ubuntu 22.04 LTS or similar
- SSH access with sudo privileges

**Recommended Providers:**
- DigitalOcean Droplets
- Linode
- Vultr
- Hetzner Cloud

### 1.2 Server Setup

#### Initial Server Configuration
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git build-essential sqlite3 unzip

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Create application user
sudo useradd -m -s /bin/bash letsorder
sudo mkdir -p /opt/letsorder
sudo chown letsorder:letsorder /opt/letsorder

# Setup directories
sudo mkdir -p /opt/letsorder/{app,data,logs,backups}
sudo chown -R letsorder:letsorder /opt/letsorder
```

#### Install LiteStream for Database Backups
```bash
# Download and install LiteStream
wget https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz
tar -xzf litestream-v0.3.13-linux-amd64.tar.gz
sudo mv litestream /usr/local/bin/
sudo chmod +x /usr/local/bin/litestream
```

### 1.3 Application Deployment Structure

```
/opt/letsorder/
├── app/                    # Application binaries and files
│   ├── backend             # Rust binary
│   ├── settings.ini        # Production settings
│   └── migrations/         # SQL migrations
├── data/                   # Database files
│   └── letsorder.db        # SQLite database
├── logs/                   # Application logs
│   ├── letsorder.log
│   └── litestream.log
└── backups/               # Local backup staging
```

### 1.4 Production Settings File

Create `/opt/letsorder/app/settings.ini`:

```ini
[server]
host = "0.0.0.0"
port = 8080

[database]
url = "sqlite:/opt/letsorder/data/letsorder.db"
max_connections = 20

[litestream]
replica_url = "s3://YOUR_BACKUP_BUCKET/db-backups/letsorder.db"
sync_interval = "1s"

[jwt]
secret = "GENERATE_SECURE_JWT_SECRET_HERE"
expiration_hours = 24
```

## 2. GitHub Actions Deployment Workflow

### 2.1 Secrets Configuration

Add these secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

```
SSH_HOST=your-vps-ip-address
SSH_USERNAME=letsorder
SSH_KEY=your-private-ssh-key
S3_ACCESS_KEY_ID=your-s3-access-key
S3_SECRET_ACCESS_KEY=your-s3-secret-key
S3_BUCKET=your-backup-bucket-name
S3_REGION=your-s3-region
JWT_SECRET=your-secure-jwt-secret
```

### 2.2 Backend Deployment Workflow

Create `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend to VPS

on:
  push:
    branches: [release]
    paths:
      - 'backend/**'
      - '.github/workflows/deploy-backend.yml'

env:
  CARGO_TERM_COLOR: always

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Install Rust toolchain
      uses: dtolnay/rust-toolchain@stable

    - name: Cache cargo registry
      uses: actions/cache@v4
      with:
        path: |
          ~/.cargo/registry
          ~/.cargo/git
          backend/target
        key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

    - name: Build release binary
      run: |
        cd backend
        cargo build --release

    - name: Prepare deployment package
      run: |
        mkdir -p deploy
        cp backend/target/release/backend deploy/
        cp -r backend/migrations deploy/
        
        # Create production settings
        cat > deploy/settings.ini << EOF
        [server]
        host = "0.0.0.0"
        port = 8080
        
        [database]
        url = "sqlite:/opt/letsorder/data/letsorder.db"
        max_connections = 20
        
        [litestream]
        replica_url = "s3://${{ secrets.S3_BUCKET }}/db-backups/letsorder.db"
        sync_interval = "1s"
        
        [jwt]
        secret = "${{ secrets.JWT_SECRET }}"
        expiration_hours = 24
        EOF

    - name: Deploy to VPS
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.SSH_HOST }}
        username: ${{ secrets.SSH_USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          # Stop services
          sudo systemctl stop letsorder || true
          sudo systemctl stop litestream || true
          
          # Backup current version
          if [ -f /opt/letsorder/app/backend ]; then
            cp /opt/letsorder/app/backend /opt/letsorder/backups/backend.$(date +%Y%m%d_%H%M%S)
          fi

    - name: Upload deployment package
      uses: appleboy/scp-action@v0.1.4
      with:
        host: ${{ secrets.SSH_HOST }}
        username: ${{ secrets.SSH_USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        source: "deploy/*"
        target: "/tmp/letsorder-deploy"

    - name: Complete deployment
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.SSH_HOST }}
        username: ${{ secrets.SSH_USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          # Move files to application directory
          sudo cp -r /tmp/letsorder-deploy/deploy/* /opt/letsorder/app/
          sudo chown -R letsorder:letsorder /opt/letsorder/app/
          sudo chmod +x /opt/letsorder/app/backend
          
          # Run database migrations
          cd /opt/letsorder/app
          sudo -u letsorder ./backend migrate || true
          
          # Start services
          sudo systemctl start letsorder
          sudo systemctl start litestream
          
          # Check service status
          sleep 5
          sudo systemctl is-active letsorder
          sudo systemctl is-active litestream
          
          # Cleanup
          rm -rf /tmp/letsorder-deploy
```

## 3. SystemD Service Configuration

### 3.1 Backend Service

Create `/etc/systemd/system/letsorder.service`:

```ini
[Unit]
Description=LetsOrder Backend Service
After=network.target

[Service]
Type=simple
User=letsorder
Group=letsorder
WorkingDirectory=/opt/letsorder/app
ExecStart=/opt/letsorder/app/backend
Restart=always
RestartSec=10
StandardOutput=append:/opt/letsorder/logs/letsorder.log
StandardError=append:/opt/letsorder/logs/letsorder.log

# Environment variables
Environment="RUST_LOG=info"
Environment="RUST_BACKTRACE=1"

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/letsorder

[Install]
WantedBy=multi-user.target
```

### 3.2 LiteStream Service

Create `/etc/systemd/system/litestream.service`:

```ini
[Unit]
Description=LiteStream Database Backup Service
After=network.target

[Service]
Type=simple
User=letsorder
Group=letsorder
ExecStart=/usr/local/bin/litestream replicate -config /opt/letsorder/app/litestream.yml
Restart=always
RestartSec=10
StandardOutput=append:/opt/letsorder/logs/litestream.log
StandardError=append:/opt/letsorder/logs/litestream.log

[Install]
WantedBy=multi-user.target
```

### 3.3 Enable and Start Services

```bash
# Enable services to start on boot
sudo systemctl enable letsorder
sudo systemctl enable litestream

# Start services
sudo systemctl start letsorder
sudo systemctl start litestream

# Check status
sudo systemctl status letsorder
sudo systemctl status litestream
```

## 4. LiteStream Configuration

### 4.1 LiteStream Config File

Create `/opt/letsorder/app/litestream.yml`:

```yaml
dbs:
  - path: /opt/letsorder/data/letsorder.db
    replicas:
      - type: s3
        bucket: YOUR_BACKUP_BUCKET
        path: db-backups/letsorder.db
        region: YOUR_S3_REGION
        access-key-id: YOUR_ACCESS_KEY
        secret-access-key: YOUR_SECRET_KEY
        sync-interval: 1s
        retention: 72h
```

### 4.2 S3 Bucket Setup

1. Create an S3-compatible bucket (AWS S3, DigitalOcean Spaces, etc.)
2. Create IAM user with minimal permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR_BACKUP_BUCKET",
        "arn:aws:s3:::YOUR_BACKUP_BUCKET/*"
      ]
    }
  ]
}
```

## 5. CloudFlare Pages Deployment

### 5.1 Admin App Configuration

**Build Settings:**
- Framework preset: None
- Build command: `cd adminapp && npm ci && npm run build`
- Build output directory: `adminapp/dist`
- Node.js version: 18

**Environment Variables:**
```
VITE_API_URL=https://api.yourdomain.com
VITE_APP_URL=https://admin.yourdomain.com
VITE_NODE_ENV=production
```

**Custom Headers (`adminapp/_headers`):**
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.css  
  Cache-Control: public, max-age=31536000, immutable
```

**Redirects (`adminapp/_redirects`):**
```
/api/* https://api.yourdomain.com/:splat 200
/*    /index.html   200
```

### 5.2 Menu App Configuration

**Build Settings:**
- Framework preset: Astro
- Build command: `cd menuapp && npm ci && npm run build`
- Build output directory: `menuapp/dist`
- Node.js version: 18

**Environment Variables:**
```
PUBLIC_API_BASE_URL=https://api.yourdomain.com
PUBLIC_API_VERSION=v1
PUBLIC_ENVIRONMENT=production
```

### 5.3 Custom Domains

1. **Admin App**: `admin.yourdomain.com`
   - Point DNS to CloudFlare Pages
   - Enable SSL/TLS

2. **Menu App**: `menu.yourdomain.com`
   - Point DNS to CloudFlare Pages  
   - Enable SSL/TLS

3. **Backend API**: `api.yourdomain.com`
   - Point DNS A record to VPS IP
   - Setup reverse proxy (nginx) or use CloudFlare proxy

## 6. Reverse Proxy Setup (Optional)

If using custom domain for API, setup nginx reverse proxy:

### 6.1 Install Nginx

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

### 6.2 Nginx Configuration

Create `/etc/nginx/sites-available/letsorder-api`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6.3 Enable SSL

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/letsorder-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com
```

## 7. Monitoring and Maintenance

### 7.1 Log Monitoring

```bash
# View backend logs
sudo journalctl -u letsorder -f

# View LiteStream logs  
sudo journalctl -u litestream -f

# View application logs
tail -f /opt/letsorder/logs/letsorder.log
tail -f /opt/letsorder/logs/litestream.log
```

### 7.2 Backup Verification

```bash
# Test database restore
litestream restore -config /opt/letsorder/app/litestream.yml /tmp/test-restore.db

# Verify backup integrity
sqlite3 /tmp/test-restore.db "PRAGMA integrity_check;"
```

### 7.3 Update Process

1. Push changes to `release` branch
2. GitHub Actions automatically deploys
3. Monitor service status and logs
4. Rollback if needed using backup binary

## 8. Security Considerations

1. **SSH Security**:
   - Use key-based authentication only
   - Disable root login
   - Change default SSH port
   - Setup fail2ban

2. **Firewall**:
   ```bash
   sudo ufw allow 22    # SSH
   sudo ufw allow 80    # HTTP
   sudo ufw allow 443   # HTTPS
   sudo ufw enable
   ```

3. **Database**:
   - Regular backup verification
   - SQLite database file permissions (600)
   - Encrypt sensitive data in database

4. **API Security**:
   - JWT token validation
   - Rate limiting (if needed)
   - CORS configuration
   - Input validation

## 9. Troubleshooting

### Common Issues

1. **Service won't start**: Check logs and file permissions
2. **Database locked**: Ensure only one process accesses SQLite
3. **Backup failures**: Verify S3 credentials and network connectivity
4. **Build failures**: Check Node.js version and dependencies

### Health Checks

```bash
# Backend health
curl https://api.yourdomain.com/health

# Service status
sudo systemctl status letsorder litestream

# Disk space
df -h /opt/letsorder
```

## 10. Environment Configuration Summary

### 10.1 Required Environment Variables and Secrets

**GitHub Repository Secrets:**
- `SSH_HOST` - VPS IP address or domain
- `SSH_USERNAME` - SSH user (letsorder)
- `SSH_KEY` - Private SSH key for deployment
- `S3_ACCESS_KEY_ID` - S3-compatible storage access key
- `S3_SECRET_ACCESS_KEY` - S3-compatible storage secret key
- `S3_BUCKET` - Backup bucket name
- `S3_REGION` - S3 region (e.g., us-east-1)
- `JWT_SECRET` - Secure JWT signing key (min 32 characters)

**VPS Environment Files:**
- `/opt/letsorder/app/settings.ini` - Backend configuration
- `/opt/letsorder/app/litestream.yml` - Database backup configuration
- `/etc/systemd/system/letsorder.service` - Backend service definition
- `/etc/systemd/system/litestream.service` - Backup service definition

**CloudFlare Pages Environment Variables:**

*Admin App:*
- `VITE_API_URL=https://api.yourdomain.com`
- `VITE_APP_URL=https://admin.yourdomain.com`
- `VITE_NODE_ENV=production`

*Menu App:*
- `PUBLIC_API_BASE_URL=https://api.yourdomain.com`
- `PUBLIC_API_VERSION=v1`
- `PUBLIC_ENVIRONMENT=production`

### 10.2 DNS Configuration Requirements

**Required DNS Records:**
- `admin.yourdomain.com` → CloudFlare Pages (CNAME)
- `menu.yourdomain.com` → CloudFlare Pages (CNAME)
- `api.yourdomain.com` → VPS IP Address (A Record)
- Optional: `yourdomain.com` → Website/Landing page

### 10.3 S3-Compatible Storage Requirements

**Bucket Configuration:**
- Bucket name: `your-letsorder-backups` (or similar)
- Region: Match your VPS region for optimal performance
- Versioning: Enabled (recommended)
- Public access: Blocked
- Lifecycle policy: Retain backups for 30-90 days

**Supported Providers:**
- AWS S3
- DigitalOcean Spaces
- Linode Object Storage
- Wasabi
- MinIO (self-hosted)

### 10.4 SSL/TLS Certificate Management

**CloudFlare Pages:**
- Automatic SSL certificates provided
- Custom domains supported
- HTTP/2 and HTTP/3 enabled

**VPS API Domain:**
- Let's Encrypt via Certbot (if using nginx)
- CloudFlare proxy SSL (alternative)
- Manual certificate upload (if preferred)

### 10.5 Monitoring and Alerting Setup

**Service Monitoring:**
- SystemD service status monitoring
- Log file monitoring (journalctl integration)
- Disk space monitoring for database growth
- LiteStream backup verification

**Optional Monitoring Tools:**
- Uptime monitoring (UptimeRobot, Pingdom)
- Log aggregation (if using multiple servers)
- Performance monitoring (basic resource usage)

### 10.6 Backup and Recovery Strategy

**Automated Backups:**
- Real-time: LiteStream continuous replication
- Retention: 72 hours of point-in-time recovery
- Verification: Daily integrity checks

**Manual Backup Procedures:**
- Database export before major updates
- Application binary backup before deployment
- Configuration file backups

**Recovery Procedures:**
- Database restore from LiteStream backup
- Application rollback using previous binary
- Service restart and health verification

### 10.7 Security Configuration Checklist

**VPS Security:**
- [ ] SSH key-based authentication only
- [ ] Firewall configured (UFW or iptables)
- [ ] Fail2ban installed and configured
- [ ] Non-root application user (letsorder)
- [ ] File permissions properly set (600 for DB, 644 for configs)
- [ ] Regular security updates enabled

**Application Security:**
- [ ] Strong JWT secret (min 32 random characters)
- [ ] CORS properly configured
- [ ] Input validation on all endpoints
- [ ] Rate limiting considerations
- [ ] HTTPS enforced for all communications

**Database Security:**
- [ ] SQLite file permissions restricted
- [ ] Backup encryption (S3 bucket encryption)
- [ ] Regular backup integrity verification
- [ ] Database connection limits configured

### 10.8 Performance Optimization

**VPS Optimization:**
- SQLite WAL mode enabled
- Connection pooling configured
- Log rotation setup
- Disk space monitoring

**CDN Configuration:**
- CloudFlare Pages provides global CDN
- Static asset caching
- Gzip/Brotli compression
- Image optimization

### 10.9 Deployment Process Overview

**Development to Production Flow:**
1. Development → `main` branch
2. Testing and QA
3. Create release → `release` branch
4. GitHub Actions triggers deployment
5. Backend deployed to VPS automatically
6. Frontend apps deployed to CloudFlare Pages
7. Health checks and monitoring verification

**Rollback Procedures:**
1. Identify deployment issue
2. Stop current services
3. Restore previous backend binary
4. Restore database if needed (LiteStream)
5. Restart services
6. Verify functionality

### 10.10 Cost Estimation

**Monthly Costs (approximate):**
- VPS (1GB RAM, 1 vCPU): $5-10/month
- S3 Storage (backup): $1-5/month
- CloudFlare Pages: Free (with custom domains)
- SSL Certificates: Free (Let's Encrypt/CloudFlare)
- **Total: $6-15/month**

**Scaling Considerations:**
- VPS can handle ~50-100 concurrent users
- Database performance suitable for moderate restaurant usage
- CloudFlare Pages scales automatically
- Upgrade VPS as needed for growth

This deployment plan provides a production-ready setup with automated deployments, continuous database backups, and proper monitoring. Adjust domains, credentials, and configurations according to your specific requirements.
