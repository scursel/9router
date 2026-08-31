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
