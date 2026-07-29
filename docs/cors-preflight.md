# CORS Preflight Patch

Fixes `Failed to fetch` from browser/Electron AI clients (ONLYOFFICE AI
plugin, VS Code, Cursor, any `fetch()`-based OpenAI-compatible client) when
calling 9Router over Tailscale or another non-loopback address.

## Root cause

9Router's Next.js middleware treats any request whose peer/host/origin is
not `localhost` / `127.0.0.1` / `::1` as remote, and requires a valid API
key (`Authorization: Bearer …`, `x-api-key`, or `x-goog-api-key`) even for
the `OPTIONS` method.

Per the Fetch/CORS spec, browsers issue an `OPTIONS` preflight ahead of the
real `POST /v1/chat/completions` and never attach `Authorization` to that
preflight. So the preflight itself gets `401 {"error":"API key required for
remote API access"}`, and the browser aborts the whole request before the
real `POST` — carrying the API key — is ever sent. The client-side symptom
is a generic `Failed to fetch` with no further detail.

## Fix

`app/custom-server.js` already wraps `http.createServer` (to derive the real
client IP from the raw TCP socket for rate limiting). This patch extends
that same wrapper, ahead of Next.js and the auth middleware:

1. **OPTIONS short-circuit** — any `OPTIONS` request gets `204 No Content`
   plus CORS headers immediately, with no auth check at all.
2. **CORS headers on every response** — `res.writeHead` is wrapped so
   `Access-Control-Allow-Origin: *` (and the other CORS headers) are present
   on every response, including `401`/`403` from the auth middleware. Without
   this, an auth failure on the real request would still look like a network
   error to the browser instead of a readable HTTP error.

The IP-derivation logic in `custom-server.js` is untouched and still runs
for every non-OPTIONS request.

## Compatibility

Unlike `quota-tracker.patch.js`, this patch is **not** hash-pinned to a
specific 9Router version. `app/custom-server.js` is a small, stable file
that has been byte-identical across at least 0.5.35–0.5.40. The patcher
instead verifies two anchor strings are present (`const http =
require("http");` and `const wrapped = (req, res) => {`) before touching the
file, and refuses to patch — leaving the file untouched — if the upstream
shape has changed enough that those anchors are missing.

## Commands

```bash
node ~/.9router/cors-preflight.patch.js --check
node ~/.9router/cors-preflight.patch.js --apply
node ~/.9router/cors-preflight.patch.js --rollback
node tests/cors-preflight.test.js
```

The original `custom-server.js` is backed up once, on first apply, to
`~/.9router/cors-preflight-originals/custom-server.js` and restored verbatim
by `--rollback`.

## Verification (manual, against the live 100.115.118.6:20128 instance)

```bash
# Preflight from a Tailscale-shaped request must be 204, not 401.
curl -sS -D - -X OPTIONS -o /dev/null http://127.0.0.1:20128/v1/chat/completions \
  -H "x-9r-real-ip: 100.115.118.6" -H "Origin: http://100.115.118.6:20128"

# Normal auth still enforced on the real method.
curl -sS -D - -X POST http://127.0.0.1:20128/v1/chat/completions \
  -H "Authorization: Bearer <key>" -H "Content-Type: application/json" \
  -d '{"model":"...","messages":[{"role":"user","content":"hi"}]}'
```

Expected: `OPTIONS` → `204` with `Access-Control-Allow-Origin: *`; `POST`
without/with a bad key still returns `401`/`403` (auth is not bypassed),
carrying the same CORS headers so the browser can read the error instead of
reporting `Failed to fetch`.
