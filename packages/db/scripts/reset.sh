#!/bin/bash

set -e

# Export password for psql
export PGPASSWORD="$POSTGRES_PASSWORD"

echo "Resetting database: $POSTGRES_DB"

echo "Terminating existing connections..."
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres <<EOF
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();
EOF

echo "Dropping database..."
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres <<EOF
DROP DATABASE IF EXISTS "$POSTGRES_DB";
EOF

echo "Creating database..."
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres <<EOF
CREATE DATABASE "$POSTGRES_DB";
EOF

# Run migrations
echo "Running migrations..."
cd "$(dirname "$0")/.."
pnpm db:migrate
