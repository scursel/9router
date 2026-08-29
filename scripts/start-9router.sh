#!/bin/bash
set -uo pipefail

NODE_BIN="$HOME/.hermes/node/bin"
PACKAGE_ROOT_STATE="$HOME/.9router/9router-package-root"
if [[ -n "${NINE_ROUTER_PACKAGE_ROOT:-}" ]]; then
  APP_ROOT="$NINE_ROUTER_PACKAGE_ROOT"
elif [[ -f "$PACKAGE_ROOT_STATE" ]]; then
  APP_ROOT="$(cat "$PACKAGE_ROOT_STATE")"
else
  APP_ROOT="$HOME/.hermes/node/lib/node_modules/9router"
fi
PATCH="$HOME/.9router/quota-tracker.patch.js"
CORS_PATCH="$HOME/.9router/cors-preflight.patch.js"
TOOL_LOOP_PATCH="$HOME/.9router/antigravity-tool-loop-breaker.patch"
WAN_IMAGE_PATCH="$HOME/.9router/wan-image.patch.js"
NVIDIA_EOL_PATCH="$HOME/.9router/remove-nvidia-eol-models.patch.js"
DB="$HOME/.9router/db/data.sqlite"
BACKUP_ROOT="$HOME/.9router/db/backups"
VERSION_STATE="$HOME/.9router/quota-tracker-version"
STATUS_FILE="$HOME/.9router/quota-tracker-startup.status"
QUARANTINE_FILE="$HOME/.9router/quota-tracker-quarantine"
export PATH="$NODE_BIN:$PATH"

CURRENT_VERSION="$(node -p "require('$APP_ROOT/package.json').version" 2>/dev/null || printf 'unknown')"
LAST_VERSION="$(cat "$VERSION_STATE" 2>/dev/null || true)"

write_status() {
  local state="$1"
  local temporary="${STATUS_FILE}.$$"
  printf '%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$CURRENT_VERSION" "$state" >"$temporary"
  chmod 600 "$temporary"
  mv "$temporary" "$STATUS_FILE"
}

backup_on_version_change() {
  if [[ "$CURRENT_VERSION" == "$LAST_VERSION" ]]; then
    return
  fi

  local stamp backup_dir
  stamp="$(date -u +%Y%m%d-%H%M%S)"
  backup_dir="$BACKUP_ROOT/pre-update-${LAST_VERSION:-baseline}-to-${CURRENT_VERSION}-${stamp}"
  mkdir -p "$backup_dir"
  chmod 700 "$backup_dir"
  if [[ -f "$DB" ]]; then
    sqlite3 "$DB" ".backup '$backup_dir/data.sqlite'"
  fi
  cp "$APP_ROOT/package.json" "$backup_dir/package.json"
  cp "$PATCH" "$HOME/.9router/quota-tracker.test.js" "$0" "$backup_dir/"
  [[ -f "$CORS_PATCH" ]] && cp "$CORS_PATCH" "$backup_dir/"
  [[ -f "$TOOL_LOOP_PATCH" ]] && cp "$TOOL_LOOP_PATCH" "$backup_dir/"
  chmod 600 "$backup_dir"/*
  printf '%s\n' "$CURRENT_VERSION" >"${VERSION_STATE}.$$"
  chmod 600 "${VERSION_STATE}.$$"
  mv "${VERSION_STATE}.$$" "$VERSION_STATE"
  rm -f "$QUARANTINE_FILE"
  echo "[quota-tracker] version change backup: $backup_dir"
}

backup_on_version_change

PATCH_ACTIVE=0
QUARANTINED_VERSION="$(cat "$QUARANTINE_FILE" 2>/dev/null || true)"
if [[ "$QUARANTINED_VERSION" == "$CURRENT_VERSION" ]]; then
  echo "[quota-tracker] patch quarantined for 9Router $CURRENT_VERSION; starting upstream clean"
  write_status "clean-quarantined"
elif PATCH_OUTPUT="$(node "$PATCH" --apply 2>&1)"; then
  echo "$PATCH_OUTPUT"
  if node "$PATCH" --check 2>/dev/null | grep -q '"usagePatched": true'; then
    PATCH_ACTIVE=1
    write_status "patched"
  else
    write_status "clean"
  fi
else
  echo "[quota-tracker] compatibility check failed; starting upstream clean" >&2
  echo "$PATCH_OUTPUT" >&2
  if ! SANITIZE_OUTPUT="$(node "$PATCH" --sanitize 2>&1)"; then
    echo "[quota-tracker] unsafe patch residue could not be sanitized" >&2
    echo "$SANITIZE_OUTPUT" >&2
    write_status "blocked-unsafe-residue"
    exit 1
  fi
  echo "$SANITIZE_OUTPUT"
  write_status "clean-incompatible"
fi

if [[ -f "$CORS_PATCH" ]]; then
  if CORS_OUTPUT="$(node "$CORS_PATCH" --apply 2>&1)"; then
    echo "$CORS_OUTPUT"
  else
    echo "[cors-preflight] apply failed; custom-server.js left untouched, continuing without it" >&2
    echo "$CORS_OUTPUT" >&2
  fi
fi

# Runs after the quota tracker: its bundle hashes are pinned to the
# quota-patched chunks. Fail-open, the EOL models are cosmetic.
if [[ -f "$NVIDIA_EOL_PATCH" ]]; then
  if NVIDIA_OUTPUT="$(node "$NVIDIA_EOL_PATCH" --apply 2>&1)"; then
    echo "$NVIDIA_OUTPUT"
  else
    echo "[nvidia-eol] apply failed; catalog left untouched, continuing without it" >&2
    echo "$NVIDIA_OUTPUT" >&2
  fi
fi

if [[ -f "$WAN_IMAGE_PATCH" ]]; then
  if WAN_OUTPUT="$(node "$WAN_IMAGE_PATCH" --apply 2>&1)"; then
    echo "$WAN_OUTPUT"
  else
    echo "[wan-image] adapter patch failed; refusing to start an unpatched router" >&2
    echo "$WAN_OUTPUT" >&2
    write_status "wan-image-patch-failed"
    exit 1
  fi
fi

9router --no-browser --tray --port 20128 --host 0.0.0.0 2>&1 &
ROUTER_PID=$!

stop_router() {
  trap - TERM INT
  if kill -0 "$ROUTER_PID" 2>/dev/null; then
    kill -TERM "$ROUTER_PID" 2>/dev/null || true
  fi
  wait "$ROUTER_PID" 2>/dev/null || true
  exit 0
}
trap stop_router TERM INT

HEALTHY=0
for _ in $(seq 1 60); do
  if ! kill -0 "$ROUTER_PID" 2>/dev/null; then
    break
  fi
  if curl -fsS --max-time 2 http://127.0.0.1:20128/api/health >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  sleep 1
done

if [[ "$HEALTHY" == 1 ]]; then
  echo "[quota-tracker] startup health check passed"
  wait "$ROUTER_PID"
  exit $?
fi

echo "[quota-tracker] startup health check failed" >&2
if kill -0 "$ROUTER_PID" 2>/dev/null; then
  kill -TERM "$ROUTER_PID" 2>/dev/null || true
fi
wait "$ROUTER_PID" 2>/dev/null || true

if [[ "$PATCH_ACTIVE" == 1 ]] && node "$PATCH" --rollback; then
  printf '%s\n' "$CURRENT_VERSION" >"$QUARANTINE_FILE"
  chmod 600 "$QUARANTINE_FILE"
  write_status "clean-auto-rollback"
  echo "[quota-tracker] patch rolled back and quarantined; restarting upstream clean" >&2
  exec 9router --no-browser --tray --port 20128 --host 0.0.0.0 2>&1
fi

write_status "startup-failed"
exit 1
