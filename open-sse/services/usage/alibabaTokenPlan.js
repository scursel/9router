import { getAdapter } from "@/lib/db/driver.js";
import { num, localQuota } from "./quotaShared.js";

export function getAlibabaPlanLimits(limits = {}) {
  const plans = {
    lite: { name: "Lite", limit5h: 700, limit7d: 2500 },
    standard: { name: "Standard", limit5h: 3000, limit7d: 10000 },
    pro: { name: "Pro", limit5h: 12000, limit7d: 40000 },
  };
  const key = String(limits.plan || limits.tier || limits.tokenPlan || "lite")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return plans[key] || plans.lite;
}

export function estimateAlibabaCredits(record) {
  let prompt = num(record?.promptTokens, 0);
  let completion = num(record?.completionTokens, 0);
  let cached = 0;
  let raw = record?.tokens;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (raw && typeof raw === "object") {
    prompt = num(raw.prompt_tokens ?? raw.promptTokens, prompt);
    completion = num(raw.completion_tokens ?? raw.completionTokens, completion);
    cached = num(raw.cached_tokens ?? raw.cachedTokens, 0);
  }
  const uncached = Math.max(0, prompt - cached);
  // qwen3.8 list USD / 1M × ~$0.002 per Token Plan credit.
  const usd = uncached * 2e-6 + completion * 6e-6 + cached * 0.25e-6;
  return usd / 0.002;
}

export function alibabaWindowMeta(records, windowMs, now, useCredits) {
  const items = [];
  if (Array.isArray(records)) {
    for (const r of records) {
      const t =
        typeof r?.timestamp === "number"
          ? r.timestamp
          : r?.timestamp
            ? new Date(r.timestamp).getTime()
            : NaN;
      if (!Number.isFinite(t) || t > now) continue;
      const amount = useCredits
        ? estimateAlibabaCredits(r)
        : num(r?.promptTokens, 0) + num(r?.completionTokens, 0);
      items.push({ t, amount });
    }
  }
  items.sort((a, b) => a.t - b.t);
  let start = null;
  let end = null;
  for (const item of items) {
    if (start === null || item.t >= end) {
      start = item.t;
      end = item.t + windowMs;
    }
  }
  if (start === null || now >= end) return { used: 0, start: null, end: null };
  let used = 0;
  for (const item of items) {
    if (item.t >= start && item.t < end) used += item.amount;
  }
  return { used, start, end };
}

export function alibabaWindowUsage(records, windowMs, now, useCredits) {
  return alibabaWindowMeta(records, windowMs, now, useCredits).used;
}

export function alibabaUntracked7d(limits, windowStart) {
  const extra = num(limits?.untrackedCredits7d ?? limits?.quotaUsed7dOffset, 0);
  if (extra <= 0) return 0;
  const raw = limits?.untrackedCredits7dWindowStart ?? limits?.quotaUsed7dWindowStart;
  if (raw == null || raw === "") return extra;
  const hintedStart = typeof raw === "number" ? raw : new Date(raw).getTime();
  if (!Number.isFinite(hintedStart) || !Number.isFinite(windowStart)) return 0;
  return Math.abs(hintedStart - windowStart) < 2000 ? extra : 0;
}

export function calcSlidingWindowUsage(records, now = Date.now(), limits = {}) {
  const fiveHourMs = 5 * 3600 * 1000;
  const sevenDayMs = 7 * 86400 * 1000;
  const cutoff5h = now - fiveHourMs;
  const cutoff7d = now - sevenDayMs;
  const useCredits = String(limits?.unit || "").toLowerCase() === "credits";
  const plan = getAlibabaPlanLimits(limits);
  const fiveHourUsed = useCredits
    ? alibabaWindowUsage(records, fiveHourMs, now, true)
    : (() => {
        let used = 0;
        if (Array.isArray(records)) {
          for (const r of records) {
            const t =
              typeof r?.timestamp === "number"
                ? r.timestamp
                : r?.timestamp
                  ? new Date(r.timestamp).getTime()
                  : NaN;
            if (!Number.isFinite(t) || t < cutoff5h || t > now) continue;
            used += num(r?.promptTokens, 0) + num(r?.completionTokens, 0);
          }
        }
        return used;
      })();
  const sevenDayMeta = useCredits
    ? alibabaWindowMeta(records, sevenDayMs, now, true)
    : null;
  const sevenDayUsed = sevenDayMeta
    ? sevenDayMeta.used + alibabaUntracked7d(limits, sevenDayMeta.start)
    : (() => {
        let used = 0;
        if (Array.isArray(records)) {
          for (const r of records) {
            const t =
              typeof r?.timestamp === "number"
                ? r.timestamp
                : r?.timestamp
                  ? new Date(r.timestamp).getTime()
                  : NaN;
            if (!Number.isFinite(t) || t < cutoff7d || t > now) continue;
            used += num(r?.promptTokens, 0) + num(r?.completionTokens, 0);
          }
        }
        return used;
      })();

  const limit5h = num(
    limits?.limit5h || limits?.quotaLimit5h || limits?.fiveHourLimit,
    useCredits ? plan.limit5h : 0,
  );
  const limit7d = num(
    limits?.limit7d || limits?.quotaLimit7d || limits?.sevenDayLimit,
    useCredits ? plan.limit7d : 0,
  );
  const name5h = useCredits ? "Créditos 5h (estimado)" : "Consumo 5h (medido local)";
  const name7d = useCredits ? "Créditos 7d (estimado)" : "Consumo 7d (medido local)";
  const quotas = {
    [name5h]: localQuota(fiveHourUsed, limit5h),
    [name7d]: localQuota(sevenDayUsed, limit7d),
  };

  return {
    plan: useCredits
      ? `Alibaba Token Plan ${plan.name} (créditos estimados)`
      : "Alibaba Token Plan (medido pelo router)",
    status: "ok",
    source: "router-local",
    fetchedAt: new Date(now).toISOString(),
    quotas,
  };
}

export async function getAlibabaTokenPlanUsage(ctx = {}, now = Date.now()) {
  let connId = String(ctx?.connectionId || ctx?.id || "").trim();
  const psd = ctx?.providerSpecificData || {};
  const sevenDayMs = 7 * 86400 * 1000;
  const cutoff7dIso = new Date(now - sevenDayMs).toISOString();

  let rows = [];
  try {
    const db = await getAdapter();
    if (db && !connId && ctx?.apiKey && typeof db.get === "function") {
      const found = db.get(
        "SELECT id FROM providerConnections WHERE provider IN ('alitp-intl', 'qwen-cloud-token-plan') AND json_extract(data, '$.apiKey') = ?",
        [String(ctx.apiKey)]
      );
      connId = String(found?.id || "").trim();
    }
    if (db && typeof db.all === "function" && connId) {
      rows = db.all(
        "SELECT promptTokens, completionTokens, tokens, timestamp, model FROM usageHistory WHERE connectionId = ? AND timestamp >= ?",
        [connId, cutoff7dIso]
      );
    }
  } catch (err) {
    console.warn("[LocalQuotaMeter] DB query error:", err);
  }

  return calcSlidingWindowUsage(rows, now, {
    ...psd,
    unit: psd.unit || psd.quotaUnit || "credits",
  });
}
