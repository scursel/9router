import { describe, expect, it } from "vitest";
import { buildComboUsageMap, usageItemMatchesCombo } from "../../src/shared/utils/usageFilters.js";

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

describe("buildComboUsageMap", () => {
  const byModel = {
    "claude-sonnet-4 (bai)": { provider: "bai", rawModel: "claude-sonnet-4", requests: 2, cost: 0.1 },
    "free (orcarouter)": { provider: "orcarouter", rawModel: "free", requests: 1, cost: 0 },
    "claude-opus-4 (claude)": { provider: "claude", rawModel: "claude-opus-4", requests: 9, cost: 1 },
  };

  it("only includes combos that have member usage", () => {
    const combos = [
      { name: "cheap-stack", models: ["bai/claude-sonnet-4", "orcarouter/free"] },
      { name: "unused-stack", models: ["bai/never-used"] },
    ];
    const map = buildComboUsageMap(byModel, combos);
    const comboNames = [...new Set(Object.values(map).map((r) => r.comboName))];
    expect(comboNames).toEqual(["cheap-stack"]);
    expect(Object.keys(map)).toHaveLength(2);
  });
});
