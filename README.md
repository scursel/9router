# 9Router Enhanced

Private compatibility overlay for 9Router with additional quota and balance
collectors, financial formatting, update-safe startup recovery, and an
Antigravity tool-loop circuit breaker for agent clients such as Hermes.

This repository does not contain the 9Router npm package, compiled upstream
bundles, account databases, API keys, OAuth tokens, or browser cookies.

## Added providers

- OpenRouter credit balance and usage.
- DeepSeek available, promotional, and topped-up balances.
- CommandCode monthly credits plus 5-hour and 7-day windows.
- xAI/Grok prepaid balance and existing OAuth quota.
- Xiaomi MiMo available, paid, and granted balances.
- ClinePass 5-hour, 7-day, and 30-day windows.

USD values are rendered as currency. Renewal dates and rolling reset times are
preserved when the provider exposes them.

## Antigravity tool-loop breaker

The source patch at
[`patches/antigravity-tool-loop-breaker.patch`](patches/antigravity-tool-loop-breaker.patch)
detects three tool calls with the same function name and canonically equivalent
JSON arguments across trailing turns or parallel response batches. It caps a
single Antigravity response at three identical calls; on the next turn it
removes tool declarations and appends a final-text instruction beside the
latest `functionResponse`.

This prevents Gemini from repeating a no-progress tool call indefinitely while
leaving normal tool-call/result/final-answer flows unchanged. See
[`docs/tool-loop-breaker.md`](docs/tool-loop-breaker.md) for reproduction,
build, deployment, and rollback details.

## Compatibility

The patch is tested against both the official and enhanced 9Router `0.5.35`
builds. A different version is accepted only when every target bundle is
byte-compatible with a tested build. An incompatible update is left untouched
and starts as clean upstream 9Router.

Upstream `0.5.35` improved the native Grok collector with subscription-access
and monthly-included-credit parsing. This overlay preserves that implementation
and adds USD normalization. The other balance collectors, currency rendering,
update guard, and Antigravity loop breaker are not present upstream.

The startup supervisor:

1. Creates a database and configuration backup when the 9Router version changes.
2. Applies only verified bundle transformations using atomic writes.
3. Sanitizes exact known patch residue after partial or incompatible updates.
4. Performs a 60-second health check.
5. Rolls back and quarantines the patch for that version when startup fails.

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
node patches/quota-tracker.patch.js --check
systemctl --user status 9router.service
curl -fsS http://127.0.0.1:20128/api/health
```

See [operations.md](docs/operations.md) for rollback, sanitization, backups, and
update-guard behavior. The audited deployment details are recorded in
[update-0.5.35.md](docs/update-0.5.35.md).
