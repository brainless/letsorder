#!/bin/bash

# Debug script to check server configuration and service status
# Usage: ./debug-server.sh <server-ip> <ssh-key-path>

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SERVER_IP="$1"
SSH_KEY_PATH="$2"
LETSORDER_USER="letsorder"

if [ $# -ne 2 ]; then
    echo "Usage: $0 <server-ip> <ssh-key-path>"
    exit 1
fi

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

SSH_OPTS="-i $SSH_KEY_PATH -o ConnectTimeout=10 -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

log "Debugging LetsOrder service on $SERVER_IP"

log "=== Service Status ==="
ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" 'sudo systemctl status letsorder --no-pager' || true

log "=== Service Logs (last 20 lines) ==="
ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" 'sudo journalctl -u letsorder --no-pager -n 20' || true

log "=== File Permissions ==="
ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" 'ls -la /opt/letsorder/data/' || true
ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" 'ls -la /opt/letsorder/settings*' || true

log "=== Configuration Files ==="
ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" 'cat /opt/letsorder/settings 2>/dev/null || echo "No settings file found"'

log "=== Environment Variables (from service) ==="
ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" 'sudo systemctl show letsorder --property=Environment' || true

log "=== Directory Structure ==="
ssh $SSH_OPTS "$LETSORDER_USER@$SERVER_IP" 'find /opt/letsorder -type f -ls 2>/dev/null | head -20' || true

log "Debug information collected"