import { describe, expect, it } from "vitest";
import {
  collectImportableModels,
  connectionCanSyncCatalog,
  providerCanImportModels,
  stripProviderPrefix,
} from "@/shared/utils/importProviderModels.js";
import REGISTRY from "open-sse/providers/registry/index.js";

describe("stripProviderPrefix", () => {
  it("strips the provider alias or id prefix from a listed model id", () => {
    expect(stripProviderPrefix("cl/anthropic/claude-sonnet-4.6", ["cl", "cline"])).toBe(
      "anthropic/claude-sonnet-4.6",
    );
    expect(stripProviderPrefix("qoder/auto", ["qo", "qoder"])).toBe("auto");
    expect(stripProviderPrefix("anthropic/claude-sonnet-4.6", ["cl", "cline"])).toBe(
      "anthropic/claude-sonnet-4.6",
    );
  });
});

describe("collectImportableModels", () => {
  const prefixes = ["cl", "cline"];
  const existingIds = new Set(["already-there"]);

  it("returns every listed id that is not already added", () => {
    const models = [
      { id: "anthropic/claude-sonnet-4.6" },
      { id: "already-there" },
      { id: "openai/gpt-5.4", pricing: { prompt: "0.001", completion: "0.002" } },
    ];
    expect(collectImportableModels({ models, existingIds, prefixes }).map((m) => m.id)).toEqual([
      "anthropic/claude-sonnet-4.6",
      "openai/gpt-5.4",
    ]);
  });

  it("keeps only free models when freeOnly is set", () => {
    const models = [
      { id: "openrouter/free-model:free" },
      { id: "paid/model", pricing: { prompt: "0.001", completion: "0.002" } },
      { id: "zero-price", pricing: { prompt: "0", completion: "0" } },
      { id: "flagged", is_free: true },
    ];
    expect(
      collectImportableModels({
        models,
        existingIds: new Set(),
        prefixes,
        freeOnly: true,
        providerId: "cline",
      }).map((m) => m.id),
    ).toEqual(["openrouter/free-model:free", "zero-price", "flagged"]);
  });

  it("does not treat unknown-price models as free", () => {
    const models = [{ id: "mystery-model" }, { id: "known:free" }];
    expect(
      collectImportableModels({
        models,
        existingIds: new Set(),
        prefixes,
        freeOnly: true,
      }).map((m) => m.id),
    ).toEqual(["known:free"]);
  });
});

describe("providerCanImportModels", () => {
  it("is true when the provider exposes a modelsFetcher", () => {
    expect(
      providerCanImportModels({ modelsFetcher: { url: "https://api.cline.bot/api/v1/models" } }),
    ).toBe(true);
  });

  it("is true for an active OpenAI/Anthropic-compatible node", () => {
    expect(providerCanImportModels({ hasActiveConnection: true, isCompatible: true })).toBe(true);
  });

  it("is true for an active connection with a chat baseUrl that can list /models", () => {
    expect(
      providerCanImportModels({
        hasActiveConnection: true,
        baseUrl: "https://api.example.com/v1",
      }),
    ).toBe(true);
  });

  it("is false for a random active connection that cannot list models", () => {
    expect(providerCanImportModels({ hasActiveConnection: true })).toBe(false);
  });

  it("is false with neither a fetcher nor a connection", () => {
    expect(providerCanImportModels({})).toBe(false);
  });
});

describe("connectionCanSyncCatalog", () => {
  it("is true when the provider has a modelsFetcher", () => {
    expect(
      connectionCanSyncCatalog({ modelsFetcher: { url: "https://api.cline.bot/api/v1/models" } }),
    ).toBe(true);
  });

  it("is true when the account has a baseUrl", () => {
    expect(connectionCanSyncCatalog({ baseUrl: "https://api.example.com/v1" })).toBe(true);
  });

  it("is false when neither a fetcher nor a baseUrl exists", () => {
    expect(connectionCanSyncCatalog({})).toBe(false);
  });
});

describe("Cline catalog", () => {
  it("points modelsFetcher at Cline's own /v1/models, same host as chat", () => {
    const cline = REGISTRY.find((r) => r.id === "cline");
    expect(cline.modelsFetcher).toEqual({
      url: "https://api.cline.bot/api/v1/models",
      type: "openai",
    });
    expect(cline.transport.baseUrl).toContain("api.cline.bot");
  });

  it("keeps ClinePass on the same Cline models URL", () => {
    const clinepass = REGISTRY.find((r) => r.id === "clinepass");
    expect(clinepass.modelsFetcher.url).toBe("https://api.cline.bot/api/v1/models");
  });
});
