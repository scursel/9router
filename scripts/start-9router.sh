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
export PATH="$NODE_BIN:$PATH"

# The Enhanced is a source branch of upstream (docs/branch-model.md): the
# installed package already contains every delta compiled in. Nothing is
# patched at startup any more; the guard is now "the package builds and
# boots", verified by the health check below.
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
  echo "[9router] startup health check passed"
  wait "$ROUTER_PID"
  exit $?
fi

echo "[9router] startup health check failed" >&2
if kill -0 "$ROUTER_PID" 2>/dev/null; then
  kill -TERM "$ROUTER_PID" 2>/dev/null || true
fi
wait "$ROUTER_PID" 2>/dev/null || true
exit 1
