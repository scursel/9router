#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="${NINE_ROUTER_PACKAGE_ROOT:-$HOME/.hermes/node/lib/node_modules/9router}"
PATCH_DIR="$HOME/.9router"
SCRIPT_DIR="$HOME/.hermes/profiles/zen/scripts"
SYSTEMD_DIR="$HOME/.config/systemd/user"

if [[ ! -f "$PACKAGE_ROOT/package.json" ]]; then
  echo "9Router package not found at $PACKAGE_ROOT" >&2
  exit 1
fi

install -d -m 755 "$PATCH_DIR" "$SCRIPT_DIR" "$SYSTEMD_DIR"
printf '%s\n' "$PACKAGE_ROOT" >"$PATCH_DIR/9router-package-root"
chmod 600 "$PATCH_DIR/9router-package-root"
install -m 755 "$ROOT/patches/quota-tracker.patch.js" "$PATCH_DIR/quota-tracker.patch.js"
install -m 755 "$ROOT/tests/quota-tracker.test.js" "$PATCH_DIR/quota-tracker.test.js"
install -m 644 "$ROOT/docs/operations.md" "$PATCH_DIR/quota-tracker.README.md"
install -m 755 "$ROOT/patches/cors-preflight.patch.js" "$PATCH_DIR/cors-preflight.patch.js"
install -m 644 "$ROOT/docs/cors-preflight.md" "$PATCH_DIR/cors-preflight.README.md"
install -m 644 "$ROOT/patches/antigravity-tool-loop-breaker.patch" "$PATCH_DIR/antigravity-tool-loop-breaker.patch"
install -m 644 "$ROOT/patches/antigravity-tool-loop-breaker-0.5.50.patch" "$PATCH_DIR/antigravity-tool-loop-breaker-0.5.50.patch"
install -m 755 "$ROOT/scripts/start-9router.sh" "$SCRIPT_DIR/start-9router.sh"
install -m 644 "$ROOT/systemd/9router.service" "$SYSTEMD_DIR/9router.service"

NINE_ROUTER_PACKAGE_ROOT="$PACKAGE_ROOT" node "$PATCH_DIR/quota-tracker.test.js"
NINE_ROUTER_PACKAGE_ROOT="$PACKAGE_ROOT" node "$PATCH_DIR/quota-tracker.patch.js" --apply
NINE_ROUTER_PACKAGE_ROOT="$PACKAGE_ROOT" node "$ROOT/tests/cors-preflight.test.js"
NINE_ROUTER_PACKAGE_ROOT="$PACKAGE_ROOT" node "$PATCH_DIR/cors-preflight.patch.js" --apply

systemctl --user daemon-reload
systemctl --user enable --now 9router.service
systemctl --user restart 9router.service

echo "Installed. Check status with: systemctl --user status 9router.service"
