/**
 * Web Search / Web Fetch routing helpers.
 *
 * Capability-scoped resolution only — does not alter the global LLM model parser.
 * Catalog IDs published by /v1/models/web use exact suffixes `{alias}/search` and
 * `{alias}/fetch`; only those suffixes are interpreted here.
 */

import { AI_PROVIDERS, resolveProviderId } from "@/shared/constants/providers.js";

const SUFFIX_BY_CAPABILITY = {
  webSearch: "search",
  webFetch: "fetch",
};

/**
 * @param {string} providerId
 * @param {"webSearch"|"webFetch"} capability
 */
function supportsCapability(providerId, capability) {
  const provider = AI_PROVIDERS[providerId];
  if (!provider) return false;
  if (capability === "webSearch") {
    return !!(provider.searchConfig || provider.searchViaChat);
  }
  if (capability === "webFetch") {
    return !!provider.fetchConfig;
  }
  return false;
}

/**
 * Resolve a web provider input to a canonical provider id.
 *
 * Accepts legacy ids/aliases and catalog IDs with the exact capability suffix.
 * Does not truncate arbitrary strings at the first `/`.
 *
 * @param {string} input
 * @param {"webSearch"|"webFetch"} capability
 * @returns {{ ok: true, providerId: string } | { ok: false, error: string }}
 */
export function resolveWebProviderId(input, capability) {
  if (!input || typeof input !== "string") {
    return { ok: false, error: "Missing provider/model" };
  }
  const expectedSuffix = SUFFIX_BY_CAPABILITY[capability];
  if (!expectedSuffix) {
    return { ok: false, error: `Unsupported web capability: ${capability}` };
  }

  const trimmed = input.trim();
  let base = trimmed;

  if (trimmed.includes("/")) {
    const slash = trimmed.indexOf("/");
    const prefix = trimmed.slice(0, slash);
    const rest = trimmed.slice(slash + 1);

    if (!prefix || rest.includes("/")) {
      return { ok: false, error: `Invalid web provider id: ${input}` };
    }

    if (rest === "search" || rest === "fetch") {
      if (rest !== expectedSuffix) {
        return {
          ok: false,
          error: `Provider id suffix /${rest} is not valid for ${capability} (expected /${expectedSuffix})`,
        };
      }
      base = prefix;
    } else {
      // Do not treat arbitrary provider/model strings as web ids.
      return { ok: false, error: `Invalid web provider id: ${input}` };
    }
  }

  const providerId = resolveProviderId(base);
  if (!AI_PROVIDERS[providerId]) {
    return { ok: false, error: `Unknown provider: ${input}` };
  }
  if (!supportsCapability(providerId, capability)) {
    return {
      ok: false,
      error: `Provider ${providerId} does not support ${capability === "webSearch" ? "web search" : "web fetch"}`,
    };
  }
  return { ok: true, providerId };
}

/**
 * Validate that a combo (if present) matches the web capability.
 * @param {object|null|undefined} combo
 * @param {string} comboName
 * @param {"webSearch"|"webFetch"} expectedKind
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function assertWebComboKind(combo, comboName, expectedKind) {
  if (!combo) return { ok: true };
  if (combo.kind !== expectedKind) {
    return {
      ok: false,
      error: `Combo "${comboName}" has kind ${combo.kind || "none"}, expected ${expectedKind}`,
    };
  }
  return { ok: true };
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTruthyFallbackOnEmpty(value) {
  return value === true;
}

/**
 * Detect a successful-but-empty web search/fetch response body.
 * Malformed JSON is NOT treated as empty (returns false).
 *
 * @param {"webSearch"|"webFetch"} capability
 * @param {object} json
 * @returns {boolean}
 */
export function isEmptyWebSuccessBody(capability, json) {
  if (!json || typeof json !== "object") return false;
  if (capability === "webSearch") {
    return Array.isArray(json.results) && json.results.length === 0;
  }
  if (capability === "webFetch") {
    const text = json.content?.text;
    return typeof text === "string" && text.trim() === "";
  }
  return false;
}

/**
 * Diagnostics envelope (opt-in via include_diagnostics=true).
 *
 * Shape (additive, never includes secrets/URLs/query/raw body):
 * {
 *   attempts: [{ provider, duration_ms, outcome: "success"|"empty"|"error", error?: string }],
 *   fallback_reason?: "empty_results"|"empty_content",
 *   exhausted?: boolean
 * }
 *
 * Compatibility: absent by default; only present when include_diagnostics===true.
 * Additive field — clients that ignore unknown keys remain compatible.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function wantsWebDiagnostics(value) {
  return value === true;
}

/**
 * @param {"webSearch"|"webFetch"} capability
 * @returns {"empty_results"|"empty_content"}
 */
export function emptyFallbackReason(capability) {
  return capability === "webFetch" ? "empty_content" : "empty_results";
}

/**
 * Attach diagnostics to a JSON Response body (additive). Non-JSON bodies pass through.
 * @param {Response} response
 * @param {object} diagnostics
 * @returns {Promise<Response>}
 */
export async function withWebDiagnostics(response, diagnostics) {
  if (!response || !diagnostics) return response;
  try {
    const json = await response.clone().json();
    if (!json || typeof json !== "object" || Array.isArray(json)) return response;
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json");
    if (!headers.has("Access-Control-Allow-Origin")) {
      headers.set("Access-Control-Allow-Origin", "*");
    }
    return new Response(JSON.stringify({ ...json, diagnostics }), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}

/**
 * Build opt-in empty-continue policy for handleComboChat.
 * @param {"webSearch"|"webFetch"} capability
 * @param {{ attempts?: object[], includeDiagnostics?: boolean }} state
 */
export function createEmptyContinuePolicy(capability, state = {}) {
  const reason = emptyFallbackReason(capability);
  return async (response, ctx) => {
    let json = null;
    try {
      json = await response.clone().json();
    } catch {
      // Malformed JSON is not a valid empty success — do not continue.
      if (state.includeDiagnostics && Array.isArray(state.attempts)) {
        const last = state.attempts[state.attempts.length - 1];
        if (last && last.provider == null && ctx?.modelStr) {
          last.provider = ctx.modelStr;
        }
      }
      return false;
    }
    const empty = isEmptyWebSuccessBody(capability, json);
    if (empty) {
      state.fallback_reason = reason;
      if (state.includeDiagnostics && Array.isArray(state.attempts)) {
        const last = state.attempts[state.attempts.length - 1];
        if (last && last.outcome === "success") last.outcome = "empty";
      }
    }
    return empty;
  };
}

/**
 * Finalize diagnostics for a combo response.
 * @param {object} state
 * @param {boolean} exhausted
 */
export function finalizeWebDiagnostics(state, exhausted) {
  if (!state?.includeDiagnostics) return null;
  const diagnostics = {
    attempts: state.attempts || [],
  };
  if (state.fallback_reason) diagnostics.fallback_reason = state.fallback_reason;
  if (exhausted) diagnostics.exhausted = true;
  return diagnostics;
}

/**
 * Run a web search/fetch combo with optional empty-result fallback and diagnostics.
 * Direct (non-combo) callers should not use this — fallback_on_empty is combo-only.
 *
 * @param {object} options
 * @param {"webSearch"|"webFetch"} options.capability
 * @param {object} options.body
 * @param {string[]} options.models
 * @param {string} options.comboName
 * @param {string} [options.comboStrategy]
 * @param {number|string} [options.comboStickyLimit]
 * @param {Function} options.handleSingleProvider - (body, providerInput) => Promise<Response>
 * @param {Function} options.handleComboChat - combo runner (injected to avoid circular imports)
 * @param {object} options.log
 * @returns {Promise<Response>}
 */
export async function runWebCombo({
  capability,
  body,
  models,
  comboName,
  comboStrategy,
  comboStickyLimit,
  handleSingleProvider,
  handleComboChat,
  log,
}) {
  const fallbackOnEmpty = isTruthyFallbackOnEmpty(body?.fallback_on_empty);
  const includeDiagnostics = wantsWebDiagnostics(body?.include_diagnostics);
  const state = { attempts: [], includeDiagnostics, fallback_reason: null };

  const handleSingleModel = async (reqBody, modelStr) => {
    const started = Date.now();
    const resolved = resolveWebProviderId(modelStr, capability);
    const providerLabel = resolved.ok ? resolved.providerId : modelStr;
    const response = await handleSingleProvider(reqBody, modelStr);
    const duration_ms = Date.now() - started;

    if (includeDiagnostics) {
      let outcome = response.ok ? "success" : "error";
      let error;
      if (response.ok) {
        try {
          const json = await response.clone().json();
          if (isEmptyWebSuccessBody(capability, json)) outcome = "empty";
        } catch {
          // keep success for non-JSON 2xx
        }
      } else {
        try {
          const errBody = await response.clone().json();
          error = String(errBody?.error?.message || errBody?.error || errBody?.message || "").slice(0, 200);
        } catch {
          error = response.statusText || String(response.status);
        }
      }
      const entry = { provider: providerLabel, duration_ms, outcome };
      if (error) entry.error = error;
      state.attempts.push(entry);
    }

    return response;
  };

  const response = await handleComboChat({
    body,
    models,
    handleSingleModel,
    log,
    comboName,
    comboStrategy,
    comboStickyLimit,
    autoSwitch: false,
    shouldContinueOnSuccess: fallbackOnEmpty
      ? createEmptyContinuePolicy(capability, state)
      : undefined,
  });

  if (!includeDiagnostics) return response;

  const exhausted =
    state.attempts.length > 0 &&
    state.attempts.every((a) => a.outcome === "empty");
  const diagnostics = finalizeWebDiagnostics(state, exhausted);
  return withWebDiagnostics(response, diagnostics);
}
