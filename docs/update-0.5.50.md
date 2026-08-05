# Update record: 0.5.50

## Upstream

- npm package: `9router@0.5.50`
- Git tag: `v0.5.50`
- Source commit: `15223724c3e1ad898e84ef6e0cc1686cbafc8290`
- Release date: 2026-08-05

## Official package

Official tarball SHA-256 used as fixture:

```text
dc1ac705afafaf7970aac47032013b91ffcfd0db4745c0e9394b468798532141
```

## Enhanced build

The Antigravity tool-loop breaker was ported onto the `v0.5.50` source tree
using `patches/antigravity-tool-loop-breaker-0.5.50.patch` and rebuilt with
Next.js `16.2.12`. The resulting private CLI tarball was installed locally.

Enhanced tarball SHA-256 at deployment time:

```text
3d34ce37a366a0628cf07b0e0f885f4ee8bf8e19ddbe17a0c8d90a14bda8fffa
```

## Source patch validation

Focused Antigravity regression suite on the patched `v0.5.50` source:

```text
Test Files  1 passed (1)
Tests       7 passed (7)
Duration    2.09s
File        tests/translator/bugs-antigravity.test.js
```

The wider translator suite has unrelated upstream snapshot/catalog failures;
the breaker-specific tests pass.

## Quota overlay compatibility

`patches/quota-tracker.patch.js` now fingerprint-selects among
`official-0.5.50` and `enhanced-0.5.50`, plus the existing official/enhanced
catalogs for `0.5.35`, `0.5.40`, and `0.5.45`. The enhanced `0.5.50`
catalog contains 20 hash-pinned bundles; chunk `4695.js` replaces official
`7011.js` because the separate Next.js build produces a different chunk graph.

The enhanced `0.5.50` fingerprint is:

```text
../static/chunks/app/(dashboard)/dashboard/quota/page-d9d1141b54f2eedd.js
```

## Validation

- `node tests/quota-tracker.test.js` passed.
- `node tests/cors-preflight.test.js` passed.
- Enhanced `0.5.50` quota fixture: apply, idempotent re-apply, rollback,
  reapply, sanitize, and all patched-bundle `node --check` syntax checks
  passed (20/20 bundles).
- CORS preflight fixture against `0.5.50` `custom-server.js`: apply, syntax
  check, idempotent re-apply, rollback, and live OPTIONS probe passed.
- WAN image adapter patch applies to the `0.5.50`
  `app/api/v1/images/generations/route.js` and rollback restores the
  byte-identical pristine route.
- Antigravity breaker is present in the shipped enhanced artifact but absent
  from the official tarball. Distinctive source strings from the patch (e.g.
  `"Tool loop circuit breaker: ..."`, `"removed tool declarations after 3
  identical consecutive calls"`) appear in enhanced build chunks
  `3943.js` and `8895.js`, and in the live installed package, while the
  official 0.5.50 tarball contains none of them.

## Live install

Installed and running:

- `9router@0.5.50` (enhanced) under `~/.hermes/node`
- Quota tracker: `enhanced-0.5.50`, 20/20 patched
- CORS preflight applied
- WAN image adapter patch applied (`WanImageProviderPatch:v1` marker present)
- Startup status: `patched`
- `/api/health` → `{"ok":true}`
- `/api/version` → `currentVersion: "0.5.50"`, `latestVersion: "0.5.50"`,
  `hasUpdate: false`
- `/v1/models` → 443 models
- SQLite integrity check → `ok`

## Backup

Pre-cutover snapshot outside Git:

```text
~/.9router/db/backups/pre-cutover-0.5.45-to-0.5.50-20260805-173712
```

Contains SQLite `.backup`, WAL/SHM copies, installed package metadata,
launcher, patchers, and `SHA256SUMS`.

## Recovery

Restore the pre-cutover backup directory over the live state, reinstall the
unmodified `0.5.45` package, and restart `9router.service`. The update-guard
backups created by the launcher on version change are stored under
`~/.9router/db/backups/pre-update-*`.

## Notes

- The consolidated launcher keeps the WAN image adapter patch as a startup
  hard-fail (exit 1 if it cannot apply) and also backs up the Antigravity
  tool-loop breaker source patch on every version-change backup.
- The live `~/.9router/wan-image-original.route.js` was refreshed from the
  pristine `0.5.50` route so WAN rollback does not restore a stale `0.5.45`
  file onto the new package.
