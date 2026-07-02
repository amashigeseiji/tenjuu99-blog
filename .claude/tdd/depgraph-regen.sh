#!/bin/bash
# Usage: depgraph-regen.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/depgraph-regen.js"
