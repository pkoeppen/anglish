#!/bin/bash

set -e

echo "Flushing Redis..."
redis-cli FLUSHALL

echo "Done."