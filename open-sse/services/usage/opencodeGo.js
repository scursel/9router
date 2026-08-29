import { proxyAwareFetch } from "../../utils/proxyFetch.js";
import { resetAt, quotaError, num } from "./quotaShared.js";

const cache = new Map();

export function parseOpenCodeGo(body, now = Date.now()) {
  const usage = body && typeof body === "object" ? body.usage : null;
  if (!usage || typeof usage !== "object") return null;

  const labels = {
    rolling: "Rolling (5h)",
    weekly: "Weekly",
    monthly: "Monthly",
  };
  const quotas = {};
  for (const name of ["rolling", "weekly", "monthly"]) {
    const window = usage[name];
    if (!window || typeof window !== "object") continue;
    const percent = num(window.percent);
    if (!Number.isFinite(percent)) continue;
    const used = Math.max(0, Math.min(100, percent));
    quotas[labels[name]] = {
      used,
      total: 100,
      remainingPercentage: 100 - used,
      resetAt: resetAt(window.resetsAt),
      unlimited: false,
    };
  }
  if (Object.keys(quotas).length === 0) return null;
  return {
    plan: "OpenCode Go",
    status: "ok",
    source: "opencode-go",
    fetchedAt: new Date(now).toISOString(),
    quotas,
  };
}

export async function getOpencodeGoUsage(apiKey, proxyOptions) {
  if (!apiKey) {
    return { message: "OpenCode Go API key not available.", quotas: {} };
  }

  const now = Date.now();
  const cached = cache.get(apiKey);
  if (cached && now - cached.fetchedAt < 45000) {
    return cached.value;
  }

  try {
    const res = await proxyAwareFetch(
      "https://opencode.ai/zen/go/v1/usage",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
      },
      proxyOptions,
    );
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      return quotaError({ status: res.status }, "OpenCode Go");
    }

    const parsed = parseOpenCodeGo(body, now);
    if (!parsed) {
      return { message: "OpenCode Go connected. No usage windows were returned.", quotas: {} };
    }

    cache.set(apiKey, { value: parsed, fetchedAt: now });
    return parsed;
  } catch (_err) {
    return { message: "OpenCode Go quota API request failed.", quotas: {} };
  }
}
