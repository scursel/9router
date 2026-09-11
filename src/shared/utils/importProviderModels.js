import { classifyTier } from "@/shared/utils/modelTier.js";

export function stripProviderPrefix(modelId, prefixes = []) {
  const id = String(modelId || "").trim();
  if (!id) return "";
  for (const prefix of prefixes) {
    if (!prefix) continue;
    const needle = `${prefix}/`;
    if (id.startsWith(needle)) return id.slice(needle.length);
  }
  return id;
}

export function collectImportableModels({
  models = [],
  existingIds = new Set(),
  prefixes = [],
  freeOnly = false,
  providerId = null,
} = {}) {
  const out = [];
  const seen = new Set(existingIds);
  for (const model of models) {
    const rawId = model?.id || model?.name || model?.model;
    const id = stripProviderPrefix(rawId, prefixes);
    if (!id || seen.has(id)) continue;
    if (freeOnly) {
      const tier = model?.tier || classifyTier({ ...model, id }, { providerId }).tier;
      if (tier !== "free") continue;
    }
    seen.add(id);
    const kind = ["image", "embedding", "tts", "stt"].includes(model?.kind) ? model.kind : "llm";
    out.push({ id, kind, name: model?.name || id });
  }
  return out;
}

export function connectionCanSyncCatalog({
  modelsFetcher = null,
  baseUrl = null,
} = {}) {
  if (typeof modelsFetcher?.url === "string" && modelsFetcher.url.trim()) return true;
  return typeof baseUrl === "string" && baseUrl.trim().length > 0;
}

export function providerCanImportModels({
  modelsFetcher = null,
  hasActiveConnection = false,
  isCompatible = false,
  baseUrl = null,
} = {}) {
  if (typeof modelsFetcher?.url === "string" && modelsFetcher.url.trim()) return true;
  if (!hasActiveConnection) return false;
  if (isCompatible) return true;
  return connectionCanSyncCatalog({ modelsFetcher, baseUrl });
}
