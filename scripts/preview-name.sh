#!/usr/bin/env bash
# The preview name for a pull request: pr-<number>. One rule for the preview and cleanup workflows.
#   scripts/preview-name.sh <pr-number>
set -euo pipefail
printf 'pr-%s' "${1:?pull request number required}"
