#!/usr/bin/env bash
# Runs the stage spike on Gentle Shell's bundled Pi, in a throwaway Pi home.
# Usage: spikes/vn-stage/run.sh [pet-id]   (a pet from the familiard gallery)
#        spikes/vn-stage/run.sh --real [pet-id]   talks to the real model, with the key from .env,
#        and logs mood timing to the file it prints when it ends.
# AMADEUS_STAGE_RENDER=kitty|halfblock overrides the renderer.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
model=(--provider amadeus-fake --model scripted)
log=""
if [ "${1:-}" = "--real" ]; then
  shift
  set -a; . "$here/../../.env"; set +a
  model=(--provider amadeus-go --model deepseek-v4.1-flash)
  log="$(mktemp --suffix=-stage.jsonl)"
fi
pi_bin="$(npm root -g)/gentle-pi/node_modules/.bin/pi"
home="$(mktemp -d)"
restore=""
if [ -n "${TMUX:-}" ] && [ "$(tmux show -pv allow-passthrough 2>/dev/null)" != "on" ]; then
  # Images reach the outer terminal only through passthrough. Only this pane, and only while running.
  tmux set -p allow-passthrough on
  restore="tmux set -pu allow-passthrough"
fi
finish() {
  rm -rf "$home"
  $restore
  if [ -n "$log" ]; then echo "mood log: $log"; fi
}
trap finish EXIT
env PI_CODING_AGENT_DIR="$home" COLORTERM=truecolor AMADEUS_STAGE_PET="${1:-kurisu}" AMADEUS_STAGE_LOG="$log" \
  "$pi_bin" --no-session --no-extensions -e "$here/index.ts" "${model[@]}"
