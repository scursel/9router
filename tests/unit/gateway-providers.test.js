import { describe, expect, it } from "vitest";

import REGISTRY from "../../open-sse/providers/registry/index.js";
import { PROVIDERS, PROVIDER_MODELS } from "../../open-sse/providers/index.js";

const EXPECTED = {
  bai: { baseUrl: "https://api.b.ai/v1/chat/completions", modelsUrl: "https://api.b.ai/v1/models" },
  orcarouter: { baseUrl: "https://api.orcarouter.ai/v1/chat/completions", modelsUrl: "https://api.orcarouter.ai/v1/models" },
  dahl: { baseUrl: "https://inference.dahl.global/v1/chat/completions", modelsUrl: "https://inference.dahl.global/v1/models" },
};

for (const [id, urls] of Object.entries(EXPECTED)) {
  describe(`${id} native provider`, () => {
    const entry = REGISTRY.find((e) => e.id === id);

    it("is registered as an OpenAI-compatible apikey provider", () => {
      expect(entry).toBeDefined();
      expect(entry.category).toBe("apikey");
      expect(entry.transport.baseUrl).toBe(urls.baseUrl);
    });

    it("exposes a GET /models endpoint with an OpenAI-compatible parser", () => {
      expect(entry.modelsFetcher).toMatchObject({ url: urls.modelsUrl, type: "openai" });
      expect(entry.transport.validateUrl).toBe(urls.modelsUrl);
    });

    it("enables dynamic model discovery and passthrough", () => {
      expect(entry.passthroughModels).toBe(true);
    });

    it("builds into the runtime PROVIDERS map with the openai format default", () => {
      expect(PROVIDERS[id]).toBeDefined();
      expect(PROVIDERS[id].format).toBe("openai");
      expect(PROVIDERS[id].baseUrl).toBe(urls.baseUrl);
    });

    it("advertises OpenAI-style responses, never a POST-only endpoint", () => {
      expect(entry.modelsFetcher.type).not.toMatch(/antigravity|oauth/i);
    });
  });
}

describe("gateway provider seeds", () => {
  it("orcarouter seeds its first-party models for offline fallback", () => {
    const ids = (PROVIDER_MODELS.orcarouter || []).map((m) => m.id);
    expect(ids).toContain("orcarouter/fusion");
  });

  it("dahl seeds its live snapshot for offline fallback", () => {
    const ids = (PROVIDER_MODELS.dahl || []).map((m) => m.id);
    expect(ids.length).toBeGreaterThan(0);
  });

  it("keeps every registry id unique after adding the gateways", () => {
    const ids = REGISTRY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
