#!/usr/bin/env bash
# Runs the stage on Gentle Shell's bundled Pi, in Amadeus's own Pi home, so /login and /model
# work as in normal Pi and stay saved between runs.
# Usage: spikes/vn-stage/run.sh [pet-id]          (a pet from the familiard gallery)
#        spikes/vn-stage/run.sh --fake [pet-id]   a scripted model, no credentials, throwaway home
# AMADEUS_HOME overrides the Pi home (default ~/.amadeus/agent).
# AMADEUS_STAGE_RENDER=kitty|halfblock overrides the renderer.
# Prints the path of a mood log when it ends: timings and moods only, no text and no keys.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
home="${AMADEUS_HOME:-$HOME/.amadeus/agent}"
model=()
fake=""
throwaway=""
if [ "${1:-}" = "--fake" ]; then
  shift
  throwaway="$(mktemp -d)"
  home="$throwaway"
  fake=1
  model=(--provider amadeus-fake --model scripted)
fi
mkdir -p "$home"
log="$(mktemp --suffix=-stage.jsonl)"
pi_bin="$(npm root -g)/gentle-pi/node_modules/.bin/pi"
restore=""
if [ -n "${TMUX:-}" ] && [ "$(tmux show -pv allow-passthrough 2>/dev/null)" != "on" ]; then
  # Images reach the outer terminal only through passthrough. Only this pane, and only while running.
  tmux set -p allow-passthrough on
  restore="tmux set -pu allow-passthrough"
fi
finish() {
  if [ -n "$throwaway" ]; then rm -rf "$throwaway"; fi
  $restore
  echo "mood log: $log"
}
trap finish EXIT
env PI_CODING_AGENT_DIR="$home" COLORTERM=truecolor AMADEUS_STAGE_PET="${1:-kurisu}" AMADEUS_STAGE_LOG="$log" AMADEUS_STAGE_FAKE="$fake" \
  "$pi_bin" --no-session --no-extensions -e "$here/index.ts" ${model[@]+"${model[@]}"}
