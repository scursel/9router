function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Precedence (documented in docs/MODEL_SYNC_CATALOG.md):
//  1. provider-reported price (pricing.prompt/completion, input_price/output_price)
//  2. models.dev overlay in route layer (provider cost, else OpenRouter fallback)
//  3. explicit markers: `:free` / `-free` suffix or free/is_free field
//  4. curated per-provider rules (ORCAROUTER_FREE_IDS below)
//  5. unknown — never default to paid on missing data
const ORCAROUTER_FREE_IDS = new Set(["orcarouter/free"]);

export function classifyTier(row, { providerId = null } = {}) {
  const id = String(row?.id ?? row?.model ?? row?.name ?? "");
  const promptRaw = row?.pricing?.prompt ?? row?.input_price;
  const completionRaw = row?.pricing?.completion ?? row?.output_price;
  const hasPromptField = promptRaw !== undefined;
  const hasCompletionField = completionRaw !== undefined;
  const hasRequest = row?.pricing?.request !== undefined;
  const p = hasPromptField ? toNumber(promptRaw) : null;
  const c = hasCompletionField ? toNumber(completionRaw) : null;

  if (hasPromptField || hasCompletionField || hasRequest) {
    if (hasRequest && !hasPromptField && !hasCompletionField) {
      return { tier: "credits", tierSource: "provider-price" };
    }

    const anyPositive = (p !== null && p > 0) || (c !== null && c > 0);
    if (anyPositive) {
      return { tier: "paid", tierSource: "provider-price" };
    }

    const anyZero = p === 0 || c === 0;
    if (anyZero) {
      if (hasRequest) return { tier: "credits", tierSource: "provider-price" };
      return { tier: "free", tierSource: "provider-price" };
    }

    if (hasRequest) return { tier: "credits", tierSource: "provider-price" };
  }

  if (row?.free === true || row?.is_free === true) {
    return { tier: "free", tierSource: "provider-flag" };
  }
  if (id.endsWith(":free") || id.endsWith("-free")) {
    return { tier: "free", tierSource: "id-suffix" };
  }
  if (providerId === "orcarouter" && ORCAROUTER_FREE_IDS.has(id)) {
    return { tier: "free", tierSource: "curated" };
  }
  return { tier: "unknown", tierSource: "unknown" };
}
