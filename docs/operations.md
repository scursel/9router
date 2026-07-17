# 9Router Quota Tracker Patch

For the separately built Antigravity tool-loop circuit breaker, see
[`tool-loop-breaker.md`](tool-loop-breaker.md). The quota overlay is hash-pinned
to both official 0.5.35 and the enhanced 0.5.35 circuit-breaker build. Other
source builds fail cleanly when their chunk hashes differ.

Local compatibility patch tested with 9Router `0.5.35`.

## Providers

- OpenRouter credits and usage in USD.
- DeepSeek available, promotional, and topped-up balances.
- CommandCode monthly balance plus 5-hour and 7-day windows.
- xAI/Grok subscription quota and prepaid balance.
- Xiaomi MiMo paid and granted balances through a console session cookie.
- ClinePass 5-hour, 7-day, and 30-day quota windows.

## Commands

```bash
node ~/.9router/quota-tracker.patch.js --check
node ~/.9router/quota-tracker.patch.js --apply
node ~/.9router/quota-tracker.patch.js --rollback
node ~/.9router/quota-tracker.patch.js --sanitize
node ~/.9router/quota-tracker.test.js
```

## Update guard

The user service launcher at
`~/.hermes/profiles/zen/scripts/start-9router.sh` performs these steps:

1. Detects a 9Router version change and backs up the database, patch files,
   launcher, and installed package metadata.
2. Applies the patch only when all known bundles are byte-compatible.
3. Removes exact, known patch residue after an incompatible or partial update.
4. Starts unpatched upstream 9Router when the new build is incompatible.
5. Waits for `/api/health`; on failure with an active patch, rolls it back and
   quarantines that 9Router version before starting upstream clean.

Startup state is recorded in `~/.9router/quota-tracker-startup.status`. The
quarantine is automatically cleared when a different 9Router version appears.
Version-change backups are stored below `~/.9router/db/backups/pre-update-*`.

Original bundles used for rollback are stored in
`~/.9router/quota-tracker-originals/official-0.5.35/` and
`~/.9router/quota-tracker-originals/enhanced-0.5.35/`.

The pre-update snapshot from 0.5.30, including the database, complete installed
package, patch files, launcher, checksums, and Git bundle, is stored below
`~/.9router/db/backups/pre-npm-update-0.5.30-to-0.5.35-*`.

The pre-fix operational backup, including the SQLite database, systemd unit,
startup script, bundles, patchers, and checksums, is stored in
`~/.9router/backups/quota-tracker-v2-20260711-225500/`.

## Grok

The Grok collector uses the xAI OAuth connection already stored by 9Router. If
that session and its refresh token have expired, reconnect xAI in the Providers
screen. A normal xAI OAuth token is not a Management API key and is never sent
to the xAI Management API by this patch. When the billing response provides
`creditUsagePercent` and a weekly period but no absolute allotment, the tracker
shows a 100-point percentage bar with the provider's period end as its reset
time. It does not estimate or invent a credit total.
