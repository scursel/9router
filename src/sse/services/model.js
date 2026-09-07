// Re-export from open-sse with localDb integration
import { getModelAliases, getComboByName, getProviderNodes, getProviderConnections } from "@/lib/localDb";
import { parseModel as parseModelCore, resolveModelAliasFromMap, getModelInfoCore } from "open-sse/services/model.js";
import REGISTRY from "open-sse/providers/registry/index.js";

// Local provider alias overrides (HMR-friendly, applied on top of open-sse map)
const LOCAL_PROVIDER_ALIASES = {
  xmtp: "xiaomi-tokenplan",
  "xiaomi-tokenplan": "xiaomi-tokenplan",
};

const RESERVED_PROVIDER_PREFIXES = new Set(Object.keys(LOCAL_PROVIDER_ALIASES));
for (const entry of REGISTRY) {
  RESERVED_PROVIDER_PREFIXES.add(entry.id);
  if (entry.alias) RESERVED_PROVIDER_PREFIXES.add(entry.alias);
  for (const alias of entry.aliases || []) RESERVED_PROVIDER_PREFIXES.add(alias);
}

export function parseModel(modelStr) {
  const parsed = parseModelCore(modelStr);
  if (parsed?.providerAlias && LOCAL_PROVIDER_ALIASES[parsed.providerAlias]) {
    return { ...parsed, provider: LOCAL_PROVIDER_ALIASES[parsed.providerAlias] };
  }
  return parsed;
}

/**
 * Resolve model alias from localDb
 */
export async function resolveModelAlias(alias) {
  const aliases = await getModelAliases();
  return resolveModelAliasFromMap(alias, aliases);
}

/**
 * Get full model info (parse or resolve)
 */
export async function getModelInfo(modelStr) {
  const parsed = parseModel(modelStr);

  if (!parsed.isAlias) {
    // Provider-node prefixes are user-defined. They must not override built-in
    // provider ids/aliases such as `cf`, `cloudflare-ai`, `openai`, or `hf`.
    if (!RESERVED_PROVIDER_PREFIXES.has(parsed.providerAlias)) {
      const openaiNodes = await getProviderNodes({ type: "openai-compatible" });
      const matchedOpenAI = openaiNodes.find((node) => node.prefix === parsed.providerAlias);
      if (matchedOpenAI) {
        return { provider: matchedOpenAI.id, model: parsed.model };
      }

      const anthropicNodes = await getProviderNodes({ type: "anthropic-compatible" });
      const matchedAnthropic = anthropicNodes.find((node) => node.prefix === parsed.providerAlias);
      if (matchedAnthropic) {
        return { provider: matchedAnthropic.id, model: parsed.model };
      }

      const embeddingNodes = await getProviderNodes({ type: "custom-embedding" });
      const matchedEmbedding = embeddingNodes.find((node) => node.prefix === parsed.providerAlias);
      if (matchedEmbedding) {
        return { provider: matchedEmbedding.id, model: parsed.model };
      }
    }
    return {
      provider: parsed.provider,
      model: parsed.model
    };
  }

  // Check if this is a combo name before resolving as alias
  // This prevents combo names from being incorrectly routed to providers
  const combo = await getComboByName(parsed.model);
  if (combo) {
    // Return null provider to signal this should be handled as combo
    // The caller (handleChat) will detect this and handle it as combo
    return { provider: null, model: parsed.model };
  }

  return getModelInfoCore(modelStr, getModelAliases);
}

/**
 * Check if model is a combo and get models list
 * @returns {Promise<string[]|null>} Array of models or null if not a combo
 */
export async function getComboModels(modelStr) {
  // Only check if it's not in provider/model format
  if (modelStr.includes("/")) return null;

  const combo = await getComboByName(modelStr);
  if (combo && combo.models && combo.models.length > 0) {
    return filterUnavailableComboMembers(combo.models);
  }
  return null;
}

// A catalog is account-specific. A combo member remains runnable when at least
// one active account either has not been catalogued yet or still lists it. This
// deliberately preserves the stored combo: sync only changes routing, never a
// user's fallback order or aliases. Matching is prefix-aware: gateways report
// ids like `anthropic/claude-sonnet-5` while the member may carry only the
// trailing segment.
function catalogListsModel(catalogModels, providerId, model) {
  const bare = model.includes("/") ? model.split("/").pop() : model;
  return (catalogModels || []).some((entry) => {
    if (!entry || entry.availability === "unavailable") return false;
    const candidate = String(entry.id || "");
    if (!candidate) return false;
    if (candidate === model || candidate === bare) return true;
    const candidateBare = candidate.includes("/") ? candidate.split("/").pop() : candidate;
    return candidateBare === bare;
  });
}

async function filterUnavailableComboMembers(models) {
  const connections = await getProviderConnections({ isActive: true });
  const candidates = await Promise.all(models.map(async (member) => {
    const info = await getModelInfo(member);
    if (!info?.provider || !info?.model) return member;
    const accounts = connections.filter((connection) => connection.provider === info.provider);
    if (!accounts.length) return member;
    const catalogued = accounts.filter((connection) => Array.isArray(connection.modelCatalog?.models));
    if (!catalogued.length) return member;
    const availableSomewhere = catalogued.some((connection) =>
      catalogListsModel(connection.modelCatalog.models, info.provider, info.model)
    );
    const unverifiedSomewhere = accounts.length > catalogued.length;
    return availableSomewhere || unverifiedSomewhere ? member : null;
  }));
  // No fallback to the original list: when every member is confirmed
  // unavailable the caller (handleComboChat) returns a clear 503 instead of
  // retrying dead models and failing opaquely.
  return candidates.filter(Boolean);
}
