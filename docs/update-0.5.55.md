# Update record: 0.5.55

## Upstream

- npm: `9router@0.5.55` (2026-08-14)
- Git tag: `v0.5.55` (`699edac327`)
- 31 commits ahead of `v0.5.50`

## Official vs enhanced

Official npm `0.5.55` does not include the Antigravity tool-loop breaker.
The breaker is a source patch on `open-sse/` and must be rebuilt into the
CLI tarball. Installing official `9router@0.5.55` therefore drops that
improvement unless the enhanced rebuild is installed instead.

Enhanced tarball SHA-256:

```text
35aea4a3c922e800fc5e66efd5d93df1a9d601b93488119efeadfc59bd7465c8
```

The 0.5.50 breaker patch applies cleanly to `v0.5.55`. Source tests
`tests/translator/bugs-antigravity.test.js` passed 7/7 after apply. The
rebuild changes Next chunk hashes, so the overlay uses a separate catalog
`enhanced-0.5.55` (fingerprint `page-b230ee0b12eb9318.js`, catalog chunk
`3547.js` instead of official `7011.js`).

## Overlay

`patches/quota-tracker.patch.js` fingerprint-selects:

```text
official-0.5.55   page-b571eafb19552ce1.js
enhanced-0.5.55   page-b230ee0b12eb9318.js
```

Unknown fingerprints fail closed. Apply/rollback refuse them.

Preserved on both 0.5.55 variants:

- `qwen-cloud-token-plan` inject (existing Ali connections keep working)
- `alitp-intl` usage features + local meter (`qtpAlibaba`)
- OpenCode Go usage collector (`GET /zen/go/v1/usage`) without replacing official `transports`
- CORS path derivation picks up the new `1321-914afc18e65fc58b.js` chunk
- WAN image adapter (anchor-based, not hash-pinned)

Only the enhanced tarball carries the tool-loop breaker.

## Validation (isolated)

```text
node tests/quota-tracker-0555.test.js            official apply/rollback
node tests/quota-tracker-0555-enhanced.test.js   enhanced apply/rollback
node tests/quota-tracker.test.js
node tests/quota-tracker-integration.test.js
node tests/alibaba-token-plan.test.js
node tests/cors-preflight.test.js
```

## Live cutover

1. Snapshot `~/.9router/db/backups/pre-cutover-0.5.50-to-0.5.55-*`
2. Install official 0.5.55 and apply overlay (quota/CORS/WAN/OpenCode Go)
3. Rebuild enhanced 0.5.55 with the breaker and replace the live package
4. `install.sh` so the overlay matches `enhanced-0.5.55`
5. Hard-refresh the dashboard
