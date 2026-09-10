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
  assertPublicUrlResolved: vi.fn(async () => {}),
}));

import {
  isEmptyWebSuccessBody,
  isTruthyFallbackOnEmpty,
} from "@/sse/services/webRouting.js";
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

function okSearch(results, provider = "brave-search") {
  return {
    success: true,
    response: new Response(JSON.stringify({ provider, query: "q", results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  };
}

function errSearch(status, error) {
  return {
    success: false,
    status,
    error,
    response: new Response(JSON.stringify({ error: { message: error } }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  };
}

describe("empty detection helpers", () => {
  it("treats empty results array as empty search success", () => {
    expect(isEmptyWebSuccessBody("webSearch", { results: [] })).toBe(true);
    expect(isEmptyWebSuccessBody("webSearch", { results: [{ title: "x" }] })).toBe(false);
  });

  it("does not treat missing/malformed results as empty", () => {
    expect(isEmptyWebSuccessBody("webSearch", { results: null })).toBe(false);
    expect(isEmptyWebSuccessBody("webSearch", {})).toBe(false);
    expect(isEmptyWebSuccessBody("webSearch", null)).toBe(false);
  });

  it("treats whitespace-only fetch text as empty", () => {
    expect(isEmptyWebSuccessBody("webFetch", { content: { text: "   " } })).toBe(true);
    expect(isEmptyWebSuccessBody("webFetch", { content: { text: "hi" } })).toBe(false);
  });

  it("fallback_on_empty is strict boolean true only", () => {
    expect(isTruthyFallbackOnEmpty(true)).toBe(true);
    expect(isTruthyFallbackOnEmpty(false)).toBe(false);
    expect(isTruthyFallbackOnEmpty("true")).toBe(false);
    expect(isTruthyFallbackOnEmpty(1)).toBe(false);
  });
});

describe("web combo fallback_on_empty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handleSearchCore.mockReset();
    mocks.handleFetchCore.mockReset();
    mocks.markAccountUnavailable.mockReset();
    mocks.getSettings.mockResolvedValue({ requireApiKey: false, comboStrategy: "fallback" });
    mocks.getProviderConnections.mockResolvedValue([]);
    mocks.checkAndRefreshToken.mockImplementation(async (_p, c) => c);
    mocks.getProviderCredentials.mockResolvedValue({
      apiKey: "test-key",
      connectionId: "conn-1",
      connectionName: "Test",
    });
    mocks.getComboByName.mockResolvedValue({
      name: "search-combo",
      kind: "webSearch",
      models: ["brave/search", "tavily/search"],
    });
  });

  it("without flag, empty first member is returned (no hidden fallback)", async () => {
    mocks.handleSearchCore
      .mockResolvedValueOnce(okSearch([]))
      .mockResolvedValueOnce(okSearch([{ title: "hit" }], "tavily"));

    const res = await handleSearch(searchRequest({
      model: "search-combo",
      query: "hello",
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(mocks.handleSearchCore).toHaveBeenCalledTimes(1);
    expect(mocks.markAccountUnavailable).not.toHaveBeenCalled();
  });

  it("with flag, empty first then useful second", async () => {
    mocks.handleSearchCore
      .mockResolvedValueOnce(okSearch([]))
      .mockResolvedValueOnce(okSearch([{ title: "hit" }], "tavily"));

    const res = await handleSearch(searchRequest({
      model: "search-combo",
      query: "hello",
      fallback_on_empty: true,
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([{ title: "hit" }]);
    expect(body.provider).toBe("tavily");
    expect(mocks.handleSearchCore).toHaveBeenCalledTimes(2);
    expect(mocks.markAccountUnavailable).not.toHaveBeenCalled();
  });

  it("with flag, useful first makes no extra call", async () => {
    mocks.handleSearchCore.mockResolvedValueOnce(okSearch([{ title: "first" }]));

    const res = await handleSearch(searchRequest({
      model: "search-combo",
      query: "hello",
      fallback_on_empty: true,
    }));
    expect(res.status).toBe(200);
    expect(mocks.handleSearchCore).toHaveBeenCalledTimes(1);
  });

  it("with flag, all empty returns empty envelope without inventing upstream outage", async () => {
    mocks.handleSearchCore
      .mockResolvedValueOnce(okSearch([]))
      .mockResolvedValueOnce(okSearch([], "tavily"));

    const res = await handleSearch(searchRequest({
      model: "search-combo",
      query: "hello",
      fallback_on_empty: true,
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(mocks.markAccountUnavailable).not.toHaveBeenCalled();
  });

  it("with flag, empty then non-fallbackable error returns the error", async () => {
    mocks.handleSearchCore
      .mockResolvedValueOnce(okSearch([]))
      .mockResolvedValueOnce(errSearch(400, "bad query"));
    mocks.markAccountUnavailable.mockResolvedValue({ shouldFallback: false });

    const res = await handleSearch(searchRequest({
      model: "search-combo",
      query: "hello",
      fallback_on_empty: true,
    }));
    expect(res.status).toBe(400);
    expect(mocks.handleSearchCore).toHaveBeenCalledTimes(2);
  });

  it("preserves request filters across empty fallback", async () => {
    mocks.handleSearchCore
      .mockResolvedValueOnce(okSearch([]))
      .mockResolvedValueOnce(okSearch([{ title: "hit" }], "tavily"));

    await handleSearch(searchRequest({
      model: "search-combo",
      query: "hello",
      fallback_on_empty: true,
      max_results: 7,
      country: "br",
      language: "pt",
      domain_filter: ["example.com"],
    }));

    expect(mocks.handleSearchCore).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        body: expect.objectContaining({
          max_results: 7,
          country: "br",
          language: "pt",
          domain_filter: ["example.com"],
        }),
      }),
    );
    expect(mocks.handleSearchCore).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        body: expect.objectContaining({
          max_results: 7,
          country: "br",
          language: "pt",
          domain_filter: ["example.com"],
        }),
      }),
    );
  });

  it("direct provider call ignores fallback_on_empty (no hidden multi-provider fallback)", async () => {
    mocks.getComboByName.mockResolvedValue(null);
    mocks.handleSearchCore.mockResolvedValueOnce(okSearch([]));

    const res = await handleSearch(searchRequest({
      model: "brave/search",
      query: "hello",
      fallback_on_empty: true,
    }));
    expect(res.status).toBe(200);
    expect(mocks.handleSearchCore).toHaveBeenCalledTimes(1);
  });

  it("fetch combo empty content falls through when opted in", async () => {
    mocks.getComboByName.mockResolvedValue({
      name: "fetch-combo",
      kind: "webFetch",
      models: ["jina-reader/fetch", "tavily/fetch"],
    });
    mocks.handleFetchCore
      .mockResolvedValueOnce({
        success: true,
        data: { provider: "jina-reader", content: { text: "  ", format: "markdown", length: 2 } },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { provider: "tavily", content: { text: "article", format: "markdown", length: 7 } },
      });

    const res = await handleFetch(fetchRequest({
      model: "fetch-combo",
      url: "https://example.com/a",
      fallback_on_empty: true,
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content.text).toBe("article");
    expect(mocks.handleFetchCore).toHaveBeenCalledTimes(2);
    expect(mocks.markAccountUnavailable).not.toHaveBeenCalled();
  });
});

describe("web diagnostics opt-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handleSearchCore.mockReset();
    mocks.handleFetchCore.mockReset();
    mocks.markAccountUnavailable.mockReset();
    mocks.getSettings.mockResolvedValue({ requireApiKey: false, comboStrategy: "fallback" });
    mocks.getProviderConnections.mockResolvedValue([]);
    mocks.checkAndRefreshToken.mockImplementation(async (_p, c) => c);
    mocks.getProviderCredentials.mockResolvedValue({
      apiKey: "test-key",
      connectionId: "conn-1",
      connectionName: "Test",
    });
    mocks.getComboByName.mockResolvedValue({
      name: "search-combo",
      kind: "webSearch",
      models: ["brave/search", "tavily/search"],
    });
  });

  it("omits diagnostics by default", async () => {
    mocks.handleSearchCore.mockResolvedValueOnce(okSearch([{ title: "a" }]));
    const res = await handleSearch(searchRequest({ model: "search-combo", query: "q" }));
    const body = await res.json();
    expect(body.diagnostics).toBeUndefined();
  });

  it("includes additive diagnostics without secrets when opted in", async () => {
    mocks.handleSearchCore
      .mockResolvedValueOnce(okSearch([]))
      .mockResolvedValueOnce(okSearch([{ title: "hit" }], "tavily"));

    const res = await handleSearch(searchRequest({
      model: "search-combo",
      query: "secret-query-should-not-appear",
      fallback_on_empty: true,
      include_diagnostics: true,
    }));
    const body = await res.json();
    expect(body.diagnostics).toBeDefined();
    expect(Array.isArray(body.diagnostics.attempts)).toBe(true);
    expect(body.diagnostics.attempts.length).toBe(2);
    expect(body.diagnostics.attempts[0]).toEqual(expect.objectContaining({
      provider: "brave-search",
      outcome: "empty",
    }));
    expect(body.diagnostics.attempts[1]).toEqual(expect.objectContaining({
      provider: "tavily",
      outcome: "success",
    }));
    expect(body.diagnostics.fallback_reason).toBe("empty_results");
    const dumped = JSON.stringify(body.diagnostics);
    expect(dumped).not.toMatch(/secret-query/);
    expect(dumped).not.toMatch(/test-key/);
    expect(dumped).not.toMatch(/apiKey/i);
  });

  it("marks exhausted when all empty with diagnostics", async () => {
    mocks.handleSearchCore
      .mockResolvedValueOnce(okSearch([]))
      .mockResolvedValueOnce(okSearch([], "tavily"));

    const res = await handleSearch(searchRequest({
      model: "search-combo",
      query: "q",
      fallback_on_empty: true,
      include_diagnostics: true,
    }));
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(body.diagnostics.exhausted).toBe(true);
  });
});
