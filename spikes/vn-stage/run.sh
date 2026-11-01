#!/usr/bin/env bash
# Runs the stage spike on Gentle Shell's bundled Pi, in a throwaway Pi home.
# Usage: spikes/vn-stage/run.sh [pet-id]   (a pet from the familiard gallery)
# AMADEUS_STAGE_RENDER=kitty|halfblock overrides the renderer.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pi_bin="$(npm root -g)/gentle-pi/node_modules/.bin/pi"
home="$(mktemp -d)"
restore=""
if [ -n "${TMUX:-}" ] && [ "$(tmux show -pv allow-passthrough 2>/dev/null)" != "on" ]; then
  # Images reach the outer terminal only through passthrough. Only this pane, and only while running.
  tmux set -p allow-passthrough on
  restore="tmux set -pu allow-passthrough"
fi
trap 'rm -rf "$home"; $restore' EXIT
env PI_CODING_AGENT_DIR="$home" COLORTERM=truecolor AMADEUS_STAGE_PET="${1:-kurisu}" \
  "$pi_bin" --no-session --no-extensions -e "$here/index.ts" -e "$here/fake-provider.ts" --provider fake --model scripted
