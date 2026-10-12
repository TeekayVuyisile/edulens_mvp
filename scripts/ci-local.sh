#!/usr/bin/env bash
# Runs the same steps as .github/workflows/ci.yml, stopping at the first failure.
# Usage (from the repo root, Git Bash on Windows works): bash scripts/ci-local.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
failed=0

step() {
  local dir="$1"; shift
  printf '\n▶ %s: %s\n' "$dir" "$*"
  if (cd "$ROOT/$dir" && "$@"); then
    printf '✔ %s: %s\n' "$dir" "$*"
  else
    printf '✘ %s: %s (exit %s)\n' "$dir" "$*" "$?"
    failed=1
    return 1
  fi
}

step backend npm ci --dry-run --no-audit --no-fund >/dev/null &&
  step backend npm run lint &&
  step backend npm test &&
  step frontend npm ci --dry-run --no-audit --no-fund >/dev/null &&
  step frontend npm run lint &&
  step frontend npm test &&
  step frontend npm run build

if [ "$failed" -eq 0 ]; then
  printf '\nCI steps passed.\n'
else
  printf '\nCI steps FAILED.\n'
  exit 1
fi
