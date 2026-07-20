# Update record: 0.5.40

## Upstream

- npm package: `9router@0.5.40`
- Git tag: `v0.5.40`
- Source commit: `79918c7830695bbca4a45c9fea4a42c3e9fd73d1`
- Release date: 2026-07-20

The official package was installed and audited before the enhanced build. Its
changes include a better-sqlite3 binding fix, Codex model-sync improvements,
Kiro reasoning mappings, Cursor HTTP/2 support, and dashboard optimizations.
It does not include the custom balance collectors, financial renderer, weekly
Grok percentage fallback, update guard, or Antigravity loop breaker.

## Enhanced build

The existing Antigravity source patch applied cleanly to the upstream tag. The
enhanced CLI was built with Next.js `16.2.10` and installed from a local npm
tarball. The tarball itself is intentionally not committed.

Local tarball SHA-256 at deployment time:

```text
b78713c195d15135d7c0a04fcfa586e5fa49bcfac40994e61d9aacdd8edd0b44
```

## Validation

- Antigravity, streaming, and thinking suites: 54/54 passed.
- Wider Antigravity set: 75 passed, 6 skipped, and one unrelated upstream
  catalog assertion failed in `unit/antigravity-mitm.test.js`.
- Quota parser tests passed.
- Official and enhanced quota fixtures passed apply, idempotence, rollback,
  reapply, and 18-bundle hash validation.
- Installed package passed rollback, reapply, syntax, and restart checks.
- `/api/health`, `/api/version`, and `/v1/models` passed; 181 models returned.
- OpenRouter, DeepSeek, CommandCode, ClinePass, Grok, and MiMo live calls passed.
- Dashboard version, financial rendering, weekly Grok quota, and MiMo balance
  were checked with browser cache disabled.
- SQLite integrity check returned `ok`.

The MiMo console cookie stored before this update had expired. The browser
session was still authenticated, so only `providerSpecificData.quotaCookie`
was refreshed after a successful live balance request.

## Recovery

The complete pre-update snapshot is stored outside Git under
`~/.9router/db/backups/pre-npm-update-0.5.35-to-0.5.40-*`. The startup guard also
created `~/.9router/db/backups/pre-update-0.5.35-to-0.5.40-*` before the first
enhanced `0.5.40` launch.
