#!/usr/bin/env bash
set -euo pipefail

# Read everything from stdin
input="$(cat || true)"

# If nothing received, exit quietly
[ -z "$input" ] && exit 0

# If jq is installed and input is JSON, extract message/assistant/notification
if command -v jq >/dev/null 2>&1 && echo "$input" | jq empty >/dev/null 2>&1; then
  msg="$(echo "$input" | jq -r '.assistant // .message // .notification // "Task update"')"
else
  # Not JSON — just speak the raw text
  msg="$input"
fi

# Speak it aloud on macOS
say "$msg" || true
