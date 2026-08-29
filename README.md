# 9Router Enhanced

Private compatibility overlay for 9Router with additional quota/balance
collectors, financial formatting, a CORS preflight fix for browser/Electron
AI clients, an Antigravity tool-loop circuit breaker, and update-safe startup
recovery for all of the above.

This repository does not contain the 9Router npm package, compiled upstream
bundles, account databases, API keys, OAuth tokens, or browser cookies.

## Modifications in this overlay

| # | Modification | What it does | Patch | Docs |
|---|---|---|---|---|
| 1 | **Quota/balance tracker** | Adds USD balance/quota collectors for six providers that upstream 9Router does not track, plus currency formatting in the dashboard. | [`patches/quota-tracker.patch.js`](patches/quota-tracker.patch.js) | [`docs/operations.md`](docs/operations.md) |
| 2 | **Antigravity tool-loop breaker** | Stops Gemini/Antigravity from repeating the same tool call indefinitely (observed up to 18x in one session) by capping identical calls at 3 and forcing a final-text turn. | [`patches/antigravity-tool-loop-breaker.patch`](patches/antigravity-tool-loop-breaker.patch) | [`docs/tool-loop-breaker.md`](docs/tool-loop-breaker.md) |
| 3 | **CORS preflight fix** | Lets browser/Electron OpenAI-compatible clients (ONLYOFFICE AI plugin, VS Code, Cursor, etc.) call 9Router over Tailscale/LAN without `Failed to fetch` on the CORS preflight. | [`patches/cors-preflight.patch.js`](patches/cors-preflight.patch.js) | [`docs/cors-preflight.md`](docs/cors-preflight.md) |
| 4 | **NVIDIA EOL catalog cleanup** | Removes NVIDIA NIM models the live NVIDIA catalog retired (`z-ai/glm-5.2`, `deepseek-ai/deepseek-v4-pro`) and fixes the provider grid dropping a provider whose *name* matches the search term. | [`patches/remove-nvidia-eol-models.patch.js`](patches/remove-nvidia-eol-models.patch.js) | [`docs/update-0.5.59.md`](docs/update-0.5.59.md) |
| 5 | **WAN image adapter** | Registers the Alibaba WAN custom provider in the compiled image-provider map, which upstream keeps closed to known ids. | [`patches/wan-image.patch.js`](patches/wan-image.patch.js) | [`docs/update-0.5.59.md`](docs/update-0.5.59.md) |

Modification 1 patches the compiled bundles of an installed 9Router; it is
hash-pinned per build (see [`docs/update-0.5.59.md`](docs/update-0.5.59.md) /
[`docs/update-0.5.55.md`](docs/update-0.5.55.md) /
[`docs/update-0.5.50.md`](docs/update-0.5.50.md) /
[`docs/update-0.5.45.md`](docs/update-0.5.45.md)). Modification 2 is a source
patch: it is applied to an upstream checkout, rebuilt with Next.js and shipped
as a private CLI tarball, so a routine `npm update` is not a safe upgrade path.
Modification 3 patches the small, stable `app/custom-server.js` wrapper in
place — no rebuild needed. Modifications 4 and 5 patch compiled bundles too:
4 is hash-pinned and must run after 1; 5 is anchor-based.
`scripts/start-9router.sh` reapplies every runtime patch (1, 3, 4, 5) on each
service start (see [Update guard](#update-guard) below).

---

## 1. Quota/balance tracker

Adds USD-denominated quota and balance collectors 9Router does not ship:

- OpenRouter credit balance and usage.
- DeepSeek available, promotional, and topped-up balances.
- CommandCode monthly credits plus 5-hour and 7-day windows.
- xAI/Grok prepaid balance and existing OAuth quota, with a percentage-only
  weekly fallback when xAI omits the numeric credit allotment.
- Xiaomi MiMo available, paid, and granted balances.
- ClinePass 5-hour, 7-day, and 30-day windows.

USD values are rendered as currency. Renewal dates and rolling reset times are
preserved when the provider exposes them.

The patch is **hash-pinned** per 9Router version (official and enhanced
build variants both catalogued). An untested version is left completely
untouched and 9Router starts as clean upstream.

```bash
node ~/.9router/quota-tracker.patch.js --check
node ~/.9router/quota-tracker.patch.js --apply
node ~/.9router/quota-tracker.patch.js --rollback
node ~/.9router/quota-tracker.patch.js --sanitize
node ~/.9router/quota-tracker.test.js
```

Details, provider-by-provider parsing notes, and the Grok OAuth caveat are in
[`docs/operations.md`](docs/operations.md).

## 2. Antigravity tool-loop breaker

Hermes sessions routed through 9Router to Antigravity/Gemini could repeat the
same structured tool call indefinitely even after the client returned an
unchanged or explicitly-blocked result (18 repeats observed in one captured
session). The source patch at
[`patches/antigravity-tool-loop-breaker.patch`](patches/antigravity-tool-loop-breaker.patch):

1. Canonicalizes tool call arguments (JSON key order ignored) to detect
   semantic repeats, not just literal ones.
2. Caps a single Antigravity response at three identical calls, including
   parallel batches with different call counts.
3. On the next turn, strips `tools`/`toolConfig` and injects a final-text
   instruction beside the last `functionResponse`, forcing the model to
   summarize instead of calling again.

Normal tool-call/result/final-answer flows are unaffected; only genuinely
repeated no-progress calls are interrupted. This is a **source** patch — it
is applied to an upstream 9Router checkout, rebuilt with Next.js, and shipped
as a private CLI tarball; see
[`docs/tool-loop-breaker.md`](docs/tool-loop-breaker.md) for the build steps,
regression evidence (before/after streaming traces), and rollback.

For upstream `0.5.50`, use the separately ported source diff
[`patches/antigravity-tool-loop-breaker-0.5.50.patch`](patches/antigravity-tool-loop-breaker-0.5.50.patch).
For `0.5.55`, use
[`patches/antigravity-tool-loop-breaker-0.5.55.patch`](patches/antigravity-tool-loop-breaker-0.5.55.patch);
for `0.5.59`, use
[`patches/antigravity-tool-loop-breaker-0.5.59.patch`](patches/antigravity-tool-loop-breaker-0.5.59.patch).
Install the rebuilt enhanced tarball — official npm does not include the breaker.
Each diff is re-ported because upstream keeps changing the same translator files.

The `0.5.59` rebuild also carries
[`patches/antigravity-quota-model-filter-0.5.59.patch`](patches/antigravity-quota-model-filter-0.5.59.patch):
it keeps the official Antigravity quota collector (auth, fetch, 401/403,
rendering) and only widens its model selection with the ids the API recommends
dynamically, drops deprecated aliases, and treats an omitted
`remainingFraction` as exhausted instead of full.

## 3. CORS preflight fix

Browser/Electron clients calling 9Router over Tailscale or any non-loopback
address (ONLYOFFICE AI plugin, VS Code, Cursor, any `fetch()`-based
OpenAI-compatible client) got a generic `Failed to fetch`. Root cause: the
browser's CORS preflight `OPTIONS` request never carries an `Authorization`
header per spec, and 9Router's auth middleware rejected unauthenticated
`OPTIONS` from non-loopback origins with `401` — so the browser aborted
before the real `POST` (with the API key) was ever sent.

[`patches/cors-preflight.patch.js`](patches/cors-preflight.patch.js) extends
the existing `app/custom-server.js` HTTP wrapper (the same layer that already
derives the real client IP from the raw socket) to short-circuit `OPTIONS`
with `204` + CORS headers ahead of Next.js/auth, and stamps CORS headers on
every other response so genuine auth failures (401/403) stay readable to the
browser instead of surfacing as an opaque network error.

Unlike the quota tracker, this patch is **not** hash-pinned to a specific
9Router version — `custom-server.js` remains structurally compatible across
0.5.35–0.5.50, so the patcher verifies two anchor strings instead and refuses
to touch the file if the upstream shape changes. The 0.5.50 upstream h2c
downgrade handling is preserved.

```bash
node ~/.9router/cors-preflight.patch.js --check
node ~/.9router/cors-preflight.patch.js --apply
node ~/.9router/cors-preflight.patch.js --rollback
node tests/cors-preflight.test.js
```

Root cause, verification against the live endpoint, and rollback details are
in [`docs/cors-preflight.md`](docs/cors-preflight.md).

---

## Compatibility

The quota tracker is hash-pinned per build and currently catalogues the
official/enhanced `0.5.35`, `0.5.40`, `0.5.45`, `0.5.55` and `0.5.59` builds
plus official `0.5.50`. A different version is accepted only when every target
bundle is byte-compatible with a tested build; an incompatible update is left
untouched and starts as clean upstream 9Router. The CORS preflight fix and the
WAN image adapter use anchor detection instead of hashes and tolerate any
9Router version whose target file still matches the known shape.

The NVIDIA EOL cleanup is hash-pinned per version (`0.5.55`, `0.5.59`) and its
hashes are taken **after** the quota tracker, so it must always run last among
the bundle patchers.

Upstream `0.5.40` retains the native Grok subscription collector introduced in
`0.5.35`. This overlay preserves it and adds USD normalization plus the weekly
percentage fallback. The other balance collectors, currency rendering, update
guard, Antigravity loop breaker, and CORS preflight fix are not present
upstream.

## Update guard

`scripts/start-9router.sh` (installed as the systemd `ExecStart`) runs on
every service start:

1. Detects a 9Router version change and backs up the database, patch files,
   launcher, and installed package metadata.
2. Applies the quota-tracker patch only when all known bundles are
   byte-compatible with a tested version; sanitizes exact known patch residue
   after an incompatible or partial update; starts unpatched upstream 9Router
   when the new build is incompatible.
3. Applies the CORS preflight patch unconditionally (anchor-based, so it
   tolerates unseen versions) and continues without it — logging a warning —
   if the anchors are missing, then applies the NVIDIA EOL cleanup (fail-open)
   and the WAN image adapter (fatal if its anchor is gone).
4. Waits for `/api/health`; on failure with the quota-tracker patch active,
   rolls it back and quarantines that 9Router version before starting
   upstream clean.

## Install

The default package location is the Hermes-managed global npm directory:

```bash
./install.sh
```

For another installation, provide the package root:

```bash
NINE_ROUTER_PACKAGE_ROOT=/path/to/node_modules/9router ./install.sh
```

The installer never copies databases, credentials, or provider sessions from
this repository. Xiaomi MiMo balance requires a valid console cookie configured
locally as `MIMO_QUOTA_COOKIE` or `providerSpecificData.quotaCookie`.

## Verification

```bash
node tests/quota-tracker.test.js
node tests/quota-tracker-integration.test.js
node tests/alibaba-token-plan.test.js
node tests/cors-preflight.test.js
node tests/quota-tracker-0555.test.js
node tests/quota-tracker-0555-enhanced.test.js
node tests/quota-tracker-0559.test.js
node tests/quota-tracker-0559-enhanced.test.js
node patches/quota-tracker.patch.js --check
node patches/cors-preflight.patch.js --check
node patches/remove-nvidia-eol-models.patch.js --check
node patches/wan-image.patch.js --check
systemctl --user status 9router.service
curl -fsS http://127.0.0.1:20128/api/health
curl -sS -D - -X OPTIONS -o /dev/null http://127.0.0.1:20128/v1/chat/completions
```

See [`docs/operations.md`](docs/operations.md) for quota-tracker rollback,
sanitization, backups, and update-guard behavior, and
[`docs/cors-preflight.md`](docs/cors-preflight.md) for the CORS fix's own
verification and rollback. The audited deployment details for each 9Router
version bump are recorded in
[`docs/update-0.5.40.md`](docs/update-0.5.40.md) and
[`docs/update-0.5.35.md`](docs/update-0.5.35.md).
