#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

set -o allexport
source "$REPO_ROOT/.env"
set +o allexport

is_prod=false
if [[ "${1:-}" == "--prod" ]]; then
  is_prod=true
fi

if $is_prod; then
  POSTGRES_URL="${POSTGRES_URL_PROD:?POSTGRES_URL_PROD is not set}"
else
  POSTGRES_URL="${POSTGRES_URL_LOCAL:?POSTGRES_URL_LOCAL is not set}"
fi

export POSTGRES_URL

if $is_prod; then
  echo "Resetting Anglish database (production)"
else
  echo "Resetting Anglish database (local)"
fi

echo "Dropping schema..."
psql -q -v ON_ERROR_STOP=1 "$POSTGRES_URL" <<SQL
  SET client_min_messages TO WARNING;
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
SQL

echo "Running migrations..."
cd "$REPO_ROOT"
pnpm db:migrate
