import { getProviderConnections, getProviderConnectionById, updateProviderConnection } from "@/models";
import { assertPublicUrl } from "@/shared/utils/ssrfGuard.js";
import REGISTRY from "open-sse/providers/registry/index.js";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const RETRY_DELAY_MS = 30 * 60 * 1000;
export const FETCH_TIMEOUT_MS = 15_000;
// A model is only treated as removed after this many consecutive successful
// syncs without it. A single absence (rotation, partial outage, pagination
// glitch) keeps it pending-removal and still advertised.
export const RETRY_AFTER_MISSING = 2;

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Precedence (documented):
//  1. provider-reported price (pricing.prompt/completion, input_price/output_price)
//  2. models.dev price/capability overlay (matched by provider+model in route layer)
//  3. explicit markers: `:free` / `-free` suffix or free/is_free field
//  4. curated per-provider rules (ORCAROUTER_FREE_IDS below)
//  5. unknown — never default to paid on missing data
const ORCAROUTER_FREE_IDS = new Set(["orcarouter/free"]);

function isZeroPrice(value) {
  if (typeof value === "number") return value === 0;
  if (typeof value !== "string") return false;
  if (value.trim() === "") return false;
  const n = Number(value);
  return Number.isFinite(n) && n === 0;
}

export function classifyTier(row, { providerId = null } = {}) {
  const id = String(row?.id ?? row?.model ?? row?.name ?? "");
  if (row?.free === true || row?.is_free === true) {
    return { tier: "free", tierSource: "provider-flag" };
  }
  if (id.endsWith(":free") || id.endsWith("-free")) {
    return { tier: "free", tierSource: "id-suffix" };
  }
  if (providerId === "orcarouter" && ORCAROUTER_FREE_IDS.has(id)) {
    return { tier: "free", tierSource: "curated" };
  }
  const prompt = row?.pricing?.prompt ?? row?.input_price;
  const completion = row?.pricing?.completion ?? row?.output_price;
  if (prompt !== undefined || completion !== undefined) {
    const p = toNumber(prompt);
    const c = toNumber(completion);
    if (p === 0 && (c === 0 || c === null)) return { tier: "free", tierSource: "provider-price" };
    if (p === 0 || c === 0) {
      // Half-reported zero (e.g. per-request pricing with prompt 0) is a
      // credits/promo shape, not proof of free.
      if (row?.pricing?.request !== undefined) return { tier: "credits", tierSource: "provider-price" };
      return { tier: "free", tierSource: "provider-price" };
    }
    if (p !== null || c !== null) {
      if (row?.pricing?.request !== undefined && p === null && c === null) {
        return { tier: "credits", tierSource: "provider-price" };
      }
      if (p !== null || c !== null) return { tier: "paid", tierSource: "provider-price" };
    }
  }
  if (row?.pricing?.request !== undefined) {
    return { tier: "credits", tierSource: "provider-price" };
  }
  return { tier: "unknown", tierSource: "unknown" };
}

function inferKindFromId(id) {
  const lower = String(id).toLowerCase();
  if (/embed/.test(lower)) return "embedding";
  if (/\b(tts|speech|audio|voice)\b/.test(lower)) return "tts";
  if (/(image|imagen|dall-?e|flux|sdxl|stable-diffusion)/.test(lower)) return "image";
  return "llm";
}

export function normalizedModels(payload, { providerId = null } = {}) {
  const rows = Array.isArray(payload) ? payload : payload?.data || payload?.models || [];
  return rows.map((row) => {
    const rawId = row?.id ?? row?.model ?? row?.name;
    if (!rawId || typeof rawId !== "string") return null;
    const id = rawId.trim();
    if (!id) return null;
    const { tier, tierSource } = classifyTier({ ...row, id }, { providerId });
    const prompt = toNumber(row?.pricing?.prompt ?? row?.input_price);
    const completion = toNumber(row?.pricing?.completion ?? row?.output_price);
    return {
      id,
      name: row?.name || row?.display_name || id,
      tier,
      tierSource,
      pricing: prompt === null && completion === null ? null : { prompt, completion },
      contextLength: toNumber(row?.context_length ?? row?.contextLength) ?? undefined,
      capabilities: row?.capabilities && typeof row.capabilities === "object" ? row.capabilities : undefined,
      kind: row?.kind || inferKindFromId(id),
    };
  }).filter(Boolean);
}

function resolveModelsUrl(connection) {
  // Per-account override first: custom nodes carry their own baseUrl.
  const configured = connection.providerSpecificData?.baseUrl;
  if (typeof configured === "string" && configured.trim()) {
    const base = configured.trim().replace(/\/$/, "");
    if (/\/messages$/.test(base)) return `${base.slice(0, -9)}/models`;
    return `${base}/models`;
  }
  const provider = REGISTRY.find((entry) => entry.id === connection.provider);
  // modelsFetcher is the declarative models endpoint; transport.validateUrl is
  // the connection-test probe and must NOT drive catalog sync for providers
  // whose auth check is a POST (antigravity) or a chat probe.
  // Only OpenAI-shaped listings are synced: other fetcher types (e.g.
  // models.dev-shaped) have a different response shape and stay on the
  // static seed instead of erroring every cycle.
  const fetcher = provider?.modelsFetcher;
  const url = fetcher?.type === "openai" && typeof fetcher?.url === "string" ? fetcher.url : null;
  if (url) return url;
  return null;
}

export function getConnectionCatalog(connection) {
  const stored = connection?.modelCatalog;
  if (!stored || typeof stored !== "object") {
    return { models: [], lastSuccessAt: null, lastError: null };
  }
  return {
    models: Array.isArray(stored.models) ? stored.models : [],
    lastSuccessAt: stored.lastSuccessAt || null,
    lastAttemptAt: stored.lastAttemptAt || null,
    lastError: stored.lastError || null,
  };
}

export function catalogStatus(connection) {
  const catalog = getConnectionCatalog(connection);
  if (!catalog.models.length && !catalog.lastSuccessAt) {
    return catalog.lastError ? "error" : "never-synced";
  }
  if (catalog.lastError && !catalog.lastSuccessAt) return "error";
  if (catalog.lastError) return "stale";
  return "ok";
}

export function isConnectionCatalogStale(connection, now = Date.now()) {
  const lastSuccessAt = Date.parse(getConnectionCatalog(connection).lastSuccessAt || "");
  return !Number.isFinite(lastSuccessAt) || now - lastSuccessAt >= DAY_MS;
}

function authHeaders(connection) {
  const provider = REGISTRY.find((entry) => entry.id === connection.provider);
  const headers = { Accept: "application/json" };
  if (provider?.transport?.auth === false || provider?.noAuth) return headers;
  if (connection.apiKey) headers.Authorization = `Bearer ${connection.apiKey}`;
  else if (connection.accessToken) headers.Authorization = `Bearer ${connection.accessToken}`;
  return headers;
}

async function fetchWithRetry(url, { headers }) {
  // fetchPublic re-validates every redirect hop: a validated public URL
  // cannot 30x its way to an internal target, and Bearer credentials are
  // only ever sent to the validated endpoint chain.
  const { fetchPublic } = await import("@/shared/utils/ssrfGuard.js");
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
    try {
      const response = await fetchPublic(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (response.ok) return { response };
      // Auth/permission failures repeat verbatim — retrying burns nothing.
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        return { response };
      }
      lastError = new Error(`model listing returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("model listing failed");
}

export async function syncConnectionCatalog(connectionOrId) {
  const connection = typeof connectionOrId === "string"
    ? await getProviderConnectionById(connectionOrId)
    : connectionOrId;
  if (!connection) return { connectionId: connectionOrId, updated: false, error: "Connection not found" };

  const url = resolveModelsUrl(connection);
  if (!url) {
    return { connectionId: connection.id, skipped: true, reason: "provider does not expose a models endpoint" };
  }
  try {
    assertPublicUrl(url);
  } catch {
    return { connectionId: connection.id, skipped: true, reason: "models endpoint is not a public URL" };
  }

  const previous = getConnectionCatalog(connection);
  let response;
  try {
    ({ response } = await fetchWithRetry(url, { headers: authHeaders(connection) }));
  } catch (error) {
    // Network failure: keep the last valid list, record the miss.
    const modelCatalog = { ...previous, lastError: error?.message || "network error", lastAttemptAt: new Date().toISOString() };
    await updateProviderConnection(connection.id, { modelCatalog });
    return { connectionId: connection.id, updated: false, error: modelCatalog.lastError };
  }
  if (!response.ok) {
    const status = `model listing returned HTTP ${response.status}`;
    const modelCatalog = { ...previous, lastError: status, lastAttemptAt: new Date().toISOString() };
    await updateProviderConnection(connection.id, { modelCatalog });
    return { connectionId: connection.id, updated: false, error: status, status: response.status };
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    const modelCatalog = { ...previous, lastError: "model listing returned invalid JSON", lastAttemptAt: new Date().toISOString() };
    await updateProviderConnection(connection.id, { modelCatalog });
    return { connectionId: connection.id, updated: false, error: modelCatalog.lastError };
  }
  const current = normalizedModels(payload, { providerId: connection.provider });
  if (!current.length) {
    // Empty list on a 200 is indistinguishable from an outage — never wipe.
    const modelCatalog = { ...previous, lastError: "model listing returned no usable models", lastAttemptAt: new Date().toISOString() };
    await updateProviderConnection(connection.id, { modelCatalog });
    return { connectionId: connection.id, updated: false, error: modelCatalog.lastError };
  }

  const oldById = new Map((previous.models || []).map((model) => [model.id, model]));
  const currentIds = new Set(current.map((model) => model.id));
  const models = current.map((model) => {
    const old = oldById.get(model.id);
    return {
      ...model,
      // Preserve capability/context/output metadata the provider did not send.
      capabilities: model.capabilities ?? old?.capabilities,
      contextLength: model.contextLength ?? old?.contextLength,
      availability: "available",
      missingSyncs: 0,
    };
  });
  for (const old of previous.models || []) {
    if (currentIds.has(old.id)) continue;
    const missingSyncs = (old.missingSyncs || 0) + 1;
    models.push({
      ...old,
      missingSyncs,
      availability: missingSyncs >= RETRY_AFTER_MISSING ? "unavailable" : "temporarily-absent",
    });
  }

  const modelCatalog = { models, lastSuccessAt: new Date().toISOString(), lastError: null };
  await updateProviderConnection(connection.id, { modelCatalog });
  return {
    connectionId: connection.id,
    updated: true,
    available: current.length,
    unavailable: models.filter((m) => m.availability === "unavailable").length,
    pending: models.filter((m) => m.availability === "temporarily-absent").length,
  };
}

export async function syncDueConnectionCatalogs({ force = false } = {}) {
  const connections = await getProviderConnections({ isActive: true });
  const results = [];
  for (const connection of connections) {
    // OAuth providers whose token refreshes on use sync lazily; only sync
    // connections whose endpoint is a plain GET with a stored credential.
    if (force || isConnectionCatalogStale(connection)) {
      results.push(await syncConnectionCatalog(connection));
    }
  }
  return results;
}
