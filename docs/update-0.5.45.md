# Update record: 0.5.45

## Upstream

- npm package: `9router@0.5.45`
- Git tag: `v0.5.45`
- Source commit: `6fcd27337a7893642c7fe630840d0a641743f28f`
- Release date: 2026-07-30

The official package was installed and audited before the enhanced build. It
does not include the custom balance collectors, financial renderer, weekly
Grok percentage fallback, update guard, or Antigravity loop breaker.

## Enhanced build

The Antigravity tool-loop breaker was ported onto the `v0.5.45` tree (source
diff under `open-sse/`) and rebuilt with Next.js `16.2.12`. The enhanced CLI
was installed from a local npm tarball. The tarball itself is intentionally
not committed.

Local tarball SHA-256 at deployment time:

```text
b972a7052d3289d02924d9fcd9f71d03d33d90e0cc701d985def0a81463f32cf
```

Official 0.5.45 tarball SHA-256 used for fixture catalogs:

```text
e102bd7a2f09861ce2371f2e8eb61c6bf2fa6e3039f2046a9bfd5aec0aacf980
```

## Quota patcher changes

`patches/quota-tracker.patch.js` now:

- Fingerprint-selects among official/enhanced catalogs for 0.5.35, 0.5.40, and
  0.5.45.
- Detects the usage dispatch symbol (`let V=` / `let ad=`), native Grok
  function name (`M` / `S`), and result plan variable dynamically so the
  injector survives minifier renames.
- Catalogs 18 hash-pinned bundles per 0.5.45 variant (usage chunk, provider
  allow-lists, quota UI).

## Validation

- Quota parser tests passed.
- Official and enhanced 0.5.45 fixtures passed apply, idempotence, rollback,
  reapply, sanitize, and syntax checks (18-bundle catalogs).
- CORS preflight fixture tests passed against 0.5.45 `custom-server.js`.
- Live install:
  - `9router@0.5.45` (enhanced) under `~/.hermes/node`
  - Quota tracker: `enhanced-0.5.45`, 18/18 patched
  - CORS preflight applied
  - Startup status: `patched`
  - `/api/health` → `{"ok":true}`
  - `/api/version` → `currentVersion: 0.5.45`, `hasUpdate: false`
  - `/v1/models` → 179 models
  - SQLite integrity check → `ok`
  - Tool-loop breaker string present in server chunk `3943.js`

## Recovery

Pre-cutover snapshots outside Git:

- `~/.9router/db/backups/pre-npm-update-0.5.40-to-0.5.45-20260730-132950`
- `~/.9router/db/backups/pre-cutover-0.5.40-to-0.5.45-20260730-141944`
- Startup guard: `~/.9router/db/backups/pre-update-0.5.40-to-0.5.45-20260730-142008`

Rollback originals for the live enhanced build:

- `~/.9router/quota-tracker-originals/enhanced-0.5.45/`
