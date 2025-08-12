#!/bin/bash

# LetsOrder Production Status Check Script
# This script checks the status of the production deployment
# Usage: ./check-status.sh [server-ip] [ssh-key-path]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Status icons
CHECK_MARK="✅"
CROSS_MARK="❌"
WARNING_MARK="⚠️"
INFO_MARK="ℹ️"

# Configuration
LETSORDER_USER="letsorder"
LETSORDER_DIR="/opt/letsorder"
HEALTH_ENDPOINT="/health"

# Global status tracking
CRITICAL_ERRORS=0
WARNINGS=0
CHECKS_PASSED=0

# Function to print colored output
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] ${INFO_MARK} $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ${WARNING_MARK} WARNING: $1${NC}"
    ((WARNINGS++))
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ${CROSS_MARK} ERROR: $1${NC}"
    ((CRITICAL_ERRORS++))
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ${CHECK_MARK} $1${NC}"
    ((CHECKS_PASSED++))
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Load environment variables if .env exists
load_env() {
    local env_file="$(dirname "$0")/../.env"
    if [ -f "$env_file" ]; then
        info "Loading configuration from $env_file"
        set -o allexport
        source "$env_file"
        set +o allexport
    else
        info "No .env file found, using command line arguments only"
    fi
}

# Check requirements
check_requirements() {
    info "Checking local requirements..."
    
    if ! command_exists ssh; then
        error "SSH client not found. Please install openssh-client"
        return 1
    fi
    
    if ! command_exists curl; then
        error "curl not found. Please install curl"
        return 1
    fi
    
    success "Local requirements satisfied"
}

# Show usage
show_usage() {
    echo "Usage: $0 [server-ip] [ssh-key-path]"
    echo ""
    echo "Arguments:"
    echo "  server-ip     IP address or hostname of the server (optional if SERVER_IP is set in .env)"
    echo "  ssh-key-path  Path to SSH private key (optional if SSH_KEY_PATH is set in .env)"
    echo ""
    echo "Environment variables (can be set in deployment/.env):"
    echo "  SERVER_IP       Server IP or hostname"
    echo "  SERVER_HOST     Public hostname for health checks"
    echo "  SSH_KEY_PATH    Path to SSH private key"
    echo ""
    echo "Examples:"
    echo "  $0 1.2.3.4 ~/.ssh/id_rsa"
    echo "  $0  # Uses SERVER_IP and SSH_KEY_PATH from .env"
}

# Parse arguments and set defaults
parse_arguments() {
    # Load environment first
    load_env
    
    # Override with command line arguments if provided
    if [ $# -gt 0 ]; then
        SERVER_IP="$1"
    fi
    
    if [ $# -gt 1 ]; then
        SSH_KEY_PATH="$2"
    fi
    
    # Validate required parameters
    if [ -z "$SERVER_IP" ]; then
        error "Server IP not specified. Use command line argument or set SERVER_IP in .env"
        show_usage
        exit 1
    fi
    
    if [ -z "$SSH_KEY_PATH" ]; then
        error "SSH key path not specified. Use command line argument or set SSH_KEY_PATH in .env"
        show_usage
        exit 1
    fi
    
    # Expand tilde in SSH key path
    SSH_KEY_PATH="${SSH_KEY_PATH/#\~/$HOME}"
    
    # Check if SSH key exists
    if [ ! -f "$SSH_KEY_PATH" ]; then
        error "SSH key not found at: $SSH_KEY_PATH"
        exit 1
    fi
    
    # Set default public hostname if not specified
    if [ -z "$SERVER_HOST" ]; then
        SERVER_HOST="$SERVER_IP"
    fi
    
    info "Configuration:"
    info "  Server IP: $SERVER_IP"
    info "  Server Host: $SERVER_HOST"
    info "  SSH Key: $SSH_KEY_PATH"
}

# SSH options
get_ssh_opts() {
    echo "-i $SSH_KEY_PATH -o ConnectTimeout=10 -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
}

# Test SSH connectivity
check_ssh_connectivity() {
    info "Checking SSH connectivity to $SERVER_IP..."
    
    local ssh_opts=$(get_ssh_opts)
    
    if ssh $ssh_opts "$LETSORDER_USER@$SERVER_IP" 'echo "SSH connection successful"' >/dev/null 2>&1; then
        success "SSH connection to $SERVER_IP working"
        return 0
    else
        error "Cannot connect to $SERVER_IP via SSH"
        return 1
    fi
}

# Check system services
check_system_services() {
    info "Checking system services..."
    
    local ssh_opts=$(get_ssh_opts)
    
    # Check letsorder service
    if ssh $ssh_opts "$LETSORDER_USER@$SERVER_IP" 'sudo systemctl is-active letsorder' >/dev/null 2>&1; then
        success "LetsOrder service is running"
    else
        error "LetsOrder service is not running"
        # Get more details
        ssh $ssh_opts "$LETSORDER_USER@$SERVER_IP" 'sudo systemctl status letsorder --no-pager' || true
    fi
    
    # Check nginx service
    if ssh $ssh_opts "$LETSORDER_USER@$SERVER_IP" 'sudo systemctl is-active nginx' >/dev/null 2>&1; then
        success "Nginx service is running"
    else
        error "Nginx service is not running"
    fi
    
    # Check if services are enabled
    if ssh $ssh_opts "$LETSORDER_USER@$SERVER_IP" 'sudo systemctl is-enabled letsorder' >/dev/null 2>&1; then
        success "LetsOrder service is enabled"
    else
        warn "LetsOrder service is not enabled for auto-start"
    fi
    
    if ssh $ssh_opts "$LETSORDER_USER@$SERVER_IP" 'sudo systemctl is-enabled nginx' >/dev/null 2>&1; then
        success "Nginx service is enabled"
    else
        warn "Nginx service is not enabled for auto-start"
    fi
}

# Check application health
check_application_health() {
    info "Checking application health..."
    
    local ssh_opts=$(get_ssh_opts)
    
    # Check if health endpoint responds locally on server
    local health_check_cmd="curl -s -f http://localhost:8080$HEALTH_ENDPOINT"
    
    if ssh $ssh_opts "$LETSORDER_USER@$SERVER_IP" "$health_check_cmd" >/dev/null 2>&1; then
        success "Health endpoint responding locally"
    else
        error "Health endpoint not responding locally"
        # Try to get more details
        ssh $ssh_opts "$LETSORDER_USER@$SERVER_IP" "curl -v http://localhost:8080$HEALTH_ENDPOINT" || true
    fi
    
    # Check database file exists and is accessible
    if ssh $ssh_opts "$LETSORDER_USER@$SERVER_IP" "test -f $LETSORDER_DIR/data/letsorder.db"; then
        success "Database file exists"
        
        # Check database permissions
        local db_perms=$(ssh $ssh_opts "$LETSORDER_USER@$SERVER_IP" "ls -la $LETSORDER_DIR/data/letsorder.db | awk '{print \$1, \$3, \$4}'")
        info "Database permissions: $db_perms"
    else
        error "Database file not found at $LETSORDER_DIR/data/letsorder.db"
    fi
    
    # Check service uptime
    local uptime=$(ssh $ssh_opts "$LETSORDER_USER@$SERVER_IP" "sudo systemctl show letsorder --property=ActiveEnterTimestamp | cut -d= -f2")
    if [ -n "$uptime" ] && [ "$uptime" != "n/a" ]; then
        info "Service started at: $uptime"
    else
        warn "Cannot determine service start time"
    fi
}

# Check network connectivity
check_network_connectivity() {
    info "Checking network connectivity..."
    
    # Check public health endpoint
    local public_url="http://$SERVER_HOST$HEALTH_ENDPOINT"
    
    if curl -s -f --max-time 10 "$public_url" >/dev/null 2>&1; then
        success "Public health endpoint accessible at $public_url"
    else
        # Try HTTPS if HTTP fails
        local https_url="https://$SERVER_HOST$HEALTH_ENDPOINT"
        if curl -s -f --max-time 10 "$https_url" >/dev/null 2>&1; then
            success "Public health endpoint accessible at $https_url"
        else
            error "Public health endpoint not accessible at $public_url or $https_url"
        fi
    fi
    
    # Check DNS resolution
    if nslookup "$SERVER_HOST" >/dev/null 2>&1; then
        success "DNS resolution working for $SERVER_HOST"
    else
        warn "DNS resolution issues for $SERVER_HOST"
    fi
    
    # Check SSL certificate if HTTPS is available
    if command_exists openssl; then
        local cert_info=$(echo | openssl s_client -servername "$SERVER_HOST" -connect "$SERVER_HOST:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
        if [ $? -eq 0 ]; then
            success "SSL certificate is valid"
            info "Certificate dates: $cert_info"
        else
            info "No SSL certificate or HTTPS not configured"
        fi
    fi
}

# Check resource usage
check_resource_usage() {
    info "Checking resource usage..."
    
    local ssh_opts=$(get_ssh_opts)
    
    # Check memory usage
    local memory_info=$(ssh $ssh_opts "$LETSORDER_USER@$SERVER_IP" "free -h | grep Mem")
    info "Memory usage: $memory_info"
    
    # Check disk usage
    local disk_info=$(ssh $ssh_opts "$LETSORDER_USER@$SERVER_IP" "df -h $LETSORDER_DIR | tail -n1")
    info "Disk usage: $disk_info"
    
    # Check recent errors in logs
    local error_count=$(ssh $ssh_opts "$LETSORDER_USER@$SERVER_IP" "sudo journalctl -u letsorder --since '1 hour ago' | grep -i error | wc -l")
    if [ "$error_count" -eq 0 ]; then
        success "No recent errors in service logs"
    else
        warn "Found $error_count error(s) in logs from the last hour"
    fi
}

# Print summary
print_summary() {
    echo ""
    echo "=================================================="
    echo "           STATUS CHECK SUMMARY"
    echo "=================================================="
    echo -e "${GREEN}Checks passed: $CHECKS_PASSED${NC}"
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
    echo -e "${RED}Critical errors: $CRITICAL_ERRORS${NC}"
    echo "=================================================="
    
    if [ $CRITICAL_ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}${CHECK_MARK} All systems operational${NC}"
        return 0
    elif [ $CRITICAL_ERRORS -eq 0 ]; then
        echo -e "${YELLOW}${WARNING_MARK} System operational with warnings${NC}"
        return 1
    else
        echo -e "${RED}${CROSS_MARK} Critical issues detected${NC}"
        return 2
    fi
}

# Main function
main() {
    echo "=================================================="
    echo "      LetsOrder Production Status Check"
    echo "=================================================="
    
    # Handle help
    if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        show_usage
        exit 0
    fi
    
    # Check requirements
    check_requirements || exit 1
    
    # Parse arguments
    parse_arguments "$@"
    
    # Run checks
    echo ""
    check_ssh_connectivity || exit 2
    echo ""
    check_system_services
    echo ""
    check_application_health
    echo ""
    check_network_connectivity
    echo ""
    check_resource_usage
    echo ""
    
    # Print summary and exit with appropriate code
    print_summary
    exit $?
}

# Run main function
main "$@"