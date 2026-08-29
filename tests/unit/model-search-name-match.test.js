import { describe, expect, it } from "vitest";

// Replicate the pure model/provider filtering logic from ModelSelectModal.js
function filterGroupedModels(groupedModels, searchQuery, capFilter) {
  const query = searchQuery.trim().toLowerCase();
  const filtered = {};

  Object.entries(groupedModels).forEach(([providerId, group]) => {
    let models = group.models;
    if (capFilter) {
      models = models.filter((m) => m.caps?.[capFilter] === true);
      if (models.length === 0) return;
    }
    if (query) {
      const providerNameMatches = group.name.toLowerCase().includes(query);
      if (!providerNameMatches) {
        models = models.filter(
          (m) =>
            m.name.toLowerCase().includes(query) ||
            m.id.toLowerCase().includes(query)
        );
        if (models.length === 0) return;
      }
    }
    filtered[providerId] = {
      ...group,
      models,
    };
  });

  return filtered;
}

describe("ModelSelectModal provider search filter logic", () => {
  const sampleGroupedModels = {
    nvidia: {
      name: "NVIDIA NIM",
      models: [
        { id: "minimaxai/minimax-m3", name: "MiniMax M3" },
        { id: "deepseek-ai/deepseek-v4-flash", name: "DeepSeek V4 Flash" },
      ],
    },
    deepseek: {
      name: "DeepSeek",
      models: [
        { id: "deepseek-chat", name: "DeepSeek V3.2 Chat" },
      ],
    },
    openai: {
      name: "OpenAI",
      models: [
        { id: "gpt-4o", name: "GPT-4o" },
      ],
    },
  };

  it("keeps provider when provider name matches query even if no model name matches query", () => {
    // Searching for "nvidia" matches group "NVIDIA NIM", but no model has "nvidia" in name/id
    const result = filterGroupedModels(sampleGroupedModels, "nvidia");
    expect(result.nvidia).toBeDefined();
    expect(result.nvidia.models).toHaveLength(2);
    expect(result.deepseek).toBeUndefined();
    expect(result.openai).toBeUndefined();
  });

  it("filters models when provider name does not match but model name/id matches", () => {
    // Searching for "flash" matches model "DeepSeek V4 Flash" under nvidia
    const result = filterGroupedModels(sampleGroupedModels, "flash");
    expect(result.nvidia).toBeDefined();
    expect(result.nvidia.models).toHaveLength(1);
    expect(result.nvidia.models[0].id).toBe("deepseek-ai/deepseek-v4-flash");
    expect(result.deepseek).toBeUndefined();
    expect(result.openai).toBeUndefined();
  });

  it("excludes provider when neither provider name nor any model matches query", () => {
    const result = filterGroupedModels(sampleGroupedModels, "nonexistent");
    expect(Object.keys(result)).toHaveLength(0);
  });
});
