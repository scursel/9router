import { describe, expect, it } from "vitest";
import { parseAntigravityQuotaModels } from "../../open-sse/services/usage/google.js";

describe("Antigravity quota model selection", () => {
  it("includes tiered and dynamically recommended models", () => {
    const quotas = parseAntigravityQuotaModels({
      agentModelSorts: [{ groups: [{ modelIds: ["future-recommended-model"] }] }],
      models: {
        "gemini-3.7-flash-tiered": {
          displayName: "Gemini tiered",
          quotaInfo: { remainingFraction: 0.25, resetTime: "2030-01-01T00:00:00Z" },
        },
        "future-recommended-model": { quotaInfo: { remainingFraction: 0.5 } },
        "not-recommended": { quotaInfo: { remainingFraction: 0.75 } },
      },
    });

    expect(Object.keys(quotas)).toEqual([
      "gemini-3.7-flash-tiered",
      "future-recommended-model",
    ]);
    expect(quotas["gemini-3.7-flash-tiered"]).toMatchObject({
      used: 750,
      total: 1000,
      remainingPercentage: 25,
      displayName: "Gemini tiered",
    });
  });

  it("drops deprecated aliases when their replacement exists", () => {
    const quotas = parseAntigravityQuotaModels({
      deprecatedModelIds: {
        "gemini-3-flash": { newModelId: "gemini-3-flash-agent" },
      },
      models: {
        "gemini-3-flash": { quotaInfo: { remainingFraction: 1 } },
        "gemini-3-flash-agent": { quotaInfo: { remainingFraction: 0.4 } },
      },
    });

    expect(quotas["gemini-3-flash"]).toBeUndefined();
    expect(quotas["gemini-3-flash-agent"].remainingPercentage).toBe(40);
  });

  it("treats an omitted proto3 fraction as exhausted and skips internals", () => {
    const quotas = parseAntigravityQuotaModels({
      models: {
        "claude-sonnet-4-6": { quotaInfo: {} },
        "gemini-pro-agent": { isInternal: true, quotaInfo: { remainingFraction: 1 } },
        "tab_internal": { quotaInfo: { remainingFraction: 1 } },
      },
    });

    expect(quotas["claude-sonnet-4-6"]).toMatchObject({
      used: 1000,
      total: 1000,
      remainingPercentage: 0,
    });
    expect(Object.keys(quotas)).toEqual(["claude-sonnet-4-6"]);
  });
});
