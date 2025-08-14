#!/bin/bash
set -euo pipefail

# Demo Data Reset Script
# Resets demo restaurant data while preserving structure for consistent demo URLs
# Usage: ./reset-demo-data.sh [database_path]

# Configuration
DEMO_USER_EMAIL="demo@letsorder.app"
DEMO_PASSWORD="demo123"
DB_PATH="${1:-/opt/letsorder/data/letsorder.db}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_SCRIPT="$SCRIPT_DIR/demo-reset.sql"
LOG_FILE="${LOG_FILE:-/opt/letsorder/logs/demo-cleanup.log}"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [DEMO-RESET] $1" | tee -a "$LOG_FILE"
}

log "Starting demo data reset..."

# Check if database exists
if [[ ! -f "$DB_PATH" ]]; then
    log "ERROR: Database file not found at $DB_PATH"
    exit 1
fi

# Check if SQL script exists
if [[ ! -f "$SQL_SCRIPT" ]]; then
    log "ERROR: SQL script not found at $SQL_SCRIPT"
    exit 1
fi

# Use Rust binary for demo data reset (preferred method)
if command -v /opt/letsorder/bin/demo_reset >/dev/null 2>&1; then
    log "Using Rust binary for demo data reset..."
    if /opt/letsorder/bin/demo_reset --database-url="sqlite:$DB_PATH" --password="$DEMO_PASSWORD"; then
        log "Demo data reset completed successfully using Rust binary"
    else
        log "ERROR: Demo data reset failed using Rust binary"
        exit 1
    fi
elif [[ -f "$SCRIPT_DIR/../target/release/demo_reset" ]]; then
    # Development environment
    log "Using development Rust binary for demo data reset..."
    if "$SCRIPT_DIR/../target/release/demo_reset" --database-url="sqlite:$DB_PATH" --password="$DEMO_PASSWORD"; then
        log "Demo data reset completed successfully using development Rust binary"
    else
        log "ERROR: Demo data reset failed using development Rust binary"
        exit 1
    fi
else
    # Fallback to SQL script method
    log "Rust binary not found, falling back to SQL script method..."
    
    # Generate password hash - fallback to pre-computed hash
    DEMO_PASSWORD_HASH='$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdN7FwcVBxRhK'
    log "Using fallback password hash for demo user"

    # Create a temporary SQL file with the password hash substituted
    TEMP_SQL=$(mktemp)
    sed "s|PLACEHOLDER_HASH|$DEMO_PASSWORD_HASH|g" "$SQL_SCRIPT" > "$TEMP_SQL"

    # Execute the SQL script
    log "Executing demo data reset SQL script..."
    if sqlite3 "$DB_PATH" < "$TEMP_SQL"; then
        log "Demo data reset completed successfully using SQL fallback"
        
        # Clean up temporary file
        rm -f "$TEMP_SQL"
    else
        log "ERROR: Demo data reset failed using SQL fallback"
        rm -f "$TEMP_SQL"
        exit 1
    fi
fi

# Log demo access information
log "Demo Access Information:"
log "  Restaurant ID: demo-restaurant-123"
log "  Table ID: demo-table-456"
log "  Manager Email: $DEMO_USER_EMAIL"
log "  Manager Password: $DEMO_PASSWORD"
log "  Table Code: DEMO001"
log "  Admin URL: https://a.letsorder.app"
log "  Menu URL: https://m.letsorder.app/restaurant/demo-restaurant-123/table/demo-table-456"

# Verify the demo data was created correctly
log "Verifying demo data..."
RESTAURANT_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM restaurants WHERE id = 'demo-restaurant-123';")
TABLE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tables WHERE id = 'demo-table-456';")
USER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE email = '$DEMO_USER_EMAIL';")
MENU_ITEMS_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM menu_items WHERE section_id IN (SELECT id FROM menu_sections WHERE restaurant_id = 'demo-restaurant-123');")

if [[ "$RESTAURANT_COUNT" -eq 1 && "$TABLE_COUNT" -eq 1 && "$USER_COUNT" -eq 1 && "$MENU_ITEMS_COUNT" -gt 0 ]]; then
    log "Demo data verification successful: Restaurant=$RESTAURANT_COUNT, Table=$TABLE_COUNT, User=$USER_COUNT, MenuItems=$MENU_ITEMS_COUNT"
else
    log "WARNING: Demo data verification failed: Restaurant=$RESTAURANT_COUNT, Table=$TABLE_COUNT, User=$USER_COUNT, MenuItems=$MENU_ITEMS_COUNT"
fi

log "Demo data reset process completed"