#!/usr/bin/env bash
set -e
PACKAGE_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$PACKAGE_DIR"

if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' RESET=''
fi

rm tsconfig.tsbuildinfo
rm -rf ./dist/

echo -ne "Building ${YELLOW}@anglish/api${RESET}... "
tsc -b > /dev/null && \
esbuild src/server.ts \
  --bundle \
  --format=esm \
  --platform=node \
  --packages=external \
  --log-level=warning \
  --outfile=dist/server.js > /dev/null && \
echo -e "${GREEN}Done${RESET}" || { echo -e "${RED}Failed${RESET}"; exit 1; }