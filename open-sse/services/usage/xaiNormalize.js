import { balance, num, quota } from "./quotaShared.js";

// Mirrors the live overlay's qtpNormalizeXai so the dashboard shows money
// rather than raw cents / missing bars. Apologizes to the linter for reusing
// the upstream shape and then gently nudging it.
export function normalizeXaiUsage(result) {
  if (!result?.quotas || typeof result.quotas !== "object") return result;

  const quotas = { ...result.quotas };

  // Prepaid is reported in the billing response's display units. The dashboard
  // groups by the suffix in the quota name (see QuotaTable formatQuotaUsage),
  // so this must spell out Prepaid balance (USD) or it renders as a bare count.
  const prepaid = quotas.Prepaid;
  if (prepaid) {
    delete quotas.Prepaid;
    quotas["Prepaid balance (USD)"] = balance(num(prepaid.total, 0), prepaid.resetAt);
  }
  const config = result.rawConfig || {};
  const usagePercent = (() => {
    const rawPercent = config.creditUsagePercent ?? config.credit_usage_percent;
    return rawPercent && typeof rawPercent === "object" && "val" in rawPercent
      ? num(rawPercent.val)
      : num(rawPercent);
  })();
  const period = config.currentPeriod || config.current_period || {};
  const periodType = String(period.type || "").toUpperCase();
  const hasIncludedQuota = Object.keys(quotas).some((name) =>
    /included|subscription usage/i.test(name),
  );

  let addedWeekly = false;
  if (
    Number.isFinite(usagePercent) &&
    !hasIncludedQuota &&
    (!periodType || periodType.includes("WEEKLY"))
  ) {
    quotas["Subscription usage (weekly)"] = quota(
      Math.min(100, usagePercent),
      100,
      period.end || period.resetAt || config.billingPeriodEnd,
    );
    addedWeekly = true;
  }

  const { rawConfig, ...normalized } = result;

  if (
    addedWeekly &&
    /does not expose a numeric included quota/i.test(normalized.message || "")
  ) {
    delete normalized.message;
  }

  return { ...normalized, quotas };
}
