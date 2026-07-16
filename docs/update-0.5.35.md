# Update record: 0.5.35

## Upstream

- npm package: `9router@0.5.35`
- Git tag: `v0.5.35`
- Source commit: `bc252ea80298d4879dc6b3c69585af1610d2c76f`
- Release date: 2026-07-16

The official package was installed first and audited before applying local
changes. It includes better Grok subscription and monthly-credit parsing, but
does not include the custom USD balance collectors, financial quota renderer,
or Antigravity tool-loop breaker.

## Enhanced build

The existing Antigravity source patch applied cleanly to the upstream tag. The
enhanced CLI was built with Next.js `16.2.1` and installed from a local npm
tarball. The tarball itself is intentionally not committed.

Local tarball SHA-256 at deployment time:

```text
ed472b3fc8cbf579d12aba860c468abe4a10125ffc85e56d08ae20fc407a3afe
```

## Validation

- Antigravity focused regression suite: 12/12 passed.
- Antigravity, streaming, and thinking suites: 54/54 passed.
- Quota parser tests passed.
- Quota patch apply, idempotence, rollback, and reapply passed.
- All 18 enhanced-build bundle hashes validated.
- Official npm tarball fixture passed apply, check, rollback, and clean check.
- `/api/health`, `/api/version`, and `/v1/models` passed.
- OpenRouter, DeepSeek, CommandCode, ClinePass, and xAI live quota calls passed.
- Dashboard currency rendering was checked with browser cache disabled.

Both xAI OAuth sessions were expired at validation time and were renewed using
their existing refresh tokens. The MiMo console cookie remains expired and
requires a normal console login; this is session expiry, not a code regression.

## Recovery

The pre-update snapshot is stored outside Git under
`~/.9router/db/backups/pre-npm-update-0.5.30-to-0.5.35-*`. It contains the
database, complete 0.5.30 package, operational scripts, checksums, and a Git
bundle. The startup guard also created a version-transition backup before the
first 0.5.35 launch.
