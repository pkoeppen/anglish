#!/usr/bin/env bash
set -e
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

./packages/core/scripts/build.sh
./packages/db/scripts/build.sh
./apps/api/scripts/build.sh

if [[ "${1:-}" == "--watch" ]]; then
  exec pnpm exec concurrently \
    -n "core,db,api" \
    -c "yellow,blue,magenta,green,cyan,gray" \
    "chokidar 'packages/core/src/**/*.ts' -c 'cd packages/core && ./scripts/build.sh'" \
    "chokidar 'packages/db/src/**/*.ts' -c 'cd packages/db && ./scripts/build.sh'" \
    "chokidar 'apps/api/src/**/*.ts' -c 'cd apps/api && ./scripts/build.sh'"
fi
