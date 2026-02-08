#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

CLONE_TO=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --to)
      CLONE_TO="$2"
      shift 2
      ;;
    *)
      echo "Usage: $0 --to <prod|local>"
      exit 1
      ;;
  esac
done

if [[ "$CLONE_TO" != "prod" && "$CLONE_TO" != "local" ]]; then
  echo "Usage: $0 --to <prod|local>"
  exit 1
fi

set -o allexport
source "$REPO_ROOT/.env"
set +o allexport

if [[ -z "${POSTGRES_URL_LOCAL:-}" ]]; then
  echo "POSTGRES_URL_LOCAL is not set"
  exit 1
fi
if [[ -z "${POSTGRES_URL_PROD:-}" ]]; then
  echo "POSTGRES_URL_PROD is not set"
  exit 1
fi

if [[ "$CLONE_TO" == "prod" ]]; then
  SOURCE_URL="$POSTGRES_URL_LOCAL"
  TARGET_URL="$POSTGRES_URL_PROD"
  echo "Cloning Anglish database to production (local → prod)..."
else
  SOURCE_URL="$POSTGRES_URL_PROD"
  TARGET_URL="$POSTGRES_URL_LOCAL"
  echo "Cloning Anglish database to local (prod → local)..."
fi

dump_file="$(mktemp "/tmp/anglish_dump.XXXXXX")"

echo "Dumping database..."
pg_dump -Fc -d "$SOURCE_URL" -f "$dump_file"

echo "Resetting target database..."
psql -q -v ON_ERROR_STOP=1 "$TARGET_URL" <<SQL
  SET client_min_messages TO WARNING;
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
SQL

echo "Restoring dump to target database..."
pg_restore --clean --if-exists --schema=public --no-owner --no-acl -d "$TARGET_URL" "$dump_file"