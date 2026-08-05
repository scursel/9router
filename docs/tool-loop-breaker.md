# Antigravity tool-loop breaker

This is modification 2 of 3 in this overlay — see the top-level
[`README.md`](../README.md) for the full list (quota tracker, Antigravity
tool-loop breaker, CORS preflight fix).

## Problem

Hermes sessions routed through 9Router to Antigravity/Gemini can repeatedly
emit the same structured tool call even after the client returns an unchanged
result or explicitly blocks the loop. A captured production session repeated
the same `search_files` operation 18 times.

The upstream 9Router 0.5.40 path preserves the individual OpenAI tool-call and
tool-result handshake, but does not stop the provider from generating another
identical `functionCall` from history. Removing `tools` alone is insufficient:
Gemini can infer and emit the call from prior turns even without current
function declarations.

## Fix

The patch implements a streaming and request-local circuit breaker:

1. Canonicalize tool arguments recursively so JSON object key order does not
   affect equality.
2. Limit one streamed Antigravity response to three semantically identical
   calls while preserving parallel calls with different arguments.
3. Aggregate identical calls across trailing assistant batches even when the
   batches contain different numbers of calls, ignoring tool-result messages.
4. On the next Antigravity dispatch, remove `tools` and `toolConfig`.
5. Add an explicit final-text instruction to the latest Gemini user content,
   beside the last `functionResponse`.

The breaker affects only the escape turn. It does not retain server-side
conversation state and does not change calls below the threshold.

## Apply to an upstream checkout

The original unified diff targets 9Router 0.5.40 commit
`79918c7830695bbca4a45c9fea4a42c3e9fd73d1`. For 0.5.45 (`v0.5.45` /
`6fcd27337a7893642c7fe630840d0a641743f28f`) the same logic was re-applied by
hand on the `open-sse/` tree (the unified diff no longer applies cleanly).
For 0.5.50, use the separately generated
`patches/antigravity-tool-loop-breaker-0.5.50.patch`; it applies cleanly to
`v0.5.50` and was validated against the upstream Antigravity regression suite.

```bash
git clone https://github.com/decolua/9router.git
cd 9router
git checkout 79918c7830695bbca4a45c9fea4a42c3e9fd73d1
git apply /path/to/9router-enhanced/patches/antigravity-tool-loop-breaker.patch

npm install
npm install --prefix cli
npm install --prefix /tmp vitest@4
NODE_PATH=/tmp/node_modules /tmp/node_modules/.bin/vitest run \
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

Forced parallel-loop test through Hermes before the second iteration executed
10 searches across four API calls. After response-batch filtering and
cross-batch aggregation, session `20260713_002213_67271d` executed exactly
three identical `search_files` calls in its first API response; its second API
response stopped with final text and no fourth tool execution.

Normal-flow regression check:

```text
add(20, 22) -> tool_calls
tool result 42 -> finish_reason=stop, content=42
```

Focused translator tests pass 12/12; the related streaming and thinking suite
passes 54/54 across three files. The wider translator suite on upstream
0.5.40 has one unrelated upstream catalog assertion failure in
`unit/antigravity-mitm.test.js`;
those are not changed by this patch.

## Rollback

Reinstall the unmodified 9Router package or restore the pre-change package
backup, then restart `9router.service`. An operational backup created during
the first deployment is stored locally outside this repository; it is not
committed because it contains runtime package and database material.

## Quota overlay compatibility

The quota overlay is hash-pinned to the enhanced 0.5.40 build produced with
Next.js 16.2.10. The catalog was regenerated after the circuit-breaker build and
validates all 18 target bundles. Unknown builds still fail closed and start
without modifying bundles.

The 0.5.50 quota catalog is documented separately in
[`update-0.5.50.md`](update-0.5.50.md).
