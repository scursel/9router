# Task 3 Report: Environment-Only Alibaba Console Adapter & Usage Dispatcher

## Summary
Task 3 implements the environment-only Alibaba Token Plan console adapter (`qtpFetchAlibabaTokenPlan`), safe payload helper (`qtpFetchAlibabaPayload`), safe error sanitizer (`qtpSafeAlibabaReason`), per-process cache (`qtpAlibabaCache`), runtime wrapper (`qtpAlibaba`), provider registry entry (`"qwen-cloud-token-plan"`), and usage allowlist updates in `patches/quota-tracker.patch.js`.

## Key Implementations
1. **Console Request Envelope Contract**: Encoded exact upstream private console URL (`https://cs-data.qwencloud.com/data/api.json?...`), headers (`Cookie`, `Referer`, `Origin`, `X-Requested-With`, `Accept`), and form-urlencoded body payload (`product=sfm_bailian`, `action=IntlBroadScopeAspnGateway`, `sec_token`, `region=ap-southeast-1`, `language=en-US`, and nested `params` / `cornerstoneParam` JSON).
2. **Timeout & Security Safeguards**: Enforced `AbortSignal.timeout(8_000)`, secret isolation to `ALIBABA_TOKEN_PLAN_QUOTA_COOKIE` and `ALIBABA_TOKEN_PLAN_SEC_TOKEN`, and safe reason sanitization mapping to only `"session unavailable"`, `"authentication failed"`, or `"quota unavailable"`.
3. **Cache Policy**: Fresh cache for <60s (`status: "ok"`). On network/API errors within 5 minutes (<=300s) of `fetchedAt`, returns stale cache (`status: "stale"`) retaining original timestamp and omitting `message`. Beyond 5 minutes (>300s), returns `status: "unavailable"`.
4. **Provider Registry & Allowlists**: Added `"qwen-cloud-token-plan": a => qtpAlibaba(a)` to `qtpProviders`, registered canonical ID in both `usageProviders` and `apiKeyProviders` allowlists, and kept all existing inference dispatch entries unchanged.

## Test Evidence
Ran both test suites in worktree `.worktrees/alibaba-token-plan`:

```bash
$ node tests/alibaba-token-plan.test.js
Alibaba Token Plan parser tests: ok
Alibaba Token Plan adapter tests: ok

$ node tests/quota-tracker.test.js
quota tracker parser tests: ok

$ node -e 'for (const f of process.argv.slice(1)) { const s=require("fs").readFileSync(f,"utf8"); if (/cookie|sec[_-]?token|authorization|bearer|sk-sp-|email|accountId/i.test(s)) throw new Error(`secret-like field in ${f}`); JSON.parse(s); }' tests/fixtures/alibaba-token-plan/*.json
(exit code 0, no output)
```

## Self-Review
- **Completeness**: All required assertions covered (missing secrets, request shape, ok/stale/unavailable statuses, cache boundaries, secret isolation in `JSON.stringify`, provider dispatch entries).
- **Correctness**: Zero secret leaks in thrown errors or serialized responses. `used: 0` is never fabricated on `unavailable`.
- **Integrity**: `node tests/alibaba-token-plan.test.js` and `node tests/quota-tracker.test.js` both pass cleanly.


## Fix Section (Review Remediation)

### Changes Applied
1. **Qwen Request Envelope Nesting (`patches/quota-tracker.patch.js`)**:
   - Corrected `params.Data` structure in `qtpFetchAlibabaPayload` so `cornerstoneParam` is an object nested directly inside `params.Data`, rather than a sibling property alongside a stringified `Data: "{}"`.
   - Included all required `cornerstoneParam` fields (`feTraceId` hex generation, `feURL`, `protocol: "V2"`, `console: "ONE_CONSOLE"`, `productCode: "p_efm"`, `domain: "home.qwencloud.com"`, `consoleSite: "QWENCLOUD"`, `userNickName: ""`, `userPrincipalName: ""`, `xsp_lang: "en-US"`), keeping secrets strictly out of `cornerstoneParam`.
2. **Restored Prior Cline Dispatch (`patches/quota-tracker.patch.js`)**:
   - Restored the prior `qtpCline` string inside `injectedCode` verbatim from parent commit `6c48e85`, eliminating unintended modifications to Cline pagination logic and preserving all existing provider dispatch entries.
3. **Strengthened Request-Shape Unit Test (`tests/alibaba-token-plan.test.js`)**:
   - Decoded `URLSearchParams(init.body)` and parsed `JSON.parse(params)`.
   - Asserted `Api`, `V`, `Data` object shape, and all fields of `params.Data.cornerstoneParam` while ensuring secrets (`fixture-sec-token`, `fixture-cookie`) are not exposed or printed in errors.

### Verification Output
```bash
$ node tests/alibaba-token-plan.test.js
Alibaba Token Plan parser tests: ok
Alibaba Token Plan adapter tests: ok

$ node tests/quota-tracker.test.js
quota tracker parser tests: ok
```