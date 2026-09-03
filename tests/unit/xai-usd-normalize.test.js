import { describe, expect, it } from "vitest";

import { normalizeXaiUsage } from "open-sse/services/usage/xaiNormalize.js";

describe("xAI/Grok USD normalization", () => {
  it("renames the Prepaid balance to a USD quota", () => {
    const out = normalizeXaiUsage({
      plan: "Grok Build",
      rawConfig: { creditUsagePercent: { val: 40 }, currentPeriod: { type: "USAGE_PERIOD_TYPE_WEEKLY" } },
      quotas: {
        Prepaid: { used: 0, total: 12.5, remainingPercentage: 100, resetAt: null, unlimited: false },
      },
    });

    expect(out.quotas["Prepaid balance (USD)"]).toEqual({
      used: 0,
      total: 12.5,
      remainingPercentage: 100,
      resetAt: null,
      unlimited: false,
    });
    expect(out.quotas.Prepaid).toBeUndefined();
  });

  it("derives a weekly subscription row from creditUsagePercent when none exists", () => {
    const out = normalizeXaiUsage({
      plan: "X Premium",
      rawConfig: { creditUsagePercent: { val: 64.2 }, currentPeriod: { type: "USAGE_PERIOD_TYPE_WEEKLY", end: "2030-01-01T00:00:00Z" } },
      quotas: {},
    });

    expect(out.quotas["Subscription usage (weekly)"]).toMatchObject({
      used: 64.2,
      total: 100,
      resetAt: "2030-01-01T00:00:00.000Z",
    });
  });

  it("drops the no-numeric-quota message when the weekly row was derived", () => {
    const out = normalizeXaiUsage({
      plan: "SuperGrok",
      message: "Subscription access is active; Grok does not expose a numeric included quota.",
      rawConfig: { creditUsagePercent: 30, currentPeriod: { type: "USAGE_PERIOD_TYPE_WEEKLY" } },
      quotas: {},
    });

    expect(out.message).toBeUndefined();
    expect(out.quotas["Subscription usage (weekly)"]).toBeDefined();
  });

  it("keeps the message when nothing could be derived", () => {
    const out = normalizeXaiUsage({
      plan: "Grok Build",
      message: "Grok Build connected, but no credit allotment was returned. Free promo may be exhausted.",
      rawConfig: {},
      quotas: {},
    });

    expect(out.message).toBeDefined();
    expect(out.quotas).toEqual({});
  });

  it("removes rawConfig from the payload", () => {
    const out = normalizeXaiUsage({
      plan: "Grok Build",
      rawConfig: { prepaidBalance: { val: 500 } },
      quotas: { "Weekly SuperGrok": { used: 10, total: 100, remainingPercentage: 90, resetAt: null, unlimited: false } },
    });

    expect(out.rawConfig).toBeUndefined();
    expect(out.quotas["Weekly SuperGrok"]).toBeDefined();
  });

  it("leaves non-quota payloads untouched", () => {
    const error = { message: "Grok CLI usage error: boom" };
    expect(normalizeXaiUsage(error)).toBe(error);
  });
});
