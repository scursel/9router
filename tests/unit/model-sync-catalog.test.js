import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/models", () => ({
  getProviderConnections: vi.fn(),
  getProviderConnectionById: vi.fn(),
  updateProviderConnection: vi.fn(),
}));

// Keep sync hermetic: no DNS resolution in unit tests. The wrapper forwards
// to the per-test global fetch stub.
vi.mock("@/shared/utils/ssrfGuard.js", () => ({
  assertPublicUrl: vi.fn(),
  fetchPublic: (...args) => globalThis.fetch(...args),
}));
import {
  catalogStatus,
  classifyTier,
  getConnectionCatalog,
  isConnectionCatalogStale,
  normalizedModels,
  syncConnectionCatalog,
} from "../../src/lib/modelSync/connectionCatalog.js";
import {
  getProviderConnections,
  getProviderConnectionById,
  updateProviderConnection,
} from "@/models";

const OPENAI_LIST = (ids) => ({
  data: ids.map((id) => (typeof id === "string" ? { id } : id)),
});

function installFetch(handler) {
  globalThis.fetch = vi.fn(async (...args) => handler(...args));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("classifyTier", () => {
  it("marks explicit :free suffix and -free suffix as free", () => {
    expect(classifyTier({ id: "x/model:free" }).tier).toBe("free");
    expect(classifyTier({ id: "muse-spark-1.2-free" }).tier).toBe("free");
  });

  it("marks provider free flags as free", () => {
    expect(classifyTier({ id: "m", free: true }).tier).toBe("free");
    expect(classifyTier({ id: "m", is_free: true }).tier).toBe("free");
  });

  it("marks zero provider prices as free", () => {
    expect(classifyTier({ id: "m", pricing: { prompt: "0", completion: "0" } }).tier).toBe("free");
    expect(classifyTier({ id: "m", pricing: { prompt: 0, completion: 0 } }).tier).toBe("free");
  });

  it("marks nonzero provider prices as paid", () => {
    const out = classifyTier({ id: "m", pricing: { prompt: "0.000001", completion: "0.000005" } });
    expect(out.tier).toBe("paid");
    expect(out.tierSource).toBe("provider-price");
  });

  it("marks per-request pricing without token prices as credits, not paid", () => {
    const out = classifyTier({ id: "img-model", pricing: { request: "0.02" } });
    expect(out.tier).toBe("credits");
  });

  it("leaves models without any price signal as unknown, never paid", () => {
    const out = classifyTier({ id: "mystery-model" });
    expect(out.tier).toBe("unknown");
    expect(out.tier).not.toBe("paid");
  });

  it("applies curated rules only for the matching provider", () => {
    expect(classifyTier({ id: "orcarouter/free" }, { providerId: "orcarouter" }).tier).toBe("free");
    expect(classifyTier({ id: "orcarouter/free" }, { providerId: "other" }).tier).toBe("unknown");
  });
});

describe("normalizedModels", () => {
  it("builds a new catalog from an OpenAI-style list", () => {
    const models = normalizedModels(OPENAI_LIST(["a", "b"]), { providerId: "bai" });
    expect(models.map((m) => m.id)).toEqual(["a", "b"]);
    expect(models.every((m) => m.availability === undefined)).toBe(true);
  });

  it("never announces image/embedding ids as chat: kind is preserved", () => {
    const models = normalizedModels(
      OPENAI_LIST(["flux-pro", "text-embedding-3-small", "chat-model"]),
      { providerId: "bai" },
    );
    const byId = new Map(models.map((m) => [m.id, m.kind]));
    expect(byId.get("flux-pro")).toBe("image");
    expect(byId.get("text-embedding-3-small")).toBe("embedding");
    expect(byId.get("chat-model")).toBe("llm");
  });
});

describe("syncConnectionCatalog", () => {
  const conn = (overrides = {}) => ({
    id: "conn-1",
    provider: "bai",
    apiKey: "secret-key",
    providerSpecificData: {},
    ...overrides,
  });

  it("stores a new catalog with availability available and a success timestamp", async () => {
    installFetch(async () => new Response(JSON.stringify(OPENAI_LIST(["m1", "m2"])), { status: 200 }));
    const saved = [];
    updateProviderConnection.mockImplementation(async (id, data) => {
      saved.push(data);
      return null;
    });

    const result = await syncConnectionCatalog(conn());
    expect(result.updated).toBe(true);
    expect(result.available).toBe(2);
    const catalog = saved[0].modelCatalog;
    expect(catalog.lastSuccessAt).toBeTruthy();
    expect(catalog.lastError).toBeNull();
    expect(catalog.models.map((m) => m.availability)).toEqual(["available", "available"]);
  });

  it("preserves capabilities/context the provider did not resend on update", async () => {
    installFetch(async () => new Response(JSON.stringify(OPENAI_LIST([{ id: "m1" }])), { status: 200 }));
    const saved = [];
    updateProviderConnection.mockImplementation(async (id, data) => {
      saved.push(data);
      return null;
    });

    const previous = {
      models: [{ id: "m1", capabilities: { vision: true }, contextLength: 200000 }],
      lastSuccessAt: new Date(Date.now() - 1000).toISOString(),
      lastError: null,
    };
    await syncConnectionCatalog(conn({ modelCatalog: previous }));
    const merged = saved[0].modelCatalog.models.find((m) => m.id === "m1");
    expect(merged.capabilities).toEqual({ vision: true });
    expect(merged.contextLength).toBe(200000);
  });

  it("keeps the previous catalog on network failure and records the error", async () => {
    installFetch(async () => {
      throw new Error("boom");
    });
    const saved = [];
    updateProviderConnection.mockImplementation(async (id, data) => {
      saved.push(data);
      return null;
    });

    const previous = {
      models: [{ id: "m1", availability: "available", missingSyncs: 0 }],
      lastSuccessAt: new Date().toISOString(),
      lastError: null,
    };
    const result = await syncConnectionCatalog(conn({ modelCatalog: previous }));
    expect(result.updated).toBe(false);
    expect(saved[0].modelCatalog.models.map((m) => m.id)).toEqual(["m1"]);
    expect(saved[0].modelCatalog.lastError).toBeTruthy();
  });

  it("marks a model absent once as temporarily-absent, unavailable after two consecutive valid syncs", async () => {
    const saved = [];
    updateProviderConnection.mockImplementation(async (id, data) => {
      saved.push(data);
      return null;
    });

    installFetch(async () => new Response(JSON.stringify(OPENAI_LIST(["m1"])), { status: 200 }));
    const previous = {
      models: [
        { id: "m1", availability: "available", missingSyncs: 0 },
        { id: "m2", availability: "available", missingSyncs: 0 },
      ],
      lastSuccessAt: new Date().toISOString(),
      lastError: null,
    };
    await syncConnectionCatalog(conn({ modelCatalog: previous }));
    const first = saved[0].modelCatalog.models.find((m) => m.id === "m2");
    expect(first.availability).toBe("temporarily-absent");
    expect(first.missingSyncs).toBe(1);

    saved.length = 0;
    await syncConnectionCatalog(conn({ modelCatalog: saved[0]?.modelCatalog || {
      models: [
        { id: "m1", availability: "available", missingSyncs: 0 },
        { id: "m2", availability: "temporarily-absent", missingSyncs: 1 },
      ],
      lastSuccessAt: new Date().toISOString(),
      lastError: null,
    } }));
    const second = saved[0].modelCatalog.models.find((m) => m.id === "m2");
    expect(second.availability).toBe("unavailable");
    expect(second.missingSyncs).toBe(2);
  });

  it("never wipes the catalog on an empty 200 list", async () => {
    installFetch(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const saved = [];
    updateProviderConnection.mockImplementation(async (id, data) => {
      saved.push(data);
      return null;
    });
    const previous = {
      models: [{ id: "m1", availability: "available", missingSyncs: 0 }],
      lastSuccessAt: new Date().toISOString(),
      lastError: null,
    };
    const result = await syncConnectionCatalog(conn({ modelCatalog: previous }));
    expect(result.updated).toBe(false);
    expect(saved[0].modelCatalog.models.map((m) => m.id)).toEqual(["m1"]);
  });

  it("does not send the api key in a loggable form: auth travels as a header only", async () => {
    let seenHeaders = null;
    installFetch(async (url, init) => {
      seenHeaders = init?.headers;
      return new Response(JSON.stringify(OPENAI_LIST(["m1"])), { status: 200 });
    });
    updateProviderConnection.mockImplementation(async () => null);
    await syncConnectionCatalog(conn());
    expect(seenHeaders?.Authorization).toBe("Bearer secret-key");
  });

  it("syncs by account id, resolving the connection first", async () => {
    installFetch(async () => new Response(JSON.stringify(OPENAI_LIST(["m1"])), { status: 200 }));
    getProviderConnectionById.mockResolvedValue(conn());
    updateProviderConnection.mockResolvedValue(null);
    const result = await syncConnectionCatalog("conn-1");
    expect(getProviderConnectionById).toHaveBeenCalledWith("conn-1");
    expect(result.updated).toBe(true);
  });

  it("skips providers whose fetcher is not OpenAI-shaped instead of erroring", async () => {
    installFetch(async () => { throw new Error("must not be called"); });
    updateProviderConnection.mockImplementation(async () => null);
    const result = await syncConnectionCatalog(conn({ provider: "mimo-free" }));
    expect(result.skipped).toBe(true);
    expect(updateProviderConnection).not.toHaveBeenCalled();
  });
});

describe("catalog status helpers", () => {
  it("distinguishes never-synced, error, stale and ok", () => {
    expect(catalogStatus({})).toBe("never-synced");
    expect(catalogStatus({ modelCatalog: { models: [], lastError: "x" } })).toBe("error");
    expect(
      catalogStatus({ modelCatalog: { models: [{ id: "m" }], lastSuccessAt: new Date().toISOString(), lastError: "x" } }),
    ).toBe("stale");
    expect(
      catalogStatus({ modelCatalog: { models: [{ id: "m" }], lastSuccessAt: new Date().toISOString(), lastError: null } }),
    ).toBe("ok");
  });

  it("treats missing or day-old success timestamps as stale", () => {
    expect(isConnectionCatalogStale({})).toBe(true);
    expect(
      isConnectionCatalogStale({ modelCatalog: { lastSuccessAt: new Date(Date.now() - 25 * 3600 * 1000).toISOString() } }),
    ).toBe(true);
    expect(
      isConnectionCatalogStale({ modelCatalog: { lastSuccessAt: new Date().toISOString() } }),
    ).toBe(false);
  });

  it("getConnectionCatalog defaults safely", () => {
    expect(getConnectionCatalog(null)).toEqual({ models: [], lastSuccessAt: null, lastError: null });
    expect(getProviderConnections).toBeDefined();
  });
});
