import { getJson, quotaError, quota, num } from "./quotaShared.js";

export function parseOpenRouter(body) {
  const data = body && typeof body.data === "object" ? body.data : body;
  const total = num(data?.total_credits);
  const used = num(data?.total_usage);
  if (Number.isFinite(total) && Number.isFinite(used)) {
    return {
      plan: "Credits",
      quotas: { "Credits (USD)": quota(used, total) },
    };
  }

  const limit = num(data?.limit);
  const usage = num(data?.usage, 0);
  if (Number.isFinite(limit) && limit > 0) {
    return {
      plan: data?.is_free_tier ? "Free" : "API key",
      quotas: {
        "Key limit (USD)": quota(usage, limit, data?.limit_reset),
      },
    };
  }
  return null;
}

export async function getOpenRouterUsage(apiKey, proxyOptions) {
  if (!apiKey) {
    return { message: "OpenRouter API key not available.", quotas: {} };
  }

  const creditsRes = await getJson("https://openrouter.ai/api/v1/credits", apiKey, proxyOptions);
  if (creditsRes.ok) {
    const parsed = parseOpenRouter(creditsRes.body);
    if (parsed) return parsed;
  }

  const keyRes = await getJson("https://openrouter.ai/api/v1/auth/key", apiKey, proxyOptions);
  if (keyRes.ok) {
    const parsed = parseOpenRouter(keyRes.body);
    if (parsed) return parsed;
  }

  const errRes = creditsRes.status === 401 || creditsRes.status === 403 ? creditsRes : keyRes;
  return quotaError(errRes, "OpenRouter");
}
