#!/usr/bin/env bash
# Build the site. `scripts/build.sh` writes public/; `scripts/build.sh preview` writes .preview/ with a noindex header.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if [ "${1:-}" = "preview" ]; then
  hugo --gc --minify --cleanDestinationDir --destination .preview
  printf '/*\n  X-Robots-Tag: noindex, nofollow\n' >> .preview/_headers
else
  hugo --gc --minify --cleanDestinationDir --destination public
fi
