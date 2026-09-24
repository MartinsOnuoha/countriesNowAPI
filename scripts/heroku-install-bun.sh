#!/usr/bin/env bash
# Install Bun into the Heroku slug and expose it on PATH for dynos.
set -euo pipefail

curl -fsSL https://bun.sh/install | bash

mkdir -p .profile.d
cat > .profile.d/bun.sh <<'EOF'
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
EOF

# Make bun available to later build scripts in this compile (profile.d is
# sourced on dyno boot, not during slug compile).
# shellcheck disable=SC1091
source .profile.d/bun.sh
bun --version
