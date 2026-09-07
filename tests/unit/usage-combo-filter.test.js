import { describe, expect, it } from "vitest";
import { filterUsageMap, usageItemMatchesCombo } from "../../src/shared/utils/usageFilters.js";

describe("usageItemMatchesCombo", () => {
  const combo = {
    name: "cheap-stack",
    models: ["bai/claude-sonnet-4", "orcarouter/free", "muse-spark-1.2"],
  };

  it("matches provider/model members", () => {
    expect(usageItemMatchesCombo({ provider: "bai", rawModel: "claude-sonnet-4" }, combo)).toBe(true);
    expect(usageItemMatchesCombo({ provider: "orcarouter", rawModel: "free" }, combo)).toBe(true);
  });

  it("matches bare model members", () => {
    expect(usageItemMatchesCombo({ provider: "opencode", rawModel: "muse-spark-1.2" }, combo)).toBe(true);
  });

  it("rejects unrelated rows", () => {
    expect(usageItemMatchesCombo({ provider: "bai", rawModel: "other-model" }, combo)).toBe(false);
    expect(usageItemMatchesCombo({ provider: "claude", rawModel: "claude-sonnet-4" }, combo)).toBe(false);
  });
});

describe("filterUsageMap", () => {
  const data = {
    a: { provider: "bai", rawModel: "claude-sonnet-4", requests: 2 },
    b: { provider: "orcarouter", rawModel: "free", requests: 1 },
    c: { provider: "claude", rawModel: "claude-opus-4", requests: 9 },
  };

  it("filters by provider", () => {
    expect(Object.keys(filterUsageMap(data, { providerFilter: "bai", comboFilter: "all", combos: [] }))).toEqual(["a"]);
  });

  it("filters by combo members", () => {
    const combos = [{ name: "cheap-stack", models: ["bai/claude-sonnet-4", "orcarouter/free"] }];
    expect(Object.keys(filterUsageMap(data, { providerFilter: "all", comboFilter: "cheap-stack", combos }))).toEqual(["a", "b"]);
  });
});
