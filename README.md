# 9Router Enhanced

Private compatibility overlay for 9Router with additional quota and balance
collectors, financial formatting, and update-safe startup recovery.

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

## Compatibility

The patch is tested against 9Router `0.5.30`. A different version is accepted
only when every target bundle is byte-compatible with the tested build. An
incompatible update is left untouched and starts as clean upstream 9Router.

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
update-guard behavior.
