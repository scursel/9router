// Combo / CLI model picker: prefer the account catalog routing already uses.
// Live fetch (Cursor/Cline) wins when present; stored modelCatalog is next so
// stale registry ids (e.g. alitp-intl/qwen3.8-max-preview) cannot be picked
// when the Token Plan listing has moved on; static registry is last-resort.

export function modelsFromStoredCatalog(connections, providerId) {
  const seen = new Set();
  const models = [];
  for (const connection of connections || []) {
    if (connection?.provider !== providerId) continue;
    if (connection.isActive === false) continue;
    const list = connection.modelCatalog?.models;
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const id = entry?.id;
      if (!id || seen.has(id) || entry.availability === "unavailable") continue;
      seen.add(id);
      models.push(entry);
    }
  }
  return models;
}

export function resolvePickerModels({ liveModels = [], storedModels = [], staticModels = [] } = {}) {
  if (liveModels.length > 0) return liveModels;
  if (storedModels.length > 0) return storedModels;
  return staticModels;
}

export function pickerModelLabel(entry) {
  return entry?.name || entry?.display_name || entry?.displayName || entry?.id || "";
}
