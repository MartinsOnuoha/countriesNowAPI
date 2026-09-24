#!/usr/bin/env bash
# Build the serving artifact into the slug. Heroku has no baked Docker layer,
# so the compile step has to produce countriesnow.sqlite the same way the
# release workflow does — pull → resolve → publish.
set -euo pipefail

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found — heroku-prebuild must install it first" >&2
  exit 1
fi

# Keep the slug small. Full allCountries builds belong in the release image,
# not a classic Heroku compile (15-minute timeout, 500 MB slug limit).
export GEONAMES_TIER="${GEONAMES_TIER:-cities15000}"

echo "› Building serving artifact (GEONAMES_TIER=$GEONAMES_TIER)"
bun run harness:pull
bun run harness:resolve --offline
bun run harness:publish

version="$(bun run --silent harness dataset-version)"
src="data/artifacts/countriesnow-${version}.sqlite"
dst="data/artifacts/countriesnow.sqlite"

if [[ ! -f "$src" ]]; then
  echo "expected artifact missing: $src" >&2
  ls -la data/artifacts/ >&2 || true
  exit 1
fi

cp "$src" "$dst"
# Drop versioned copies so the slug only carries one ~36 MB file.
find data/artifacts -type f ! -name 'countriesnow.sqlite' -delete

echo "› Artifact ready: $dst ($(wc -c < "$dst") bytes, dataset $version)"
