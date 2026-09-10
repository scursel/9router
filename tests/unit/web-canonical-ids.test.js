import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProviderCredentials: vi.fn(),
  markAccountUnavailable: vi.fn(),
  clearAccountError: vi.fn(),
  extractApiKey: vi.fn(() => null),
  isValidApiKey: vi.fn(),
  getSettings: vi.fn(),
  getComboByName: vi.fn(),
  getProviderConnections: vi.fn(),
  handleSearchCore: vi.fn(),
  handleFetchCore: vi.fn(),
  checkAndRefreshToken: vi.fn(),
  assertPublicUrlResolved: vi.fn(async () => {}),
}));

vi.mock("@/sse/services/auth.js", () => ({
  getProviderCredentials: mocks.getProviderCredentials,
  markAccountUnavailable: mocks.markAccountUnavailable,
  clearAccountError: mocks.clearAccountError,
  extractApiKey: mocks.extractApiKey,
  isValidApiKey: mocks.isValidApiKey,
}));

vi.mock("@/lib/localDb", () => ({
  getSettings: mocks.getSettings,
  getComboByName: mocks.getComboByName,
  getProviderConnections: mocks.getProviderConnections,
  getModelAliases: vi.fn(async () => ({})),
  getProviderNodes: vi.fn(async () => []),
}));

vi.mock("open-sse/handlers/search/index.js", () => ({
  handleSearchCore: mocks.handleSearchCore,
}));

vi.mock("open-sse/handlers/fetch/index.js", () => ({
  handleFetchCore: mocks.handleFetchCore,
}));

vi.mock("@/sse/services/tokenRefresh.js", () => ({
  checkAndRefreshToken: mocks.checkAndRefreshToken,
  updateProviderCredentials: vi.fn(),
}));

vi.mock("@/sse/utils/logger.js", () => ({
  request: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  maskKey: vi.fn(() => "masked"),
}));

vi.mock("@/shared/utils/ssrfGuard.js", () => ({
  assertPublicUrlResolved: mocks.assertPublicUrlResolved,
}));

import { resolveWebProviderId } from "@/sse/services/webRouting.js";
import { handleSearch } from "@/sse/handlers/search.js";
import { handleFetch } from "@/sse/handlers/fetch.js";

function searchRequest(body) {
  return new Request("http://localhost/v1/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fetchRequest(body) {
  return new Request("http://localhost/v1/web/fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("resolveWebProviderId", () => {
  it("accepts legacy alias and id for search", () => {
    expect(resolveWebProviderId("brave", "webSearch")).toEqual({ ok: true, providerId: "brave-search" });
    expect(resolveWebProviderId("brave-search", "webSearch")).toEqual({ ok: true, providerId: "brave-search" });
  });

  it("accepts catalog IDs with exact /search suffix", () => {
    expect(resolveWebProviderId("brave/search", "webSearch")).toEqual({ ok: true, providerId: "brave-search" });
    expect(resolveWebProviderId("brave-search/search", "webSearch")).toEqual({ ok: true, providerId: "brave-search" });
  });

  it("accepts catalog IDs with exact /fetch suffix", () => {
    expect(resolveWebProviderId("jina-reader/fetch", "webFetch")).toEqual({ ok: true, providerId: "jina-reader" });
    expect(resolveWebProviderId("tavily/fetch", "webFetch")).toEqual({ ok: true, providerId: "tavily" });
  });

  it("rejects cross-capability suffixes", () => {
    const wrongFetch = resolveWebProviderId("brave/fetch", "webSearch");
    expect(wrongFetch.ok).toBe(false);
    expect(wrongFetch.error).toMatch(/fetch/i);

    const wrongSearch = resolveWebProviderId("jina-reader/search", "webFetch");
    expect(wrongSearch.ok).toBe(false);
    expect(wrongSearch.error).toMatch(/search/i);
  });

  it("rejects unknown providers and extra path segments", () => {
    expect(resolveWebProviderId("nope/search", "webSearch").ok).toBe(false);
    expect(resolveWebProviderId("brave/search/extra", "webSearch").ok).toBe(false);
    expect(resolveWebProviderId("openai/gpt-4", "webSearch").ok).toBe(false);
  });

  it("rejects providers that lack the requested capability", () => {
    // openai has no searchConfig/fetchConfig in registry entry used by AI_PROVIDERS path for dedicated web
    const r = resolveWebProviderId("firecrawl", "webSearch");
    expect(r.ok).toBe(false);
  });
});

describe("web handlers accept catalog IDs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({ requireApiKey: false });
    mocks.getComboByName.mockResolvedValue(null);
    mocks.getProviderConnections.mockResolvedValue([]);
    mocks.checkAndRefreshToken.mockImplementation(async (_p, c) => c);
    mocks.getProviderCredentials.mockResolvedValue({
      apiKey: "test-key",
      connectionId: "conn-1",
      connectionName: "Test",
    });
    mocks.handleSearchCore.mockResolvedValue({
      success: true,
      response: new Response(JSON.stringify({ provider: "brave-search", results: [{ title: "a" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    });
    mocks.handleFetchCore.mockResolvedValue({
      success: true,
      data: { provider: "jina-reader", content: { text: "ok", format: "markdown", length: 2 } },
    });
  });

  it("routes brave/search to brave-search", async () => {
    const res = await handleSearch(searchRequest({ model: "brave/search", query: "hello" }));
    expect(res.status).toBe(200);
    expect(mocks.handleSearchCore).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ provider: "brave-search", query: "hello" }),
      }),
    );
  });

  it("routes jina-reader/fetch to jina-reader", async () => {
    const res = await handleFetch(fetchRequest({
      model: "jina-reader/fetch",
      url: "https://example.com/a",
    }));
    expect(res.status).toBe(200);
    expect(mocks.handleFetchCore).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "jina-reader" }),
    );
  });

  it("rejects /fetch on search endpoint", async () => {
    const res = await handleSearch(searchRequest({ model: "brave/fetch", query: "hello" }));
    expect(res.status).toBe(400);
    expect(mocks.handleSearchCore).not.toHaveBeenCalled();
  });

  it("rejects wrong-kind combo before upstream", async () => {
    mocks.getComboByName.mockResolvedValue({
      name: "llm-combo",
      kind: "llm",
      models: ["brave/search", "tavily/search"],
    });
    const res = await handleSearch(searchRequest({ model: "llm-combo", query: "hello" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body?.error?.message || body?.error || "")).toMatch(/kind/i);
    expect(mocks.handleSearchCore).not.toHaveBeenCalled();
  });

  it("accepts webSearch combo with catalog member ids", async () => {
    mocks.getComboByName.mockResolvedValue({
      name: "search-combo",
      kind: "webSearch",
      models: ["brave/search"],
    });
    const res = await handleSearch(searchRequest({ model: "search-combo", query: "hello" }));
    expect(res.status).toBe(200);
    expect(mocks.handleSearchCore).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ provider: "brave-search" }),
      }),
    );
  });
});
