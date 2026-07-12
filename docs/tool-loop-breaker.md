# Antigravity tool-loop breaker

## Problem

Hermes sessions routed through 9Router to Antigravity/Gemini can repeatedly
emit the same structured tool call even after the client returns an unchanged
result or explicitly blocks the loop. A captured production session repeated
the same `search_files` operation 18 times.

The upstream 9Router 0.5.30 path preserves the individual OpenAI tool-call and
tool-result handshake, but does not stop the provider from generating another
identical `functionCall` from history. Removing `tools` alone is insufficient:
Gemini can infer and emit the call from prior turns even without current
function declarations.

## Fix

The patch implements a request-local circuit breaker:

1. Canonicalize tool arguments recursively so JSON object key order does not
   affect equality.
2. Detect three identical consecutive assistant tool-call turns, ignoring the
   tool-result messages between them.
3. On the next Antigravity dispatch, remove `tools` and `toolConfig`.
4. Add an explicit final-text instruction to the latest Gemini user content,
   beside the last `functionResponse`.

The breaker affects only the escape turn. It does not retain server-side
conversation state and does not change calls below the threshold.

## Apply to an upstream checkout

The patch targets 9Router 0.5.30 commit
`9845a1702f7766607bd7ac3315d1f87e59e45fb5`.

```bash
git clone https://github.com/decolua/9router.git
cd 9router
git checkout 9845a1702f7766607bd7ac3315d1f87e59e45fb5
git apply /path/to/9router-enhanced/patches/antigravity-tool-loop-breaker.patch

npm install --ignore-scripts
npm install --no-save esbuild
npm install --prefix tests
./tests/node_modules/.bin/vitest run \
  --config tests/vitest.config.js \
  tests/translator/bugs-antigravity.test.js

npm --prefix cli run build
cd cli
npm pack --pack-destination /tmp
```

Install the resulting tarball using the same npm prefix as the managed 9Router
installation, then restart only `9router.service`.

## Regression evidence

Forced streaming loop before the patch:

```text
step 1: finish_reason=tool_calls, tool=search_files
step 2: finish_reason=tool_calls, tool=search_files
step 3: finish_reason=tool_calls, tool=search_files
step 4: finish_reason=tool_calls, tool=search_files
```

After the patch:

```text
step 1: finish_reason=tool_calls, tool=search_files
step 2: finish_reason=tool_calls, tool=search_files
step 3: finish_reason=tool_calls, tool=search_files
step 4: finish_reason=stop, tool=none
```

Normal-flow regression check:

```text
add(20, 22) -> tool_calls
tool result 42 -> finish_reason=stop, content=42
```

Focused translator tests pass 9/9. The wider translator suite on upstream
0.5.30 has unrelated pre-existing/environment-sensitive snapshot failures;
those are not changed by this patch.

## Rollback

Reinstall the unmodified 9Router package or restore the pre-change package
backup, then restart `9router.service`. An operational backup created during
the first deployment is stored locally outside this repository; it is not
committed because it contains runtime package and database material.

## Quota overlay compatibility

The quota overlay is hash-pinned to upstream compiled bundles. A custom source
rebuild changes Next.js chunk hashes, so the quota startup guard intentionally
falls back to clean upstream bundles until the catalog is regenerated for that
build. This does not affect the API router or Antigravity requests.
