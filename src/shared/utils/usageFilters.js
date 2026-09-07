import { getProviderByAlias, getProviderAlias } from "@/shared/constants/providers";

export function normalizeProviderId(value) {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return getProviderByAlias(trimmed)?.id || getProviderAlias(trimmed) || trimmed;
}

/** True when a usage row belongs to the selected combo's member list. */
export function usageItemMatchesCombo(item, combo) {
  if (!combo?.models?.length) return false;
  const itemProvider = normalizeProviderId(item?.provider);
  const itemModel = String(item?.rawModel || item?.model || "").trim();
  if (!itemModel) return false;

  return combo.models.some((member) => {
    if (!member || typeof member !== "string") return false;
    const raw = member.trim();
    if (!raw) return false;
    if (!raw.includes("/")) {
      return itemModel === raw || itemModel.endsWith(`/${raw}`);
    }
    const slash = raw.indexOf("/");
    const memberProvider = normalizeProviderId(raw.slice(0, slash));
    const memberModel = raw.slice(slash + 1).trim();
    if (!memberModel) return false;
    const providerOk = !memberProvider || !itemProvider || memberProvider === itemProvider;
    const modelOk = itemModel === memberModel
      || itemModel === raw
      || itemModel.endsWith(`/${memberModel}`);
    return providerOk && modelOk;
  });
}

/**
 * Build usage rows attributed to combos that actually saw traffic.
 * A model row can appear under every combo that lists it as a member.
 * Combos with zero matching usage are omitted.
 */
export function buildComboUsageMap(byModel, combos = []) {
  const out = {};
  for (const combo of combos) {
    if (!combo?.name || !Array.isArray(combo.models) || combo.models.length === 0) continue;
    for (const [key, data] of Object.entries(byModel || {})) {
      if (!usageItemMatchesCombo(data, combo)) continue;
      out[`${combo.name}|${key}`] = {
        ...data,
        comboName: combo.name,
      };
    }
  }
  return out;
}
