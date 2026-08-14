# Overlay port: official 0.5.55

## Upstream

- npm: `9router@0.5.55` (2026-08-14)
- Git tag: `v0.5.55` (`699edac327`)
- 31 commits ahead of `v0.5.50`

## Live machine

Still running **enhanced 0.5.50**. This port is isolated only. Do not `npm i -g 9router@0.5.55` until a cutover is scheduled.

## Overlay

`patches/quota-tracker.patch.js` now fingerprint-selects `official-0.5.55` via

```text
../static/chunks/app/(dashboard)/dashboard/quota/page-b571eafb19552ce1.js
```

Unknown fingerprints no longer fall back to `official-0.5.50`. Apply/rollback refuse them.

Preserved on 0.5.55:

- `qwen-cloud-token-plan` inject (existing Ali connections keep working)
- `alitp-intl` usage features + local meter (`qtpAlibaba`)
- OpenCode Go usage collector (`GET /zen/go/v1/usage`) without replacing official `transports`
- CORS path derivation picks up the new `1321-914afc18e65fc58b.js` chunk

## Validation (isolated)

```text
node tests/quota-tracker-0555.test.js          ok
node tests/quota-tracker.test.js               ok
node tests/quota-tracker-integration.test.js   ok
node tests/alibaba-token-plan.test.js          ok
node tests/cors-preflight.test.js              ok
```

The 0.5.55 isolation test covers apply, idempotent re-apply, rollback, and collector/catalog markers against `patches/quota-tracker-originals/official-0.5.55`.

## Still needed before live cutover

- Snapshot `~/.9router/db/backups/pre-cutover-0.5.50-to-0.5.55-*`
- Decide whether to port the Antigravity tool-loop breaker (absent from official 0.5.55)
- Install official (or enhanced) 0.5.55, then `install.sh`
- Hard-refresh the dashboard
