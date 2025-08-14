# LetsOrder SSH Deployment System

This directory contains the complete SSH-based deployment system for LetsOrder, providing automated server provisioning, application deployment, and rollback capabilities.

## Overview

The deployment system consists of:

- **Server Setup**: One-time server provisioning and hardening
- **Release Deployment**: Automated build, deploy, and health verification
- **Rollback System**: Emergency rollback to previous versions
- **Configuration Management**: Nginx, SystemD, and Litestream configs

## Quick Start

### 1. Environment Setup

```bash
# Copy the environment template
cp deployment/.env.example deployment/.env

# Edit with your actual credentials
nano deployment/.env
```

### 2. Initial Server Setup

```bash
# Provision and configure a new server
./deployment/scripts/setup-server.sh <server-ip> <ssh-key-path>
```

### 3. Deploy Application

**Important**: Deployment must be run from the `main` branch only for security.

```bash
# Switch to main branch first
git checkout main
git pull origin main

# Build and deploy the latest version
./deployment/scripts/deploy-release.sh <server-ip> <ssh-key-path>

# Skip database backup for testing
./deployment/scripts/deploy-release.sh <server-ip> <ssh-key-path> --skip-backup
```

### 4. Rollback (if needed)

```bash
# Rollback to previous version
./deployment/scripts/rollback.sh <server-ip> <ssh-key-path>

# Or rollback to specific database backup
./deployment/scripts/rollback.sh <server-ip> <ssh-key-path> --to-backup=backup_20250811_123456_v1.0.0.db
```

### 5. Check Status

```bash
# Check production deployment status
./deployment/scripts/check-status.sh <server-ip> <ssh-key-path>

# Or use environment variables from .env
./deployment/scripts/check-status.sh
```

## Directory Structure

```
deployment/
├── scripts/
│   ├── setup-server.sh      # Initial server provisioning
│   ├── deploy-release.sh    # Release deployment
│   ├── rollback.sh         # Emergency rollback
│   ├── check-status.sh     # Production status monitoring
│   ├── debug-server.sh     # Server debugging and diagnostics
│   └── setup-letsencrypt.sh # SSL certificate setup
├── config/
│   ├── nginx.conf          # Nginx reverse proxy configuration
│   ├── letsorder.service   # SystemD service definition
│   └── litestream.yml      # Database replication configuration
├── .env.example            # Environment variables template
└── README.md              # This file
```

## Prerequisites

### Local Environment

- **Git** for version control
- **SSH client** with key-based authentication
- **curl** (for HTTP requests and S3-compatible uploads)

### Server Requirements

- **Ubuntu 22.04 LTS** (recommended)
- **2GB RAM minimum** (for building Rust code - Scaleway DEV1-S or equivalent)
- **SSH access with sudo privileges**
- **Public IP address** with port 22 (SSH) and 443 (HTTPS) open
- **Git, Rust, and build tools** will be installed automatically during deployment

### External Services

- **Scaleway account** for server provisioning  
- **S3-compatible storage** for database backups (AWS S3, DigitalOcean Spaces, MinIO, etc.)
- **Domain name** with DNS pointing to your server for Let's Encrypt SSL certificates

## SSL/HTTPS Setup

The deployment system automatically detects and uses Let's Encrypt SSL certificates when available. If no certificates are found, it falls back to HTTP-only configuration.

### Let's Encrypt SSL (Recommended - Free)

Set up free SSL certificates with Let's Encrypt:

```bash
# Set up Let's Encrypt SSL certificates
./deployment/scripts/setup-letsencrypt.sh <server-ip> <ssh-key-path> <domain>

# Example:
./deployment/scripts/setup-letsencrypt.sh 1.2.3.4 ~/.ssh/id_rsa api.letsorder.app
```

**Requirements:**
- Domain must point directly to your server
- Port 80 must be accessible for domain validation
- Automatic certificate renewal is configured

**After Setup:**
- Future deployments will automatically detect and use the certificates
- Nginx will be configured for HTTPS with automatic HTTP redirects
- All security headers and HSTS will be enabled

## Detailed Usage

### Initial Server Setup

The `setup-server.sh` script performs comprehensive server hardening:

```bash
./deployment/scripts/setup-server.sh 1.2.3.4 ~/.ssh/id_rsa
```

**What it does:**
- Updates system packages and installs dependencies (nginx, git, build tools, etc.)
- Creates dedicated `letsorder` user with sudo privileges
- Disables root SSH login and password authentication
- Configures UFW firewall (SSH + HTTPS only)
- Installs and configures fail2ban for intrusion prevention
- Sets up directory structure (`/opt/letsorder/`)
- Installs Litestream for database replication

**Security measures:**
- Root access disabled after setup
- SSH key-based authentication only
- Minimal open ports (22, 443)
- Automated intrusion detection
- Process isolation with dedicated user

### Release Deployment

The `deploy-release.sh` script handles the complete deployment pipeline:

```bash
# Standard deployment
./deployment/scripts/deploy-release.sh 1.2.3.4 ~/.ssh/id_rsa

# Skip database backup (for testing)
./deployment/scripts/deploy-release.sh 1.2.3.4 ~/.ssh/id_rsa --skip-backup
```

**Deployment process:**
1. **Clone/Update**: Clones or updates repository on server
2. **Build**: Compiles Rust binary directly on the server  
3. **Backup**: Creates timestamped database backup
4. **Deploy**: Installs binary and HTTP-only configurations
5. **Migrate**: Runs database migrations automatically
6. **Start**: Restarts service with health verification
7. **Verify**: Tests health endpoint

**Rollback safety:**
- Previous binary saved as `.old`
- Database backed up before deployment
- Automatic rollback if health checks fail
- S3 backup with release tagging

### Emergency Rollback

The `rollback.sh` script provides quick recovery options:

```bash
# Rollback to previous binary version
./deployment/scripts/rollback.sh 1.2.3.4 ~/.ssh/id_rsa

# Rollback to specific database backup
./deployment/scripts/rollback.sh 1.2.3.4 ~/.ssh/id_rsa --to-backup=backup_20250811_123456_v1.0.0.db
```

**Rollback types:**
- **Binary rollback**: Reverts to previous application version
- **Database rollback**: Restores specific database backup
- **Combined rollback**: Both binary and database restoration

## Configuration Files

### Nginx Configuration (`config/nginx.conf`)

**Features:**
- Let's Encrypt SSL certificate support
- Rate limiting (10 requests/second)
- CORS headers for admin/menu apps
- Security headers (HSTS, XSS protection, etc.)
- Gzip compression for API responses
- Health check endpoint bypass
- Automatic HTTP to HTTPS redirect

**SSL Requirements:**
- Automatically uses Let's Encrypt certificates from `/etc/letsencrypt/live/api.letsorder.app/`
- Falls back to HTTP-only configuration if certificates are not available

### SystemD Service (`config/letsorder.service`)

**Security features:**
- Runs as unprivileged `letsorder` user
- Restricted filesystem access (`ProtectSystem=strict`)
- No new privileges (`NoNewPrivileges=true`)
- Private temporary directory
- Memory limits (1GB maximum)

**Monitoring:**
- Automatic restart on failure
- Journal logging with structured output
- Resource accounting enabled

### Database Replication (`config/litestream.yml`)

**Backup strategy:**
- **Continuous**: Real-time replication to S3 (10-second intervals)
- **Snapshots**: Hourly point-in-time backups
- **Retention**: 72 hours for continuous, 30 days for snapshots
- **Multi-region**: Primary (EU) and disaster recovery (US) replicas

## Environment Variables

Copy `deployment/.env.example` to `deployment/.env` and configure:

### Required Variables

```bash
# Scaleway (server provisioning)
SCALEWAY_ACCESS_KEY=your_access_key
SCALEWAY_SECRET_KEY=your_secret_key

# AWS (database backups)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Server configuration
SERVER_HOST=api.letsorder.app
SERVER_IP=1.2.3.4
SSH_KEY_PATH=~/.ssh/id_rsa

# Application security
JWT_SECRET=your_long_secure_jwt_secret
```

## Monitoring and Maintenance

### Health Monitoring

```bash
# Check application health
curl https://api.letsorder.app/health

# Monitor service logs
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo journalctl -u letsorder -f'

# Check service status
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo systemctl status letsorder'
```

### Database Monitoring

```bash
# Check Litestream replication status
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'litestream snapshots /opt/letsorder/data/letsorder.db'

# Verify S3 backups
aws s3 ls s3://letsorder-backups/continuous/ --recursive --human-readable
```

### Security Monitoring

```bash
# Check fail2ban status
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo fail2ban-client status'

# Review nginx access logs
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo tail -f /var/log/nginx/letsorder_access.log'

# Check firewall status
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo ufw status verbose'
```

## Troubleshooting

### Common Issues

**1. SSH Connection Failed**
```bash
# Check SSH key permissions
chmod 600 ~/.ssh/id_rsa

# Test SSH connection manually
ssh -i ~/.ssh/id_rsa -v letsorder@1.2.3.4
```

**2. Health Check Failed**
```bash
# Check service status
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo systemctl status letsorder'

# View recent logs
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo journalctl -u letsorder -n 50'

# Test local health endpoint
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'curl -v http://localhost:8080/health'
```

**3. Database Issues**
```bash
# Check database file permissions
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'ls -la /opt/letsorder/data/'

# Verify database integrity
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sqlite3 /opt/letsorder/data/letsorder.db "PRAGMA integrity_check;"'

# Check Litestream logs
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo journalctl -u litestream -n 50'
```

**4. SSL/TLS Issues**
```bash
# Test SSL certificate
openssl s_client -connect api.letsorder.app:443 -servername api.letsorder.app

# Check nginx configuration
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo nginx -t'

# Verify Let's Encrypt certificate files
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo ls -la /etc/letsencrypt/live/api.letsorder.app/'
```

### Recovery Procedures

**1. Complete Service Recovery**
```bash
# Stop all services
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo systemctl stop letsorder nginx'

# Restore from latest backup
./deployment/scripts/rollback.sh 1.2.3.4 ~/.ssh/id_rsa --to-backup=latest

# Restart services
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo systemctl start nginx letsorder'
```

**2. Database Corruption Recovery**
```bash
# Stop service
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo systemctl stop letsorder'

# Restore from Litestream
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'litestream restore -o /opt/letsorder/data/letsorder.db.restored s3://letsorder-backups/continuous'

# Replace corrupted database
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'mv /opt/letsorder/data/letsorder.db.restored /opt/letsorder/data/letsorder.db'

# Restart service
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo systemctl start letsorder'
```

## Security Considerations

### Server Security
- Root login disabled after initial setup
- SSH key authentication only (no passwords)
- Minimal open ports (22, 443)
- Automatic security updates enabled
- fail2ban intrusion detection
- Process isolation with dedicated user

### Application Security
- JWT-based authentication with secure secrets
- HTTPS-only communication with HSTS (when SSL configured)
- Rate limiting on API endpoints
- Security headers (XSS, CSRF protection)
- Let's Encrypt SSL certificates with automatic renewal

### Data Security
- Encrypted database backups in S3
- Multi-region backup replication
- Point-in-time recovery capability
- Automated backup verification

## Performance Optimization

### Server Resources
- Memory-mapped SQLite for fast database access
- Nginx caching and compression
- Keep-alive connections for API requests
- Resource limits prevent memory leaks

### Monitoring
- Health check endpoints for uptime monitoring
- Structured logging with journald
- Resource accounting with SystemD
- Automatic restart on failures

## Support and Maintenance

### Regular Maintenance Tasks
1. **Weekly**: Review security logs and fail2ban reports
2. **Monthly**: Test backup and restore procedures
3. **Quarterly**: Update server packages and security patches
4. **As needed**: Monitor disk space and clean old backups

### Updating the Deployment System
When updating deployment scripts or configurations:

1. Test changes in a staging environment
2. Update documentation if needed
3. Version control all changes
4. Communicate changes to team members

## Status Monitoring

### Production Status Check (`scripts/check-status.sh`)

Comprehensive monitoring script that checks all aspects of the production deployment:

```bash
# Check all systems
./deployment/scripts/check-status.sh <server-ip> <ssh-key-path>

# Use environment variables
./deployment/scripts/check-status.sh
```

**What it checks:**
- **System Services**: LetsOrder service, Nginx status and auto-start configuration
- **Application Health**: Health endpoint responses, database accessibility, service uptime
- **Network Connectivity**: Public endpoint access, DNS resolution, SSL certificate status
- **Resource Usage**: Memory usage, disk space, recent error logs

**Output:**
- ✅ **Green**: All checks passed
- ⚠️ **Yellow**: Warnings (non-critical issues)
- ❌ **Red**: Critical errors requiring attention

**Exit codes:**
- `0`: All systems operational
- `1`: Warnings present
- `2`: Critical issues detected

**Example output:**
```
[2025-08-12 10:14:01] ✅ SSH connection to 1.2.3.4 working
[2025-08-12 10:14:02] ✅ LetsOrder service is running
[2025-08-12 10:14:02] ✅ Nginx service is running
[2025-08-12 10:14:03] ✅ Health endpoint responding locally
[2025-08-12 10:14:04] ✅ Public health endpoint accessible
==================================================
           STATUS CHECK SUMMARY
==================================================
Checks passed: 12
Warnings: 0
Critical errors: 0
==================================================
✅ All systems operational
```

**Automation**: Can be run from CI/CD pipelines or monitoring systems for automated health checks.

## Demo Data Management

### Overview

The deployment system includes automated demo data management for marketing demos. This ensures consistent demo URLs and clean demo experience by periodically resetting demo data.

### Demo URLs
- **Admin Demo**: `https://a.letsorder.app` (login: `demo@letsorder.app` / `demo123`)
- **Menu Demo**: `https://m.letsorder.app/restaurant/demo-restaurant-123/table/demo-table-456`

### Demo Data Structure
- **Restaurant ID**: `demo-restaurant-123` (fixed for consistent URLs)
- **Table ID**: `demo-table-456` (fixed for consistent URLs)
- **Table Code**: `DEMO001`
- **Manager Email**: `demo@letsorder.app`
- **Manager Password**: `demo123`

### Automated Reset System

**Cron Job**: Demo data is automatically reset every hour on the hour.
**Log File**: `/opt/letsorder/logs/demo-cleanup.log`
**Scripts Location**: `/opt/letsorder/scripts/`

### Manual Demo Reset

```bash
# Reset demo data manually (on server)
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 '/opt/letsorder/scripts/reset-demo-data.sh'

# Reset with custom database path
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 '/opt/letsorder/scripts/reset-demo-data.sh /custom/path/to/database.db'

# Check demo reset logs
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'tail -f /opt/letsorder/logs/demo-cleanup.log'
```

### Demo Reset Process

The reset process:
1. **Clears orders** for the demo restaurant
2. **Resets menu** to default sample items (10 items across 3 sections)
3. **Recreates manager** with demo credentials
4. **Preserves structure** (restaurant and table with fixed IDs)
5. **Verifies success** and logs results

### Demo Reset Components

**Rust Binary** (`/opt/letsorder/bin/demo_reset`):
- Primary method using proper password hashing (Argon2)
- Database-safe transactions
- Comprehensive error handling

**Shell Script** (`/opt/letsorder/scripts/reset-demo-data.sh`):
- Orchestrates reset process
- Handles logging and verification
- Falls back to SQL script if Rust binary unavailable

**SQL Script** (`/opt/letsorder/scripts/demo-reset.sql`):
- Fallback method for demo reset
- Used when Rust binary is not available

### Monitoring Demo System

```bash
# Check cron job status
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo -u letsorder crontab -l'

# Verify demo data exists
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sqlite3 /opt/letsorder/data/letsorder.db "SELECT id, name FROM restaurants WHERE id = \"demo-restaurant-123\";"'

# Check demo reset logs
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'tail -20 /opt/letsorder/logs/demo-cleanup.log'
```

### Demo Data Troubleshooting

**Issue**: Demo URLs not working
```bash
# Verify demo restaurant exists
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sqlite3 /opt/letsorder/data/letsorder.db "SELECT COUNT(*) FROM restaurants WHERE id = \"demo-restaurant-123\";"'

# Check table exists
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sqlite3 /opt/letsorder/data/letsorder.db "SELECT id, unique_code FROM tables WHERE id = \"demo-table-456\";"'

# Manually reset demo data
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 '/opt/letsorder/scripts/reset-demo-data.sh'
```

**Issue**: Cron job not running
```bash
# Check cron job exists
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo -u letsorder crontab -l | grep demo'

# Check cron service status
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo systemctl status cron'

# Re-add cron job if missing
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 '(sudo -u letsorder crontab -l 2>/dev/null; echo "0 * * * * /opt/letsorder/scripts/reset-demo-data.sh >> /opt/letsorder/logs/demo-cleanup.log 2>&1") | sudo -u letsorder crontab -'
```

## Related Resources

- [LetsOrder Project Repository](https://github.com/brainless/letsorder)
- [Issue #113: SSH Deployment](https://github.com/brainless/letsorder/issues/113)
- [Scaleway Documentation](https://www.scaleway.com/en/docs/)
- [CloudFlare API Documentation](https://api.cloudflare.com/)
- [Litestream Documentation](https://litestream.io/getting-started/)