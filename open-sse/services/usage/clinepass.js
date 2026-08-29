import { getJson, quotaError, quota, formatDate, num } from "./quotaShared.js";

export function parseCline(planBody, usageItems, now = Date.now()) {
  const current = planBody?.data || planBody || {};
  const plan = current.plan || {};
  const pass = plan.entitlements?.cline_pass;
  const limits = pass?.inferenceCapThreshold;
  if (!pass?.enabled || !limits) return null;

  const nowMs = num(now, Date.now());
  const scale = 100000000;
  const definitions = [
    ["5 hour window (USD)", 5 * 60 * 60 * 1000, limits.last5HoursUsageCostUSDPerUser],
    ["7 day window (USD)", 7 * 24 * 60 * 60 * 1000, limits.last7daysUsageCostUSDPerUser],
    ["30 day window (USD)", 30 * 24 * 60 * 60 * 1000, limits.last30daysUsageCostUSDPerUser],
  ];
  const items = Array.isArray(usageItems) ? usageItems : [];
  const quotas = {};
  for (const [name, duration, rawLimit] of definitions) {
    const limit = num(rawLimit, 0);
    if (limit <= 0) continue;
    let used = 0;
    let earliest = null;
    const cutoff = nowMs - duration;
    for (const item of items) {
      const createdAt = new Date(item?.createdAt).getTime();
      if (!Number.isFinite(createdAt) || createdAt < cutoff || createdAt > nowMs) continue;
      used += Math.max(0, num(item?.costUsd, 0));
      if (earliest === null || createdAt < earliest) earliest = createdAt;
    }
    quotas[name] = quota(
      used / scale,
      limit / scale,
      earliest === null ? null : earliest + duration,
    );
  }
  if (!Object.keys(quotas).length) return null;
  const renewalDate = formatDate(current.currentPeriodEnd);
  const displayName = String(plan.displayName || plan.name || "ClinePass").replace(/\[Internal\]/g, "").trim();
  return {
    plan: renewalDate ? `${displayName} - renews ${renewalDate}` : displayName,
    quotas,
  };
}

export async function getClinePassUsage(credential, proxyOptions) {
  if (!credential) {
    return { message: "ClinePass credential not available.", quotas: {} };
  }

  const [meRes, planRes] = await Promise.all([
    getJson("https://api.cline.bot/api/v1/users/me", credential, proxyOptions),
    getJson("https://api.cline.bot/api/v1/users/me/plan", credential, proxyOptions),
  ]);

  if (!meRes.ok) return quotaError(meRes, "ClinePass");
  if (!planRes.ok) return quotaError(planRes, "ClinePass plan");

  const meData = meRes.body?.data || meRes.body || {};
  const userId = meData.id || meData.uid;
  if (!userId) {
    return { message: "ClinePass user ID was not returned.", quotas: {} };
  }

  const items = [];
  let cursor = "";
  const cutoff30d = Date.now() - 2592000000;

  for (let i = 0; i < 100; i++) {
    const url = `https://api.cline.bot/api/v1/users/${encodeURIComponent(userId)}/usages?limit=100${
      cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
    }`;
    const usageRes = await getJson(url, credential, proxyOptions);
    if (!usageRes.ok) return quotaError(usageRes, "ClinePass usage");

    const usageData = usageRes.body?.data || usageRes.body || {};
    const pageItems = Array.isArray(usageData.items) ? usageData.items : [];
    items.push(...pageItems);
    cursor = String(usageData.nextToken || "");

    const dates = pageItems.map((item) => new Date(item?.createdAt).getTime()).filter(Number.isFinite);
    const minDate = dates.length ? Math.min(...dates) : null;

    if (!cursor || !pageItems.length || (minDate !== null && minDate < cutoff30d)) {
      break;
    }
  }

  const parsed = parseCline(planRes.body, items);
  return parsed || { message: "ClinePass connected. No active quota limits were returned.", quotas: {} };
}
