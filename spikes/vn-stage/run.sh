#!/usr/bin/env bash
# Runs the stage spike on Gentle Shell's bundled Pi, in a throwaway Pi home.
# Usage: spikes/vn-stage/run.sh [pet-id]   (a pet from the familiard gallery)
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pi_bin="$(npm root -g)/gentle-pi/node_modules/.bin/pi"
home="$(mktemp -d)"
trap 'rm -rf "$home"' EXIT
env PI_CODING_AGENT_DIR="$home" COLORTERM=truecolor AMADEUS_STAGE_PET="${1:-kurisu}" \
  "$pi_bin" --no-session --no-extensions -e "$here/index.ts" -e "$here/fake-provider.ts" --provider fake --model scripted
