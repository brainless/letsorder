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

```bash
# Build and deploy the latest version
./deployment/scripts/deploy-release.sh <server-ip> <ssh-key-path>
```

### 4. Rollback (if needed)

```bash
# Rollback to previous version
./deployment/scripts/rollback.sh <server-ip> <ssh-key-path>

# Or rollback to specific database backup
./deployment/scripts/rollback.sh <server-ip> <ssh-key-path> --to-backup=backup_20250811_123456_v1.0.0.db
```

## Directory Structure

```
deployment/
├── scripts/
│   ├── setup-server.sh      # Initial server provisioning
│   ├── deploy-release.sh    # Release deployment
│   └── rollback.sh         # Emergency rollback
├── config/
│   ├── nginx.conf          # Nginx reverse proxy configuration
│   ├── letsorder.service   # SystemD service definition
│   └── litestream.yml      # Database replication configuration
├── .env.example            # Environment variables template
└── README.md              # This file
```

## Prerequisites

### Local Environment

- **Rust toolchain** with cross-compilation support
- **SSH client** with key-based authentication
- **AWS CLI** (for database backups)
- **curl** (for health checks)

### Server Requirements

- **Ubuntu 22.04 LTS** (recommended)
- **1 CPU, 2GB RAM minimum** (Scaleway DEV1-S or equivalent)
- **SSH access with sudo privileges**
- **Public IP address** with port 22 (SSH) and 443 (HTTPS) open

### External Services

- **Scaleway account** for server provisioning
- **CloudFlare account** for SSL certificates and CDN
- **AWS S3 bucket** for database backups

## Detailed Usage

### Initial Server Setup

The `setup-server.sh` script performs comprehensive server hardening:

```bash
./deployment/scripts/setup-server.sh 1.2.3.4 ~/.ssh/id_rsa
```

**What it does:**
- Updates system packages and installs dependencies
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
1. **Build**: Cross-compiles Rust binary for production
2. **Package**: Creates deployment package with configs
3. **Backup**: Creates timestamped database backup
4. **Upload**: Transfers files via SCP
5. **Deploy**: Installs binary and configurations
6. **Migrate**: Runs database migrations
7. **Start**: Restarts service with health verification
8. **Verify**: Tests health endpoint

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
- CloudFlare Origin Certificate authentication
- Rate limiting (10 requests/second)
- CORS headers for admin/menu apps
- Security headers (HSTS, XSS protection, etc.)
- Gzip compression for API responses
- Health check endpoint bypass

**SSL Setup:**
```bash
# Place CloudFlare certificates in:
/etc/ssl/cloudflare/cert.pem      # Origin certificate
/etc/ssl/cloudflare/key.pem       # Private key
/etc/ssl/cloudflare/origin-ca.pem # CloudFlare root CA
```

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

# CloudFlare (SSL certificates)
CLOUDFLARE_API_TOKEN=your_api_token

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

# Verify certificate files
ssh -i ~/.ssh/id_rsa letsorder@1.2.3.4 'sudo ls -la /etc/ssl/cloudflare/'
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
- HTTPS-only communication with HSTS
- CloudFlare DDoS protection and WAF
- Rate limiting on API endpoints
- Security headers (XSS, CSRF protection)

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

## Related Resources

- [LetsOrder Project Repository](https://github.com/brainless/letsorder)
- [Issue #113: SSH Deployment](https://github.com/brainless/letsorder/issues/113)
- [Scaleway Documentation](https://www.scaleway.com/en/docs/)
- [CloudFlare API Documentation](https://api.cloudflare.com/)
- [Litestream Documentation](https://litestream.io/getting-started/)