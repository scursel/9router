# Account resilience (circuit breaker + semaphore) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skip a dead account (5xx/timeout circuit breaker) and cap each account at 3 in-flight chat requests, falling through to another account of the same provider, then to combo, with dashboard badges and per-account reset.

**Architecture:** Two in-memory modules (`circuitBreaker`, `accountSemaphore`) keyed `provider:connectionId`. Selection uses a pure `isBlocked` peek (does not consume HALF_OPEN probes). Only `handleChat` calls mutating `canExecute` at attempt time. The semaphore slot and `recordSuccess` last until the **stream ends** (or the non-stream JSON returns), not until `handleChatCore` returns the Response. 5xx/timeout record failures; 429 does not. Dashboard via `/api/providers/circuit-breakers`. Restart clears both registries.

**Review:** Claude Code 2026-08-31 — Yes with changes. C1 stream-lifetime slot, C2 `isBlocked` vs `canExecute`, C3 `getRetryAfterMs` on Task 1, I1 overlap with `TRANSIENT_COOLDOWN_MS`, I2 2s queue wait, I3 full auth mocks, I4 force 503, I5 chat-loop test. Incorporated below.

**Tech Stack:** Node ESM, Vitest in `tests/`, Next.js App Router API, existing dashboard `ConnectionRow` / providers grid. Port engines from VansRouter `dev` with the spec deltas (no `proxyHash`, public `recordFailure`/`recordSuccess`).

## Global Constraints

- Branch: `enhanced/0.5.59` (worktree `.worktrees/enhanced-0.5.59`).
- Breaker name and semaphore key: `provider:connectionId` only. No proxy/tunnel in the key.
- Breaker is in-memory. Do not write it to SQLite or settings.
- `PROVIDER_FAILURE_ERROR_CODES` = `{408, 500, 502, 503, 504}`. 429 must not be in the set.
- Default `maxConcurrency` is `3`. `providerSpecificData.maxConcurrency` of `0` or `null` bypasses the semaphore for that account.
- Semaphore wait timeout is **2000ms**, not 30s. Serial fallback must not stall the client.
- `isBlocked(name)` is a pure read: true only when state is OPEN and the reset timeout has **not** elapsed. It must not transition HALF_OPEN or decrement `halfOpenRemaining`.
- `canExecute(name)` is only called from `handleChat` immediately before an actual upstream attempt.
- For SSE, `semaphoreRelease` + `recordSuccess`/`recordFailure` run on `onStreamComplete` / disconnect, not in a `finally` around `handleChatCore` (that returns when headers are ready; see `open-sse/handlers/chatCore/streamingHandler.js` ~104).
- All-OPEN / all-unavailable breaker path **forces HTTP 503** so `combo.js` falls through (`!shouldFallback` on 401/403 would abort).
- Existing `markAccountUnavailable` still model-locks ~30s on unmatched 5xx (`TRANSIENT_COOLDOWN_MS`). The breaker is cross-model accumulation, not a faster first-error hop. Do not lower the threshold to 1.
- Do not change Antigravity tool-loop breaker, quota collectors, or proxy-fitness.
- No new dashboard route. Badge on existing provider list + `ConnectionRow`.
- Tests run with `cd tests && npm test -- <file>`.
- Do not add npm dependencies.
- Semaphore wraps chat only in this version. OPEN-account skip lives in `getProviderCredentials` so every credential consumer benefits.

## File Map

- **Create:** `open-sse/utils/circuitBreaker.js` — in-memory breaker registry.
- **Create:** `open-sse/services/accountSemaphore.js` — in-memory per-account gate.
- **Create:** `tests/unit/circuit-breaker.test.js`
- **Create:** `tests/unit/account-semaphore.test.js`
- **Create:** `tests/unit/account-breaker-routing.test.js` — credential skip + all-OPEN 503 timing.
- **Create:** `src/app/api/providers/circuit-breakers/route.js`
- **Create:** `src/app/api/providers/circuit-breakers/[name]/reset/route.js`
- **Create:** `src/shared/hooks/useCircuitBreakers.js`
- **Create:** `src/app/(dashboard)/dashboard/providers/components/CircuitBreakerBadge.js`
- **Modify:** `src/sse/services/auth.js` — skip OPEN accounts in `availableConnections`.
- **Modify:** `src/sse/handlers/chat.js` — acquire/release semaphore; recordFailure/recordSuccess.
- **Modify:** `src/app/(dashboard)/dashboard/providers/[id]/ConnectionRow.js` — per-account badge + reset.
- **Modify:** `src/app/(dashboard)/dashboard/providers/page.js` — summary badge when any account is not CLOSED.

---

### Task 1: Circuit breaker module

**Files:**
- Create: `open-sse/utils/circuitBreaker.js`
- Create: `tests/unit/circuit-breaker.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `STATE = { CLOSED, DEGRADED, OPEN, HALF_OPEN }`
  - `PROVIDER_FAILURE_ERROR_CODES = Set([408, 500, 502, 503, 504])`
  - `buildAccountBreakerName({ provider, connectionId }) → string` (`${provider}:${connectionId}`)
  - `getCircuitBreaker(name, options?)` — creates if `options` given; returns existing; returns `null` if unknown and no options
  - `recordFailure(name, error)` / `recordSuccess(name)` — no-ops if breaker missing
  - `isBlocked(name) → boolean` — pure; `true` iff registered, state OPEN, and reset timeout not elapsed. Never mutates.
  - `canExecute(name) → boolean` — may OPEN→HALF_OPEN and consume a probe. Chat attempt only.
  - `getRetryAfterMs(name) → number` — 0 if missing/CLOSED
  - `shouldRecordBreakerFailure(status) → boolean`
  - `resetCircuitBreaker(name)` / `resetAllCircuitBreakers()`
  - `getAllCircuitBreakerStatuses() → Array<{ name, state, failureCount, successCount, retryAfterMs, lastFailureTime }>`
  - Defaults: `failureThreshold: 5`, `resetTimeout: 30_000`, `halfOpenRequests: 1`, `degradationThreshold: floor(5 * 0.6) = 3`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/circuit-breaker.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import {
  getCircuitBreaker,
  resetCircuitBreaker,
  resetAllCircuitBreakers,
  getAllCircuitBreakerStatuses,
  recordFailure,
  recordSuccess,
  canExecute,
  isBlocked,
  getRetryAfterMs,
  shouldRecordBreakerFailure,
  buildAccountBreakerName,
  STATE,
  PROVIDER_FAILURE_ERROR_CODES,
} from "../../open-sse/utils/circuitBreaker.js";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    resetAllCircuitBreakers();
  });

  it("buildAccountBreakerName is provider:connectionId", () => {
    expect(buildAccountBreakerName({ provider: "glm", connectionId: "acc-1" })).toBe("glm:acc-1");
  });

  it("starts CLOSED and can execute", () => {
    const cb = getCircuitBreaker("glm:a", { failureThreshold: 3, resetTimeout: 1000 });
    expect(cb.getStatus().state).toBe(STATE.CLOSED);
    expect(canExecute("glm:a")).toBe(true);
  });

  it("opens after reaching failure threshold", () => {
    const cb = getCircuitBreaker("glm:open", { failureThreshold: 3, resetTimeout: 1000 });
    recordFailure("glm:open", { statusCode: 500 });
    recordFailure("glm:open", { statusCode: 502 });
    expect(cb.getStatus().state).toBe(STATE.DEGRADED);
    recordFailure("glm:open", { statusCode: 503 });
    expect(cb.getStatus().state).toBe(STATE.OPEN);
    expect(canExecute("glm:open")).toBe(false);
  });

  it("does not count 429", () => {
    expect(PROVIDER_FAILURE_ERROR_CODES.has(429)).toBe(false);
    const cb = getCircuitBreaker("glm:rl", {
      failureThreshold: 1,
      isFailure: (err) => PROVIDER_FAILURE_ERROR_CODES.has(err?.statusCode),
    });
    recordFailure("glm:rl", { statusCode: 429 });
    expect(cb.getStatus().state).toBe(STATE.CLOSED);
    expect(canExecute("glm:rl")).toBe(true);
  });

  it("isolates accounts of the same provider", () => {
    getCircuitBreaker("glm:a", { failureThreshold: 1 });
    getCircuitBreaker("glm:b", { failureThreshold: 1 });
    recordFailure("glm:a", { statusCode: 500 });
    expect(canExecute("glm:a")).toBe(false);
    expect(canExecute("glm:b")).toBe(true);
  });

  it("HALF_OPEN probe success closes", async () => {
    getCircuitBreaker("glm:probe", { failureThreshold: 1, resetTimeout: 40 });
    recordFailure("glm:probe", { statusCode: 500 });
    await new Promise((r) => setTimeout(r, 50));
    expect(canExecute("glm:probe")).toBe(true);
    recordSuccess("glm:probe");
    expect(getCircuitBreaker("glm:probe").getStatus().state).toBe(STATE.CLOSED);
  });

  it("resetCircuitBreaker closes a single account", () => {
    getCircuitBreaker("glm:reset", { failureThreshold: 1 });
    recordFailure("glm:reset", { statusCode: 500 });
    resetCircuitBreaker("glm:reset");
    expect(canExecute("glm:reset")).toBe(true);
    expect(getCircuitBreaker("glm:reset").getStatus().state).toBe(STATE.CLOSED);
  });

  it("missing breaker is not blocked (fail-open)", () => {
    expect(isBlocked("glm:unknown")).toBe(false);
    expect(canExecute("glm:unknown")).toBe(true);
  });

  it("isBlocked does not consume the HALF_OPEN probe", async () => {
    getCircuitBreaker("glm:peek", { failureThreshold: 1, resetTimeout: 40, halfOpenRequests: 1 });
    recordFailure("glm:peek", { statusCode: 500 });
    expect(isBlocked("glm:peek")).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(isBlocked("glm:peek")).toBe(false);
    expect(getCircuitBreaker("glm:peek").getStatus().state).toBe(STATE.OPEN);
    expect(canExecute("glm:peek")).toBe(true);
    expect(getCircuitBreaker("glm:peek").getStatus().state).toBe(STATE.HALF_OPEN);
    expect(canExecute("glm:peek")).toBe(false);
  });

  it("getRetryAfterMs is 0 when CLOSED and positive when OPEN", () => {
    getCircuitBreaker("glm:retry", { failureThreshold: 1, resetTimeout: 10_000 });
    expect(getRetryAfterMs("glm:retry")).toBe(0);
    recordFailure("glm:retry", { statusCode: 500 });
    expect(getRetryAfterMs("glm:retry")).toBeGreaterThan(0);
  });

  it("shouldRecordBreakerFailure is 5xx/408 only", () => {
    expect(shouldRecordBreakerFailure(500)).toBe(true);
    expect(shouldRecordBreakerFailure(408)).toBe(true);
    expect(shouldRecordBreakerFailure(429)).toBe(false);
    expect(shouldRecordBreakerFailure(401)).toBe(false);
  });

  it("getAllCircuitBreakerStatuses lists registered names", () => {
    getCircuitBreaker("glm:a", { failureThreshold: 5 });
    getCircuitBreaker("glm:b", { failureThreshold: 5 });
    const names = getAllCircuitBreakerStatuses().map((s) => s.name);
    expect(names).toContain("glm:a");
    expect(names).toContain("glm:b");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tests && npm test -- unit/circuit-breaker.test.js`

Expected: FAIL — `Cannot find module '../../open-sse/utils/circuitBreaker.js'`

- [ ] **Step 3: Write minimal implementation**

Create `open-sse/utils/circuitBreaker.js` by porting VansRouter `open-sse/utils/circuitBreaker.js` with these deltas:

1. Add `buildAccountBreakerName({ provider, connectionId }) { return `${String(provider)}:${String(connectionId)}`; }`
2. Add:

```js
export function recordFailure(name, error) {
  const breaker = registry.get(name);
  if (!breaker) return;
  breaker._onFailure(error);
}

export function recordSuccess(name) {
  const breaker = registry.get(name);
  if (!breaker) return;
  breaker._onSuccess();
}

export function canExecute(name) {
  const breaker = registry.get(name);
  if (!breaker) return true;
  return breaker.canExecute();
}

/** Pure: do not OPEN→HALF_OPEN. Used by getProviderCredentials. */
export function isBlocked(name) {
  const breaker = registry.get(name);
  if (!breaker) return false;
  if (breaker.state !== STATE.OPEN) return false;
  return breaker.getRetryAfterMs() > 0;
}

export function getRetryAfterMs(name) {
  const breaker = registry.get(name);
  if (!breaker) return 0;
  return breaker.getRetryAfterMs();
}

export function shouldRecordBreakerFailure(status) {
  return PROVIDER_FAILURE_ERROR_CODES.has(status);
}
```

3. Keep `getCircuitBreaker(name, options)` semantics from Vans (null if unknown and no options; create when options provided).
4. Keep `PROVIDER_FAILURE_ERROR_CODES` **without 429**.
5. Do not add proxyHash helpers.

Default `isFailure` on breakers created for accounts (Task 3) will be `(err) => PROVIDER_FAILURE_ERROR_CODES.has(err?.statusCode)`. The module itself should apply `options.isFailure` inside `_onFailure` as Vans does.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `cd tests && npm test -- unit/circuit-breaker.test.js`

Expected: PASS all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add open-sse/utils/circuitBreaker.js tests/unit/circuit-breaker.test.js
git commit -m "$(cat <<'EOF'
feat(resilience): in-memory per-account circuit breaker

Port VansRouter's breaker without proxy buckets. Keys are
provider:connectionId. 429 is not a failure code.
EOF
)"
```

---

### Task 2: Account semaphore module

**Files:**
- Create: `open-sse/services/accountSemaphore.js`
- Create: `tests/unit/account-semaphore.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `buildAccountSemaphoreKey({ provider, connectionId }) → `${provider}:${connectionId}``
  - `acquire(key, { maxConcurrency, timeoutMs, maxQueueSize, signal }) → Promise<releaseFn>`
  - `SemaphoreCapacityError` / `isSemaphoreCapacityError(err)`
  - `resolveAccountSemaphoreMaxConcurrency(credentials) → number|null` — `3` default; `0`/`null` on `providerSpecificData.maxConcurrency` → `null` (bypass)
  - `resolveAccountSemaphoreKey({ provider, connectionId }) → string|null` — null if either missing

- [ ] **Step 1: Write the failing test**

Create `tests/unit/account-semaphore.test.js`:

```js
import { describe, it, expect } from "vitest";
import {
  acquire,
  isSemaphoreCapacityError,
  buildAccountSemaphoreKey,
  resolveAccountSemaphoreKey,
  resolveAccountSemaphoreMaxConcurrency,
  SemaphoreCapacityError,
} from "../../open-sse/services/accountSemaphore.js";

describe("AccountSemaphore", () => {
  it("buildAccountSemaphoreKey is provider:connectionId", () => {
    expect(buildAccountSemaphoreKey({ provider: "glm", connectionId: "acc-1" })).toBe("glm:acc-1");
  });

  it("releases immediately under the cap", async () => {
    const key = buildAccountSemaphoreKey({ provider: "sem-1", connectionId: "a" });
    const release = await acquire(key, { maxConcurrency: 3 });
    expect(typeof release).toBe("function");
    release();
  });

  it("times out the extra acquire on the same account", async () => {
    const key = buildAccountSemaphoreKey({ provider: "sem-2", connectionId: "a" });
    const r1 = await acquire(key, { maxConcurrency: 1 });
    try {
      await expect(acquire(key, { maxConcurrency: 1, timeoutMs: 40 })).rejects.toThrow(SemaphoreCapacityError);
    } finally {
      r1();
    }
  });

  it("does not block a different account", async () => {
    const keyA = buildAccountSemaphoreKey({ provider: "sem-3", connectionId: "a" });
    const keyB = buildAccountSemaphoreKey({ provider: "sem-3", connectionId: "b" });
    const rA = await acquire(keyA, { maxConcurrency: 1 });
    const rB = await acquire(keyB, { maxConcurrency: 1, timeoutMs: 40 });
    rA();
    rB();
  });

  it("bypasses when maxConcurrency is 0 or null", async () => {
    const key = buildAccountSemaphoreKey({ provider: "sem-4", connectionId: "a" });
    (await acquire(key, { maxConcurrency: 0 }))();
    (await acquire(key, { maxConcurrency: null }))();
  });

  it("default maxConcurrency is 3; 0/null on credentials bypass", () => {
    expect(resolveAccountSemaphoreMaxConcurrency({})).toBe(3);
    expect(resolveAccountSemaphoreMaxConcurrency({ providerSpecificData: { maxConcurrency: 0 } })).toBe(null);
    expect(resolveAccountSemaphoreMaxConcurrency({ providerSpecificData: { maxConcurrency: null } })).toBe(null);
    expect(resolveAccountSemaphoreMaxConcurrency({ providerSpecificData: { maxConcurrency: 8 } })).toBe(8);
  });

  it("resolveAccountSemaphoreKey needs provider and connectionId", () => {
    expect(resolveAccountSemaphoreKey({ provider: "glm", connectionId: "x" })).toBe("glm:x");
    expect(resolveAccountSemaphoreKey({ provider: "glm" })).toBe(null);
  });

  it("isSemaphoreCapacityError detects the class", async () => {
    const key = buildAccountSemaphoreKey({ provider: "sem-5", connectionId: "a" });
    const r1 = await acquire(key, { maxConcurrency: 1 });
    try {
      await acquire(key, { maxConcurrency: 1, timeoutMs: 20 });
      throw new Error("should have thrown");
    } catch (e) {
      expect(isSemaphoreCapacityError(e)).toBe(true);
    } finally {
      r1();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tests && npm test -- unit/account-semaphore.test.js`

Expected: FAIL — missing module.

- [ ] **Step 3: Write minimal implementation**

Port VansRouter `open-sse/services/accountSemaphore.js` with:

- `buildAccountSemaphoreKey({ provider, connectionId })` → `` `${provider}:${connectionId}` `` (no `:direct` suffix).
- `resolveAccountSemaphoreKey` requires `provider` and `connectionId`; ignore model/proxyHash.
- Keep FIFO queue, 30s default timeout, maxQueueSize 20, `markBlocked`, `unref` timers, `SemaphoreCapacityError`.
- `resolveAccountSemaphoreMaxConcurrency` exactly as Vans (default 3, 0/null bypass).

- [ ] **Step 4: Run tests and make sure they pass**

Run: `cd tests && npm test -- unit/account-semaphore.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add open-sse/services/accountSemaphore.js tests/unit/account-semaphore.test.js
git commit -m "$(cat <<'EOF'
feat(resilience): per-account chat semaphore defaulting to 3

Same-account overflow waits or fails; other accounts of the
provider are unaffected. maxConcurrency 0/null bypasses.
EOF
)"
```

---

### Task 3: Skip OPEN accounts in credential selection

**Files:**
- Modify: `src/sse/services/auth.js` — inside `getProviderCredentials`, the `availableConnections` filter (~line 85) and the empty-available branch (~line 110).
- Create: `tests/unit/account-breaker-routing.test.js`

**Interfaces:**
- Consumes: `buildAccountBreakerName`, `canExecute`, `getCircuitBreaker`, `recordFailure`, `resetAllCircuitBreakers` from `open-sse/utils/circuitBreaker.js`.
- Produces: `getProviderCredentials` never returns a connection whose `isBlocked(name)` is true. If every remaining account is OPEN, return `{ allRateLimited: true, retryAfter, retryAfterHuman, lastErrorCode: 503 }` using the shortest `getRetryAfterMs` among those breakers (ISO timestamp = now + ms).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/account-breaker-routing.test.js`. Mock `getProviderConnections` / `getSettings` / mutex dependencies the same way `tests/unit/antigravity-quota-routing.test.js` does (read that file for the mock shape, then adapt). Minimum cases:

```js
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connections: [],
}));

vi.mock("@/lib/localDb", () => ({
  getProviderConnections: async () => mocks.connections,
  getSettings: async () => ({ fallbackStrategy: "fill-first" }),
  updateProviderConnection: async () => {},
  getProxyPools: async () => [],
}));

vi.mock("@/lib/network/connectionProxy", () => ({
  pickProxyPoolId: () => null,
  resolveConnectionProxyConfig: async () => ({
    connectionProxyEnabled: false,
    connectionProxyUrl: "",
    connectionNoProxy: "",
    proxyPoolId: null,
    vercelRelayUrl: "",
  }),
}));

import { getProviderCredentials } from "../../src/sse/services/auth.js";
import {
  getCircuitBreaker,
  recordFailure,
  resetAllCircuitBreakers,
  buildAccountBreakerName,
} from "../../open-sse/utils/circuitBreaker.js";

describe("getProviderCredentials skips OPEN breakers", () => {
  beforeEach(() => {
    resetAllCircuitBreakers();
    mocks.connections = [
      { id: "acc-a", provider: "glm", isActive: true, name: "A", providerSpecificData: {}, priority: 1 },
      { id: "acc-b", provider: "glm", isActive: true, name: "B", providerSpecificData: {}, priority: 2 },
    ];
  });

  it("returns B when A is OPEN", async () => {
    const name = buildAccountBreakerName({ provider: "glm", connectionId: "acc-a" });
    getCircuitBreaker(name, { failureThreshold: 1, isFailure: () => true });
    recordFailure(name, { statusCode: 500 });
    const creds = await getProviderCredentials("glm");
    expect(creds.connectionId).toBe("acc-b");
  });

  it("returns allRateLimited when every account is OPEN", async () => {
    for (const id of ["acc-a", "acc-b"]) {
      const name = buildAccountBreakerName({ provider: "glm", connectionId: id });
      getCircuitBreaker(name, { failureThreshold: 1, resetTimeout: 30_000, isFailure: () => true });
      recordFailure(name, { statusCode: 500 });
    }
    const creds = await getProviderCredentials("glm");
    expect(creds.allRateLimited).toBe(true);
    expect(creds.retryAfter).toBeTruthy();
  });
});
```

**Mocks:** copy the full `vi.mock` list from `tests/unit/antigravity-quota-routing.test.js` lines 9–27 (`@/lib/localDb` must export `validateApiKey`; also mock `@/shared/constants/providers.js`, `open-sse/services/usage/google.js`, `@/sse/utils/logger.js`). Do not invent a thinner mock — it will fail to load `auth.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tests && npm test -- unit/account-breaker-routing.test.js`

Expected: FAIL — first test returns `acc-a` (priority fill-first, breaker ignored).

- [ ] **Step 3: Write minimal implementation**

In `src/sse/services/auth.js`:

1. Import:

```js
import {
  buildAccountBreakerName,
  isBlocked,
  getRetryAfterMs,
} from "open-sse/utils/circuitBreaker.js";
```

2. In the `availableConnections` filter, after the Antigravity quota skip:

```js
const breakerName = buildAccountBreakerName({ provider: providerId, connectionId: c.id });
if (isBlocked(breakerName)) return false;
```

Do **not** call `canExecute` here.

3. When `availableConnections.length === 0`, also consider OPEN breakers for retry timing. After existing lock/quota expiry collection:

```js
for (const c of connections) {
  const breakerName = buildAccountBreakerName({ provider: providerId, connectionId: c.id });
  if (!isBlocked(breakerName)) continue;
  const ms = getRetryAfterMs(breakerName);
  if (ms > 0) expiries.push(new Date(Date.now() + ms).toISOString());
}
```

Reuse `{ allRateLimited, retryAfter, retryAfterHuman }`. Set `lastErrorCode: 503` when the only reason none are available is breakers (so combo does not abort on a stale 401).

- [ ] **Step 4: Run tests and make sure they pass**

Run: `cd tests && npm test -- unit/account-breaker-routing.test.js unit/antigravity-quota-routing.test.js`

Expected: PASS both files (quota routing must not regress).

- [ ] **Step 5: Commit**

```bash
git add src/sse/services/auth.js tests/unit/account-breaker-routing.test.js
git commit -m "$(cat <<'EOF'
feat(auth): skip circuit-open accounts when picking credentials

Another account of the same provider is used instead. If every
account is open, return allRateLimited with Retry-After.
EOF
)"
```

---

### Task 4: Record failures and acquire the semaphore in handleChat

**Files:**
- Modify: `src/sse/handlers/chat.js` — the credential retry loop starting at the `while (true)` (~line 228) through `handleChatCore` success/fallback.

**Interfaces:**
- Consumes: `acquire`, `resolveAccountSemaphoreKey`, `resolveAccountSemaphoreMaxConcurrency`, `isSemaphoreCapacityError` from `accountSemaphore.js`; `getCircuitBreaker`, `buildAccountBreakerName`, `recordFailure`, `recordSuccess`, `PROVIDER_FAILURE_ERROR_CODES` from `circuitBreaker.js`.
- Produces: each chat attempt (1) `getCircuitBreaker` with threshold 5, (2) `canExecute(breakerName)` — if false, exclude and continue (do not acquire), (3) acquire with `timeoutMs: 2000`, (4) on JSON success: `recordSuccess` + release, (5) on SSE success: return the Response **without** releasing; attach release + `recordSuccess` to `onStreamComplete` and release + `recordFailure` (or no success) on disconnect, (6) 5xx/timeout: `recordFailure` + existing `markAccountUnavailable`, (7) 429: no `recordFailure`, (8) capacity error: exclude, continue, (9) all-accounts-exhausted path uses status 503.

- [ ] **Step 1: Write the failing test**

Add `tests/unit/chat-account-resilience.test.js` that mocks `handleChatCore` the way `tests/unit/fetch-success-clears-account.test.js` mocks collaborators. Cover:

1. `handleChatCore` returns `{ success: false, status: 500 }` → after `failureThreshold: 1` (or 5 recorded via the real helper with a test breaker), the account is blocked; 429 must not block.
2. SSE: `handleChatCore` returns `{ success: true, response }` immediately; the semaphore key stays held until a captured `onStreamComplete` from the mock args runs — a second `acquire(..., { maxConcurrency: 1, timeoutMs: 50 })` on the same key fails before complete and succeeds after.

Do not treat `shouldRecordBreakerFailure(500) === true` as sufficient coverage for this task (that assertion already lives in Task 1).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tests && npm test -- unit/chat-account-resilience.test.js`

Expected: FAIL — `handleChat` does not record failures / does not hold the semaphore across the stream.

- [ ] **Step 3: Write minimal implementation**

In `src/sse/handlers/chat.js`, import semaphore + breaker helpers. Skip `noauth` (no `connectionId`).

After token refresh, **before** `handleChatCore`:

```js
const breakerName = buildAccountBreakerName({
  provider,
  connectionId: credentials.connectionId,
});
getCircuitBreaker(breakerName, {
  failureThreshold: 5,
  resetTimeout: 30_000,
  isFailure: (err) => shouldRecordBreakerFailure(err?.statusCode),
});
if (!canExecute(breakerName)) {
  excludeConnectionIds.add(credentials.connectionId);
  continue;
}

const semaphoreKey = resolveAccountSemaphoreKey({
  provider,
  connectionId: credentials.connectionId,
});
const semaphoreMax = resolveAccountSemaphoreMaxConcurrency(refreshedCredentials);
let semaphoreRelease = () => {};
if (semaphoreKey && semaphoreMax != null) {
  try {
    semaphoreRelease = await acquire(semaphoreKey, {
      maxConcurrency: semaphoreMax,
      timeoutMs: 2000,
    });
  } catch (e) {
    if (isSemaphoreCapacityError(e)) {
      log.warn("AUTH", `Account ${credentials.connectionName} at capacity, trying fallback`);
      excludeConnectionIds.add(credentials.connectionId);
      continue;
    }
    throw e;
  }
}

const result = await handleChatCore({ /* existing args, plus: */ });
```

**Non-stream** (`result.success` and body is not SSE, or `body.stream` is false): `recordSuccess(breakerName); semaphoreRelease(); return result.response`.

**SSE** (`result.success` and streaming): do **not** release in `finally`. Wrap the existing `onStreamComplete` / disconnect path used by `handleChatCore` (see `buildOnStreamComplete` and `streamController.onDisconnect` in `open-sse/handlers/chatCore/streamingHandler.js`) so that:

- complete → `recordSuccess(breakerName); semaphoreRelease();`
- disconnect / stream error → `semaphoreRelease();` (do not `recordSuccess`; if the core already surfaced a 5xx, `recordFailure` already ran)

**Non-success:** if `shouldRecordBreakerFailure(result.status)` then `recordFailure(...)`. Always `semaphoreRelease()` here. Then existing Antigravity 409/429 + `markAccountUnavailable`.

When `!credentials || credentials.allRateLimited` and the reason is breakers, pass `HTTP_STATUS.SERVICE_UNAVAILABLE` (503) into `unavailableResponse`, ignoring a stale `lastErrorCode` of 401/403.

Keep `markAccountUnavailable` after this. 429 still only goes there.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `cd tests && npm test -- unit/circuit-breaker.test.js unit/account-semaphore.test.js unit/account-breaker-routing.test.js unit/chat-account-resilience.test.js unit/antigravity-quota-routing.test.js ../tests/translator/tool-loop-breaker.test.js`

Expected: PASS. Tool-loop breaker tests must still pass.

- [ ] **Step 5: Commit**

```bash
git add src/sse/handlers/chat.js tests/unit/chat-account-resilience.test.js
git commit -m "$(cat <<'EOF'
feat(chat): gate each account with semaphore and breaker

Hold the 3-wide slot until the stream ends. Count 5xx/timeout
toward the breaker; leave 429 to existing account cooldown.
EOF
)"
```

---

### Task 5: Dashboard API + badges

**Files:**
- Create: `src/app/api/providers/circuit-breakers/route.js`
- Create: `src/app/api/providers/circuit-breakers/[name]/reset/route.js`
- Create: `src/shared/hooks/useCircuitBreakers.js`
- Create: `src/app/(dashboard)/dashboard/providers/components/CircuitBreakerBadge.js`
- Modify: `src/app/(dashboard)/dashboard/providers/[id]/ConnectionRow.js`
- Modify: `src/app/(dashboard)/dashboard/providers/[id]/page.js` — pass `circuitBreaker` + `onResetCircuit` into `ConnectionRow`
- Modify: `src/app/(dashboard)/dashboard/providers/page.js` — summary badge per provider card

**Interfaces:**
- Consumes: `getAllCircuitBreakerStatuses`, `resetCircuitBreaker` from `circuitBreaker.js`; `buildAccountBreakerName`.
- Produces:
  - `GET /api/providers/circuit-breakers` → `{ breakers: getAllCircuitBreakerStatuses() }`
  - `POST /api/providers/circuit-breakers/[name]/reset` → `{ ok: true }` after `resetCircuitBreaker(decodeURIComponent(name))`
  - Badge renders nothing when `status` missing or `CLOSED`
  - ConnectionRow reset calls POST with `glm:acc-id` and refreshes

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/circuit-breaker.test.js`:

```js
it("reset of one name does not close another", () => {
  getCircuitBreaker("glm:a", { failureThreshold: 1, isFailure: () => true });
  getCircuitBreaker("glm:b", { failureThreshold: 1, isFailure: () => true });
  recordFailure("glm:a", { statusCode: 500 });
  recordFailure("glm:b", { statusCode: 500 });
  resetCircuitBreaker("glm:a");
  expect(canExecute("glm:a")).toBe(true);
  expect(canExecute("glm:b")).toBe(false);
});
```

No React component test in this repo's unit suite unless a pattern already exists. Badge is presentational: copy VansRouter `CircuitBreakerBadge.js` (CLOSED hidden; OPEN shows refresh).

- [ ] **Step 2: Run test to verify it fails**

If Task 1 reset test already covers isolation, this step's new test should **pass** once Task 1 is done. If it fails, fix `resetCircuitBreaker` to only touch `registry.get(name)`.

- [ ] **Step 3: Write minimal implementation**

`src/app/api/providers/circuit-breakers/route.js`:

```js
import { NextResponse } from "next/server";
import { getAllCircuitBreakerStatuses } from "open-sse/utils/circuitBreaker.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ breakers: getAllCircuitBreakerStatuses() });
}
```

`src/app/api/providers/circuit-breakers/[name]/reset/route.js`:

```js
import { NextResponse } from "next/server";
import { resetCircuitBreaker } from "open-sse/utils/circuitBreaker.js";

export const dynamic = "force-dynamic";

export async function POST(_req, { params }) {
  const { name } = await params;
  if (!name) return NextResponse.json({ error: "missing name" }, { status: 400 });
  resetCircuitBreaker(decodeURIComponent(name));
  return NextResponse.json({ ok: true });
}
```

Hook `src/shared/hooks/useCircuitBreakers.js` — poll GET every 5s **only while any breaker is not CLOSED**; otherwise fetch on mount / after reset. Export it from `src/shared/hooks/index.js`. `getCircuitBreakerForConnection(providerId, connectionId)` matches `name === `${providerId}:${connectionId}``. `getOpenCountForProvider(providerId)` counts statuses where `name.startsWith(providerId + ":")` and `state !== "CLOSED"`.

`CircuitBreakerBadge` — copy Vans file; labels can stay English to match the rest of the dashboard (`Degraded`, `Circuit Open`, `Recovering`).

`ConnectionRow`: add optional props `circuitBreaker`, `onResetCircuit` **and** extend `ConnectionRow.propTypes` (file already has them at ~line 280). Render `<CircuitBreakerBadge status={circuitBreaker} onReset={onResetCircuit} />` next to the existing status badge. Labels stay English.

Provider detail page: `useCircuitBreakers()`, pass into each `ConnectionRow`.

Providers list page: if `getOpenCountForProvider(id) > 0`, show a small Badge `{n} paused` (or `1 account paused`). No badge when 0.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `cd tests && npm test -- unit/circuit-breaker.test.js unit/account-breaker-routing.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/providers/circuit-breakers src/shared/hooks/useCircuitBreakers.js \
  src/app/\(dashboard\)/dashboard/providers/components/CircuitBreakerBadge.js \
  src/app/\(dashboard\)/dashboard/providers/\[id\]/ConnectionRow.js \
  src/app/\(dashboard\)/dashboard/providers/\[id\]/page.js \
  src/app/\(dashboard\)/dashboard/providers/page.js \
  tests/unit/circuit-breaker.test.js
git commit -m "$(cat <<'EOF'
feat(dashboard): show and reset per-account circuit breakers

Badge on the connection row and a paused-count on the provider
grid. Reset closes only that account's breaker.
EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Per-account breaker `provider:connectionId` | 1, 3 |
| 5xx/timeout count; 429 does not | 1, 4 |
| Other accounts of same provider still used | 3 |
| All OPEN → 503 Retry-After / combo | 3 (combo already treats 503) |
| Semaphore default 3; 0/null bypass; other account unaffected | 2, 4 |
| In-memory only, restart clears | 1 (process-local Map; `resetAll` in tests is not a restart — do not claim it is) |
| Stream-lifetime semaphore | 4 |
| `isBlocked` vs mutating `canExecute` | 1, 3, 4 |
| Force 503 so combo falls through | 3, 4 |
| No proxy-fitness, no settings cache, no new page | File map — those files are not created |
| Antigravity tool-loop untouched | Task 4 regression test |
| Dashboard badge + per-account reset | 5 |
| Chat-only semaphore | 4 |

No TBD/TODO. Names (`buildAccountBreakerName`, `isBlocked`, `canExecute`, `getRetryAfterMs`, `recordFailure`, `recordSuccess`, `shouldRecordBreakerFailure`) are consistent across tasks.
