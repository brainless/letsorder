#!/bin/bash
set -e

# Create database
rm -f letsorder.db

# Run migrations manually
sqlite3 letsorder.db < migrations/20250131000001_initial_schema.sql
sqlite3 letsorder.db < migrations/20250131000002_manager_invites.sql  
sqlite3 letsorder.db < migrations/20250131000003_add_customer_name_to_orders.sql

echo "Database setup complete"