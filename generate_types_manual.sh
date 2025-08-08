#!/bin/bash

# Generate types manually by running the backend type generation
cd backend
SQLX_OFFLINE=true timeout 60 cargo run --bin generate_types || echo "Type generation completed or timed out"
cd ..

# Check if types were generated
echo "Checking generated types..."
ls -la adminapp/src/types/api.ts
echo "Content:"
head -20 adminapp/src/types/api.ts