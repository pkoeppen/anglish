#!/bin/bash

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

set -o allexport
source "$REPO_ROOT/.env"
set +o allexport

is_prod=false
if [[ "${1:-}" == "--prod" ]]; then
  is_prod=true
fi

if $is_prod; then
  REDIS_URL="${REDIS_URL_PROD:?REDIS_URL_PROD is not set}"
else
  REDIS_URL="${REDIS_URL_LOCAL:?REDIS_URL_LOCAL is not set}"
fi

if $is_prod; then
  echo "Flushing Redis (production)"
else
  echo "Flushing Redis (local)"
fi

read SCHEME USERNAME PASSWORD HOST PORT < <(
  echo "$REDIS_URL" |
  awk -F'[:/@]' '{print $1, $4, $5, $6, $7}'
)

export REDISCLI_AUTH="$PASSWORD"

redis-cli -h "$HOST" -p "$PORT" FLUSHALL

echo "Done."