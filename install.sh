#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="${NINE_ROUTER_PACKAGE_ROOT:-$HOME/.hermes/node/lib/node_modules/9router}"
SCRIPT_DIR="$HOME/.hermes/profiles/zen/scripts"
SYSTEMD_DIR="$HOME/.config/systemd/user"

if [[ ! -f "$PACKAGE_ROOT/package.json" ]]; then
  echo "9Router package not found at $PACKAGE_ROOT" >&2
  exit 1
fi

install -d -m 755 "$SCRIPT_DIR" "$SYSTEMD_DIR"
install -m 755 "$ROOT/scripts/start-9router.sh" "$SCRIPT_DIR/start-9router.sh"
install -m 644 "$ROOT/systemd/9router.service" "$SYSTEMD_DIR/9router.service"

systemctl --user daemon-reload
systemctl --user enable --now 9router.service
systemctl --user restart 9router.service

echo "Installed. Check status with: systemctl --user status 9router.service"
