import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildCosts } from "../../src/lib/modelCatalog/sync.js";
import {
  __setCatalogCacheForTests,
  getCatalogCost,
  invalidateCatalog,
} from "../../open-sse/providers/catalogOverride.js";

describe("buildCosts OpenRouter index", () => {
  it("always indexes openrouter costs by base model id", () => {
    const costs = buildCosts({
      openrouter: {
        models: {
          "anthropic/claude-sonnet-4": { cost: { input: 3, output: 15 } },
          "meta-llama/llama-4-maverick:free": { cost: { input: 0, output: 0 } },
          "meta-llama/llama-4-maverick": { cost: { input: 0.15, output: 0.6 } },
        },
      },
      orcarouter: {
        models: {
          "orcarouter/free": { cost: { input: 0, output: 0 } },
        },
      },
    });

    expect(costs.openrouter["claude-sonnet-4"]).toEqual({ input: 3, output: 15 });
    // Paid variant wins over :free when both normalize to the same base id.
    expect(costs.openrouter["llama-4-maverick"]).toEqual({ input: 0.15, output: 0.6 });
    expect(costs.orcarouter.free).toEqual({ input: 0, output: 0 });
  });
});

describe("getCatalogCost OpenRouter fallback", () => {
  beforeEach(() => {
    invalidateCatalog();
    __setCatalogCacheForTests({
      models: {},
      providers: {},
      costs: {
        orcarouter: { free: { input: 0, output: 0 } },
        openrouter: {
          "claude-sonnet-4": { input: 3, output: 15 },
          "llama-4-maverick": { input: 0.15, output: 0.6 },
        },
      },
    });
  });

  it("returns provider-specific cost when present", () => {
    expect(getCatalogCost("orcarouter", "free")).toEqual({ input: 0, output: 0 });
  });

  it("falls back to openrouter by base id when provider has no cost", () => {
    expect(getCatalogCost("bai", "claude-sonnet-4")).toEqual({ input: 3, output: 15 });
    expect(getCatalogCost("dahl", "meta/llama-4-maverick")).toEqual({ input: 0.15, output: 0.6 });
  });

  it("returns null when neither provider nor openrouter know the model", () => {
    expect(getCatalogCost("bai", "totally-unknown-xyz")).toBeNull();
  });
});

describe("pricingRepo OpenRouter catalog fallback", () => {
  it("uses openrouter catalog rates when static tables miss", async () => {
    vi.resetModules();
    const catalog = await import("../../open-sse/providers/catalogOverride.js");
    catalog.__setCatalogCacheForTests({
      models: {},
      providers: {},
      costs: {
        openrouter: {
          "mystery-model-xyz": { input: 1.25, output: 5 },
        },
      },
    });
    const { getPricingForModel } = await import("../../src/lib/db/repos/pricingRepo.js");
    const pricing = await getPricingForModel("bai", "mystery-model-xyz");
    expect(pricing).toMatchObject({ input: 1.25, output: 5 });
  });
});
