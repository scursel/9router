#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOME = os.homedir();
const PACKAGE_ROOT = process.env.NINE_ROUTER_PACKAGE_ROOT ||
  path.join(HOME, ".hermes/node/lib/node_modules/9router");
const PACKAGE_JSON = path.join(PACKAGE_ROOT, "package.json");
const SERVER_ROOT = path.join(PACKAGE_ROOT, "app/.next-cli-build/server");
const USAGE_RELATIVE = "chunks/7211.js";
const USAGE_CHUNK = path.join(SERVER_ROOT, USAGE_RELATIVE);
const UI_RELATIVES = new Set([
  "app/(dashboard)/dashboard/quota/page.js",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-5dcceb20e5aa06cf.js",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-870b92d68d6da60f.js",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-4a4e8b584d49bc4c.js",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-f863f4ec3b739500.js",
]);
const SUPPORTED_VERSION = "0.5.35";
const UPSTREAM_CATALOG_HASHES = {
  "app/api/models/route.js": "7e150ccf2352d9457a204e87c89065a8ad81c9a3bdae1647ef6dbfab1efd9fc7",
  "app/api/provider-nodes/route.js": "a6f1767762b0b03f3a43b38c04eb9ab11fa60bf62fe9a5ac0be3b7cf8a36e1a2",
  "app/api/providers/client/route.js": "6468c375a2f7003d0798deb629394a0c8d25aae252ea35733b17842ca0c17ce7",
  "app/api/providers/route.js": "21e7d86e3d272904e3c410ff34d42d53e4857e3b94a4581639270ad5a906162b",
  "app/api/providers/validate/route.js": "62fb68b716c664fbd4727ff699af919f331ed92e72f7626c040e6cf6853c19f2",
  "app/api/translator/console-logs/route.js": "c73a8f43bf5f61494b661b20c74dababbc9d7c6640896f31a13f27672b45946f",
  "app/api/translator/console-logs/stream/route.js": "6797bfdb6ac36b6153eec6a279a9829a70b3d169ad77905cf00df663667fcaf0",
  "app/api/usage/providers/route.js": "feff8920bef028c0eca8150af8eb5a17203ca6f5d58dee1693420b718a4e5ba4",
  "app/api/v1/audio/speech/route.js": "493c42dab6d5b89e97d7a0eeca6801fdab7a35e2b30079e61544ff1a95375eef",
  "app/api/v1/audio/transcriptions/route.js": "34d6c1373094e1236b5fb5cdd350976448f39351e060089a2531f0a3c30b2a34",
  "app/api/v1/models/info/route.js": "e6033c5f28db2fedb599b4adc509b7493c728a90c60048d552012d5c6f578180",
  "app/api/v1beta/models/route.js": "ab0a78b24d6f7a3d646d1a33a5cbac0314d0a56adea8c6119e93a9cc440fc880",
  "chunks/2231.js": "916890f40b9425d97cbd23c57f0676173ea87d5856234215431ee189ac89e204",
  "chunks/4746.js": "d5f201f3c1015351eb9bfc9b81510b6eefa474e6cee453b6fede70d01002bfaa",
  "chunks/4827.js": "25e1cd6afb3dd217f9956a29e0d2c61ccc76254fc2eb1b79eb43aac2dcb8c5aa",
  "chunks/615.js": "d7efe526cd81539c92f9743c7745714dad24b4842cea7f731ccc4663a7de5b64",
  "chunks/8238.js": "37efbbd68e12d887e725522d9abf863217c50c13ec66428461ffdb8be32d29e5",
  "chunks/8271.js": "7770c89fec19cc45b1a2d8f7bf400f69da212f0b7c12d083936d972051bcd8a8",
  "chunks/9630.js": "3d1db13f60b81ceeb60cb2e4e2523471c87dbadb084d6d09ba9a9017ead6384b",
  "app/(dashboard)/dashboard/quota/page.js": "6e27a6c77cb844c6b12831cc80d84f498f60625d431453a7e2627583d76cf464",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-5dcceb20e5aa06cf.js": "6642239fe1e35258bab004b81078bed2dbb5f9accd4a25562d4e1194b1c62145",
};
const ENHANCED_CATALOG_HASHES = {
  "app/api/models/route.js": "97fb8c3bcd08fb67b650b751161f06a8bdebe837b6c514a5e7f1b610faa55c64",
  "app/api/provider-nodes/route.js": "430101d0720ce74f4521855d788bdcbe912a90e5aaf6c853513b2c14a34a8303",
  "app/api/providers/client/route.js": "6ac91d804cc5c716e53053d992ccf084fa1a1873f83e72acd5ce0b5b067a37a0",
  "app/api/providers/route.js": "ddf74e29f86e6ea0ff52b31cfe10975bca3f8bc1f201a7c293a0208ee68f0a85",
  "app/api/providers/validate/route.js": "0c1ba8803790d3888b180a51808270c295aab194c9636aaa5484ff545cde9073",
  "app/api/translator/console-logs/route.js": "76c9ab70d0b2a9e722682e2610f3bacfc657f7e1d9f90f4154707b13f8e0489e",
  "app/api/translator/console-logs/stream/route.js": "1df03c5c78912375400c35d90e37761b6b9d43384cdaaf35bfdfeb8d8d978bf5",
  "app/api/usage/providers/route.js": "396c894170f1ab5cc25f57bdc5041597c79f9b102a0c7d058b1596ed99161000",
  "app/api/v1/audio/speech/route.js": "a8c2160ab02da87bfdc8a08d6a579377ac8a348b88cdda9618defd9348f74448",
  "app/api/v1/audio/transcriptions/route.js": "e252ecb27d8f893f3ca96746f2c60268e0653615e78c2e967b4987994fe58c5b",
  "app/api/v1/models/info/route.js": "dae61a998aebdc42617cb18d7b0ff41fa0be2dac8424ab857dd67be2e16d93d6",
  "app/api/v1beta/models/route.js": "ae0a07ca97805dcb2be131623ed4c5a06b928ec2bb713feba7fbbb60f2369a07",
  "chunks/2231.js": "916890f40b9425d97cbd23c57f0676173ea87d5856234215431ee189ac89e204",
  "chunks/4746.js": "f20ad225e895a64ef51ac4be0f4442092e4a646c71f9a87c7e1e0a94b6ec3f13",
  "chunks/4827.js": "25e1cd6afb3dd217f9956a29e0d2c61ccc76254fc2eb1b79eb43aac2dcb8c5aa",
  "chunks/615.js": "d7efe526cd81539c92f9743c7745714dad24b4842cea7f731ccc4663a7de5b64",
  "chunks/8238.js": "37efbbd68e12d887e725522d9abf863217c50c13ec66428461ffdb8be32d29e5",
  "chunks/8271.js": "7770c89fec19cc45b1a2d8f7bf400f69da212f0b7c12d083936d972051bcd8a8",
  "chunks/9630.js": "3d1db13f60b81ceeb60cb2e4e2523471c87dbadb084d6d09ba9a9017ead6384b",
  "app/(dashboard)/dashboard/quota/page.js": "28398ce4513f781f8603e2d8df8453375a45b500e5a0370777c5302c6b05882d",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-870b92d68d6da60f.js": "4277a9a97a6fbc905e8bf7db774699da92aa23318cdb9dbc92856bda5423b77b",
};
const OFFICIAL_0535_CATALOG_HASHES = {
  "chunks/1829.js": "5a47eafdb2eb494aa49062405bfd710ed29e5a672eef7b04fc61e3cc1fd74d4d",
  "chunks/615.js": "d7efe526cd81539c92f9743c7745714dad24b4842cea7f731ccc4663a7de5b64",
  "chunks/7011.js": "1f37fd477af0bacf10d0a267f042a389e98b5ebdc55d74f5f072f7cd981c06da",
  "chunks/7211.js": "8649d5a3c0c6ae26cac0e9a929825b3bd32de80853e5be7729bcfe2e35cd5cb4",
  "chunks/827.js": "6b1a4f96c6995d8d5dfd9804ccaed7c7f8a7d3bbb723e2cf1b17551842083de2",
  "chunks/869.js": "baa6167a895f4d990beed132d2a734150f14a1c783b57755f356bdbf964d9a71",
  "app/api/provider-nodes/route.js": "e8750c989854b8f5d74dd5df6b84c71a7903180d2c95f4742feeabe17aae7095",
  "app/api/providers/client/route.js": "87631725154d2fdafd0c8088ba384254a951bd2a3f113455e7e035895c1ea75a",
  "app/api/providers/validate/route.js": "03593b3ef6d26e507fdb10194e29ae732bf5fb4e7d27b54363be83e82fd3775d",
  "app/api/usage/[connectionId]/route.js": "ddf6444af988cada6d6e07d3eada9c5e580a74736ef18da715ca4cbc88dd62fa",
  "app/api/usage/providers/route.js": "927e01c945f1ba8916ff3e2316a447924419f7061ec83d522b61dfe3053fadd9",
  "app/api/usage/[connectionId]/codex-reset-credits/route.js": "39fc3605e2d881c0eb41ff27d877144b0a3e5ed75abe06762b1a91211b737267",
  "app/api/v1/audio/voices/route.js": "ee752f0d3d3b44e0dcbbf083749ee18ae8416b0d5111680e1e073d1c36dd3a18",
  "app/api/v1/models/info/route.js": "a8be98a1316ce26c9f3620bbbb17fcc763ca61f058fc6f95637e7cfe4f38d5e8",
  "app/api/v1beta/models/route.js": "71a2ef33077cd1906af3688bde526a18a71f6403914c3b02c5a30e4e3fd5ec3a",
  "app/(dashboard)/dashboard/quota/page.js": "5b7fb600fa5bd4a1a80170de3b62cfa8c756364883668649baf44cf69279587c",
  "../static/chunks/1321-7f70ea1854851a9b.js": "bd14232cfee41fd6e37c56f84c9896b2644d409d13d66ea009a91941fc8807b3",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-4a4e8b584d49bc4c.js": "0aacfa30c851c78a4d8aee57cb809593f3d3cd0e02a560cd88b4c6763ee984a8",
};
const ENHANCED_0535_CATALOG_HASHES = {
  "chunks/1829.js": "5a47eafdb2eb494aa49062405bfd710ed29e5a672eef7b04fc61e3cc1fd74d4d",
  "chunks/615.js": "d7efe526cd81539c92f9743c7745714dad24b4842cea7f731ccc4663a7de5b64",
  "chunks/6323.js": "96abaaa3eca8050d9b7ca4e6f2d6b5031872b8d2a7104163f7789ac5af79d2df",
  "chunks/7211.js": "f6e033feb6aa66c56ad1f21b3c5bc7a96a8bd671dd93723aeffdefa40dfdc83f",
  "chunks/827.js": "6b1a4f96c6995d8d5dfd9804ccaed7c7f8a7d3bbb723e2cf1b17551842083de2",
  "chunks/869.js": "baa6167a895f4d990beed132d2a734150f14a1c783b57755f356bdbf964d9a71",
  "app/api/provider-nodes/route.js": "900f80eeff3c13b57df0018d63e7b2031e4b88eb9c99586e968cbcd9c7a08578",
  "app/api/providers/client/route.js": "39981e12376bcec0592a7cd914f318f7017a255e1e57b7e8147c52c0f6aa4d1c",
  "app/api/providers/validate/route.js": "1eac5b362f756f65dda97440eac8970d5dbb71a4b8f913c8c1d54e9d6e17a5c1",
  "app/api/usage/[connectionId]/route.js": "44f8b09ec4f555dec8bd77241ebf7d95fa7f49242c42be9f1410f4728f569435",
  "app/api/usage/providers/route.js": "917839c509475f85fba9f99fb9459b64ed192ecb00a9e012cbbba90569ed78ab",
  "app/api/usage/[connectionId]/codex-reset-credits/route.js": "e89aa546ed335781b3a493b83de991e4069d800f2fd9f14187d732b8f4b7baa0",
  "app/api/v1/audio/voices/route.js": "aee99d062e446112b8f733e340af130c1605ad849050f3e39f971646f52aaa67",
  "app/api/v1/models/info/route.js": "9b2146b1c04cc3f9549b8e96fa5daf5bcf7ab0baec00e96f82baf2b88262c717",
  "app/api/v1beta/models/route.js": "6ba12477bd329dcf175b0befdcf869dc2a16b88c9611eb2154c99ebf1628dde7",
  "app/(dashboard)/dashboard/quota/page.js": "d0596774e187e860e8c47de26671ef6580c0d0665c53a05af1eed714ac1807e0",
  "../static/chunks/1321-7f70ea1854851a9b.js": "bd14232cfee41fd6e37c56f84c9896b2644d409d13d66ea009a91941fc8807b3",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-f863f4ec3b739500.js": "18191964c4b89b1bea05564ce810e79d56404e54e17d5ae452f5a0ba46f96258",
};
const CATALOG_VARIANT = fs.existsSync(path.join(
  SERVER_ROOT,
  "../static/chunks/app/(dashboard)/dashboard/quota/page-f863f4ec3b739500.js",
)) ? "enhanced-0.5.35" : "official-0.5.35";
const CATALOG_HASHES = CATALOG_VARIANT === "enhanced-0.5.35"
  ? ENHANCED_0535_CATALOG_HASHES
  : OFFICIAL_0535_CATALOG_HASHES;
const ORIGINALS_DIR = path.join(__dirname, `quota-tracker-originals/${CATALOG_VARIANT}`);
const MAIN_MARKER = "/* QuotaTrackerPatch:v2 */";
const PROVIDERS_MARKER = "/* QuotaTrackerProviders:v2 */";
const UI_MARKER = "/* QuotaTrackerCurrency:v2 */";
const DISPATCH_MARKER = "let V={github:";
const GROK_RESULT_MARKER = "return{plan:i.plan,quotas:i.quotas}";
const GROK_RESULT_PATCHED =
  "return{plan:i.plan,quotas:i.quotas,rawConfig:i.rawConfig}";
const GROK_EMPTY_RESULT_MARKER = "quotas:{}};return{plan:i.plan,quotas:i.quotas}";
const GROK_EMPTY_RESULT_PATCHED =
  "quotas:{},rawConfig:i.rawConfig};return{plan:i.plan,quotas:i.quotas}";
const USAGE_ALLOW_MARKER =
  "x=d.A.filter(a=>a.features?.usage).map(a=>a.id)";
const USAGE_ALLOW_PATCHED =
  'x=[...new Set([...d.A.filter(a=>a.features?.usage).map(a=>a.id),"openrouter","deepseek","commandcode","xai","xiaomi-mimo","clinepass"])]';
const API_KEY_ALLOW_MARKER =
  "y=d.A.filter(a=>a.features?.usageApikey).map(a=>a.id)";
const API_KEY_ALLOW_PATCHED =
  'y=[...new Set([...d.A.filter(a=>a.features?.usageApikey).map(a=>a.id),"openrouter","deepseek","commandcode","xiaomi-mimo","clinepass"])]';

function qtpNum(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function qtpReset(value) {
  if (!value || Number(value) === 0) return null;
  const date = new Date(
    typeof value === "number" && value < 1e12 ? value * 1000 : value,
  );
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function qtpDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return null;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

function qtpQuota(used, total, resetAt = null) {
  const safeUsed = Math.max(0, qtpNum(used, 0));
  const safeTotal = Math.max(0, qtpNum(total, 0));
  const remaining = Math.max(0, safeTotal - safeUsed);
  return {
    used: safeUsed,
    total: safeTotal,
    remainingPercentage: safeTotal > 0 ? (remaining / safeTotal) * 100 : 0,
    resetAt: qtpReset(resetAt),
    unlimited: false,
  };
}

function qtpBalance(amount, resetAt = null) {
  const balance = Math.max(0, qtpNum(amount, 0));
  return {
    used: 0,
    total: balance,
    remainingPercentage: balance > 0 ? 100 : 0,
    resetAt: qtpReset(resetAt),
    unlimited: false,
  };
}

function qtpParseOpenRouter(body) {
  const data = body && typeof body.data === "object" ? body.data : body;
  const total = qtpNum(data?.total_credits);
  const used = qtpNum(data?.total_usage);
  if (Number.isFinite(total) && Number.isFinite(used)) {
    return {
      plan: "Credits",
      quotas: { "Credits (USD)": qtpQuota(used, total) },
    };
  }

  const limit = qtpNum(data?.limit);
  const usage = qtpNum(data?.usage, 0);
  if (Number.isFinite(limit) && limit > 0) {
    return {
      plan: data?.is_free_tier ? "Free" : "API key",
      quotas: {
        "Key limit (USD)": qtpQuota(usage, limit, data?.limit_reset),
      },
    };
  }
  return null;
}

function qtpParseDeepSeek(body) {
  const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
  const quotas = {};
  for (const info of infos) {
    const currency = String(info?.currency || "USD").toUpperCase();
    const total = qtpNum(info?.total_balance, 0);
    const granted = qtpNum(info?.granted_balance, 0);
    const toppedUp = qtpNum(info?.topped_up_balance, 0);
    quotas[`Available balance (${currency})`] = qtpBalance(total);
    if (granted > 0) quotas[`Promotional balance (${currency})`] = qtpBalance(granted);
    if (toppedUp > 0) quotas[`Topped up balance (${currency})`] = qtpBalance(toppedUp);
  }
  if (!Object.keys(quotas).length) return null;
  return {
    plan: body?.is_available === false ? "Unavailable" : "API balance",
    quotas,
  };
}

function qtpParseCommandCode(body, subscriptionBody = null) {
  const credits = body?.credits || {};
  const limits = body?.windowLimits || {};
  const subscription = subscriptionBody?.data || subscriptionBody || {};
  const renewalAt = subscription.currentPeriodEnd || null;
  const renewalDate = qtpDate(renewalAt);
  const quotas = {};
  const monthly = qtpNum(credits.monthlyCredits, 0);
  const purchased = qtpNum(credits.purchasedCredits, 0);
  const free = qtpNum(credits.freeCredits, 0);
  if (monthly > 0) {
    const monthlyName = renewalDate
      ? `Monthly credits (USD) - renews ${renewalDate}`
      : "Monthly credits (USD)";
    quotas[monthlyName] = qtpBalance(monthly, renewalAt);
  }
  if (purchased > 0) quotas["Purchased credits (USD)"] = qtpBalance(purchased);
  if (free > 0) quotas["Free credits (USD)"] = qtpBalance(free);

  const fiveHour = limits.fiveHour;
  if (fiveHour && qtpNum(fiveHour.cap, 0) > 0) {
    quotas["5 hour window (USD)"] = qtpQuota(
      fiveHour.used,
      fiveHour.cap,
      fiveHour.resetAt,
    );
  }
  const weekly = limits.weekly;
  if (weekly && qtpNum(weekly.cap, 0) > 0) {
    quotas["7 day window (USD)"] = qtpQuota(
      weekly.used,
      weekly.cap,
      weekly.resetAt,
    );
  }
  if (!Object.keys(quotas).length) return null;
  const planId = String(subscription.planId || "");
  const plan = planId
    ? planId
        .replace(/^individual-/, "")
        .replace(/^teams-/, "Teams ")
        .replace(/(^|[- ])\w/g, (match) => match.toUpperCase().replace("-", " "))
    : limits.limited === false
      ? "Pay as you go"
      : "Subscription";
  return { plan, quotas };
}

function qtpNormalizeXai(result) {
  if (!result?.quotas || typeof result.quotas !== "object") return result;
  const quotas = { ...result.quotas };
  const config = result.rawConfig || {};
  const usagePercent = qtpNum(
    config.creditUsagePercent ?? config.credit_usage_percent,
  );
  const period = config.currentPeriod || config.current_period || {};
  const periodType = String(period.type || "").toUpperCase();
  const hasIncludedQuota = Object.keys(quotas).some((name) =>
    /included|subscription usage/i.test(name),
  );
  let addedSubscriptionUsage = false;
  if (
    Number.isFinite(usagePercent) &&
    !hasIncludedQuota &&
    (!periodType || periodType.includes("WEEKLY"))
  ) {
    quotas["Subscription usage (weekly)"] = qtpQuota(
      Math.min(100, usagePercent),
      100,
      period.end || period.resetAt || config.billingPeriodEnd,
    );
    addedSubscriptionUsage = true;
  }

  const prepaid = quotas.Prepaid;
  if (prepaid) {
    delete quotas.Prepaid;
    quotas["Prepaid balance (USD)"] = qtpBalance(
      qtpNum(prepaid.total, 0) / 100,
      prepaid.resetAt,
    );
  }
  const { rawConfig, ...normalized } = result;
  if (
    addedSubscriptionUsage &&
    /does not expose a numeric included quota/i.test(normalized.message || "")
  ) {
    delete normalized.message;
  }
  return { ...normalized, quotas };
}

function qtpParseMimo(body) {
  const data = body?.data || body?.result || body;
  if (!data || typeof data !== "object") return null;
  const balance = qtpNum(data.balance);
  if (!Number.isFinite(balance)) return null;
  const currency = String(data.currency || "USD").toUpperCase();
  const quotas = {
    [`Available balance (${currency})`]: qtpBalance(balance),
  };
  const cash = qtpNum(data.cashBalance);
  const gift = qtpNum(data.giftBalance);
  if (Number.isFinite(cash) && cash > 0) {
    quotas[`Paid balance (${currency})`] = qtpBalance(cash);
  }
  if (Number.isFinite(gift) && gift > 0) {
    quotas[`Granted balance (${currency})`] = qtpBalance(gift);
  }
  return { plan: "API balance", quotas };
}

function qtpParseCline(planBody, usageItems, now = Date.now()) {
  const current = planBody?.data || planBody || {};
  const plan = current.plan || {};
  const pass = plan.entitlements?.cline_pass;
  const limits = pass?.inferenceCapThreshold;
  if (!pass?.enabled || !limits) return null;

  const nowMs = qtpNum(now, Date.now());
  const scale = 100000000;
  const definitions = [
    ["5 hour window (USD)", 5 * 60 * 60 * 1000, limits.last5HoursUsageCostUSDPerUser],
    ["7 day window (USD)", 7 * 24 * 60 * 60 * 1000, limits.last7daysUsageCostUSDPerUser],
    ["30 day window (USD)", 30 * 24 * 60 * 60 * 1000, limits.last30daysUsageCostUSDPerUser],
  ];
  const items = Array.isArray(usageItems) ? usageItems : [];
  const quotas = {};
  for (const [name, duration, rawLimit] of definitions) {
    const limit = qtpNum(rawLimit, 0);
    if (limit <= 0) continue;
    let used = 0;
    let earliest = null;
    const cutoff = nowMs - duration;
    for (const item of items) {
      const createdAt = new Date(item?.createdAt).getTime();
      if (!Number.isFinite(createdAt) || createdAt < cutoff || createdAt > nowMs) continue;
      used += Math.max(0, qtpNum(item?.costUsd, 0));
      if (earliest === null || createdAt < earliest) earliest = createdAt;
    }
    quotas[name] = qtpQuota(
      used / scale,
      limit / scale,
      earliest === null ? null : earliest + duration,
    );
  }
  if (!Object.keys(quotas).length) return null;
  const renewalDate = qtpDate(current.currentPeriodEnd);
  const displayName = String(plan.displayName || plan.name || "ClinePass").replace(/\[Internal\]/g, "").trim();
  return {
    plan: renewalDate ? `${displayName} - renews ${renewalDate}` : displayName,
    quotas,
  };
}

function hash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function atomicWrite(file, content) {
  const temporary = `${file}.quota-tracker-${process.pid}.tmp`;
  fs.writeFileSync(temporary, content, { mode: fs.statSync(file).mode });
  fs.renameSync(temporary, file);
}

function assertVersion() {
  const version = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8")).version;
  if (version !== SUPPORTED_VERSION) {
    console.error(
      `[quota-tracker] 9Router ${version} differs from tested ${SUPPORTED_VERSION}; verifying bundle compatibility.`,
    );
  }
  return version;
}

function stripV1(content) {
  const marker = "/* QuotaTrackerPatch:v1 */";
  if (!content.includes(marker)) return content;
  const start = content.indexOf(marker);
  const dispatch = "let T={...T,...Z,github:";
  const end = content.indexOf(dispatch, start);
  if (end < 0) throw new Error("Cannot remove incomplete v1 quota patch");
  let clean = content.slice(0, start) + "let T={github:" + content.slice(end + dispatch.length);
  clean = clean.replace(
    'y=[...new Set([...d.A.filter(a=>a.features?.usageApikey).map(a=>a.id),"openrouter","deepseek","commandcode","xai"])]',
    API_KEY_ALLOW_MARKER,
  );
  clean = clean.replace(USAGE_ALLOW_PATCHED, USAGE_ALLOW_MARKER);
  return clean;
}

function runtimeFunctions() {
  return [
    qtpNum,
    qtpReset,
    qtpDate,
    qtpQuota,
    qtpBalance,
    qtpParseOpenRouter,
    qtpParseDeepSeek,
    qtpParseCommandCode,
    qtpNormalizeXai,
    qtpParseMimo,
    qtpParseCline,
  ]
    .map((fn) => fn.toString())
    .join("");
}

function injectedCode() {
  return (
    MAIN_MARKER +
    runtimeFunctions() +
    'async function qtpGet(a,b,c){try{let g=await(0,d.proxyAwareFetch)(a,{method:"GET",headers:{Authorization:"Bearer "+b,Accept:"application/json"}},c),h=await g.json().catch(()=>null);return{ok:g.ok,status:g.status,body:h}}catch(a){return{ok:!1,status:0,error:a?.name==="AbortError"?"timeout":"request failed"}}}' +
    'function qtpError(a,b){return{message:b+" quota API "+(a.status?"error ("+a.status+").":a.error+"."),quotas:{}}}' +
    'async function qtpOpenRouter(a,b){if(!a)return{message:"OpenRouter API key not available.",quotas:{}};let c=await qtpGet("https://openrouter.ai/api/v1/credits",a,b);if(c.ok){let a=qtpParseOpenRouter(c.body);if(a)return a}let d=await qtpGet("https://openrouter.ai/api/v1/auth/key",a,b);if(d.ok){let a=qtpParseOpenRouter(d.body);if(a)return a}return qtpError(c.status===401||c.status===403?c:d,"OpenRouter")}' +
    'async function qtpDeepSeek(a,b){if(!a)return{message:"DeepSeek API key not available.",quotas:{}};let c=await qtpGet("https://api.deepseek.com/user/balance",a,b);if(!c.ok)return qtpError(c,"DeepSeek");let d=qtpParseDeepSeek(c.body);return d||{message:"DeepSeek connected. No balance data was returned.",quotas:{}}}' +
    'async function qtpCommandCode(a,b){if(!a)return{message:"CommandCode API key not available.",quotas:{}};let[c,d]=await Promise.all([qtpGet("https://api.commandcode.ai/alpha/billing/credits",a,b),qtpGet("https://api.commandcode.ai/alpha/billing/subscriptions",a,b)]);if(!c.ok)return qtpError(c,"CommandCode");let e=qtpParseCommandCode(c.body,d.ok?d.body:null);return e||{message:"CommandCode connected. No quota data was returned.",quotas:{}}}' +
    'async function qtpCookieGet(a,b,c){try{let g=await(0,d.proxyAwareFetch)(a,{method:"GET",headers:{Cookie:b,Accept:"application/json",Origin:"https://platform.xiaomimimo.com",Referer:"https://platform.xiaomimimo.com/#/console/balance","User-Agent":"Mozilla/5.0"}},c),h=await g.json().catch(()=>null);return{ok:g.ok,status:g.status,body:h}}catch(a){return{ok:!1,status:0,error:a?.name==="AbortError"?"timeout":"request failed"}}}' +
    'async function qtpMimo(a,b){let c=a?.quotaCookie||a?.cookie||process.env.MIMO_QUOTA_COOKIE;if(!c)return{message:"MiMo balance requires the console cookie in MIMO_QUOTA_COOKIE or providerSpecificData.quotaCookie.",quotas:{}};let d=await qtpCookieGet("https://platform.xiaomimimo.com/api/v1/balance",c,b);if(!d.ok)return qtpError(d,"MiMo");let e=qtpParseMimo(d.body);return e||{message:"MiMo connected. No balance data was returned.",quotas:{}}}' +
    'async function qtpCline(a,b){if(!a)return{message:"ClinePass credential not available.",quotas:{}};let[c,d]=await Promise.all([qtpGet("https://api.cline.bot/api/v1/users/me",a,b),qtpGet("https://api.cline.bot/api/v1/users/me/plan",a,b)]);if(!c.ok)return qtpError(c,"ClinePass");if(!d.ok)return qtpError(d,"ClinePass plan");let e=c.body?.data||c.body||{},g=e.id||e.uid;if(!g)return{message:"ClinePass user ID was not returned.",quotas:{}};let h=[],i="",j=Date.now()-2592e6;for(let c=0;c<100;c++){let e="https://api.cline.bot/api/v1/users/"+encodeURIComponent(g)+"/usages?limit=100"+(i?"&cursor="+encodeURIComponent(i):""),k=await qtpGet(e,a,b);if(!k.ok)return qtpError(k,"ClinePass usage");let l=k.body?.data||k.body||{},m=Array.isArray(l.items)?l.items:[];h.push(...m);i=String(l.nextToken||"");let n=m.map(a=>new Date(a?.createdAt).getTime()).filter(Number.isFinite),o=n.length?Math.min(...n):null;if(!i||!m.length||o!==null&&o<j)break}let k=qtpParseCline(d.body,h);return k||{message:"ClinePass connected. No active quota limits were returned.",quotas:{}}}' +
    'let qtpProviders={openrouter:a=>qtpOpenRouter(a.apiKey,a.proxyOptions),deepseek:a=>qtpDeepSeek(a.apiKey,a.proxyOptions),commandcode:a=>qtpCommandCode(a.apiKey,a.proxyOptions),xai:async a=>qtpNormalizeXai(await M(a.accessToken,a.providerSpecificData,a.proxyOptions)),"xiaomi-mimo":a=>qtpMimo(a.providerSpecificData,a.proxyOptions),clinepass:a=>qtpCline(a.apiKey||a.accessToken,a.proxyOptions)};'
  );
}

function buildUsagePatched(original) {
  if (!original.includes(DISPATCH_MARKER)) {
    throw new Error("9Router usage dispatch marker not found");
  }
  const grokMarker =
    '"grok-cli":a=>M(a.accessToken,a.providerSpecificData,a.proxyOptions)';
  if (!original.includes(grokMarker)) {
    throw new Error("Native Grok usage marker not found");
  }
  if (!original.includes(GROK_RESULT_MARKER)) {
    throw new Error("Native Grok result marker not found");
  }
  if (!original.includes(GROK_EMPTY_RESULT_MARKER)) {
    throw new Error("Native empty Grok result marker not found");
  }
  return original
    .replace(GROK_EMPTY_RESULT_MARKER, GROK_EMPTY_RESULT_PATCHED)
    .replace(GROK_RESULT_MARKER, GROK_RESULT_PATCHED)
    .replace(DISPATCH_MARKER, `${injectedCode()}let V={...qtpProviders,github:`)
    .replace(
      grokMarker,
      '"grok-cli":async a=>qtpNormalizeXai(await M(a.accessToken,a.providerSpecificData,a.proxyOptions))',
    );
}

function buildProvidersPatched(original) {
  const usagePattern =
    /([A-Za-z_$][\w$]*\.A\.filter\(([A-Za-z_$][\w$]*)=>\2\.features\?\.usage\)\.map\(\2=>\2\.id\))/;
  const apiKeyPattern =
    /([A-Za-z_$][\w$]*\.A\.filter\(([A-Za-z_$][\w$]*)=>\2\.features\?\.usageApikey\)\.map\(\2=>\2\.id\))/;
  if (!usagePattern.test(original)) {
    throw new Error("Provider client usage allow-list marker not found");
  }
  if (!apiKeyPattern.test(original)) {
    throw new Error("Provider client allow-list marker not found");
  }
  const usageProviders =
    '"openrouter","deepseek","commandcode","xai","xiaomi-mimo","clinepass"';
  const apiKeyProviders =
    '"openrouter","deepseek","commandcode","xiaomi-mimo","clinepass"';
  return original
    .replace(usagePattern, (expression) =>
      `[...new Set([...${expression},${usageProviders}])]`)
    .replace(apiKeyPattern, (expression) =>
      `[...new Set([...${expression},${apiKeyProviders}])]`)
    + PROVIDERS_MARKER;
}

function buildUiPatched(original) {
  const matches = [
    {
      old: 'children:[a.used.toLocaleString()," / ",a.total>0?a.total.toLocaleString():"∞"]',
      replacement:
        'children:a.name.includes("(USD)")?[a.used.toLocaleString("pt-BR",{style:"currency",currency:"USD"})," / ",a.total.toLocaleString("pt-BR",{style:"currency",currency:"USD"})]:[a.used.toLocaleString()," / ",a.total>0?a.total.toLocaleString():"∞"]' +
        UI_MARKER,
    },
    {
      old: 'children:[e.used.toLocaleString()," / ",e.total>0?e.total.toLocaleString():"∞"]',
      replacement:
        'children:e.name.includes("(USD)")?[e.used.toLocaleString("pt-BR",{style:"currency",currency:"USD"})," / ",e.total.toLocaleString("pt-BR",{style:"currency",currency:"USD"})]:[e.used.toLocaleString()," / ",e.total>0?e.total.toLocaleString():"∞"]' +
        UI_MARKER,
    },
  ];
  const match = matches.find(({ old }) => original.includes(old));
  if (!match) throw new Error("Quota currency renderer marker not found");
  return original.replace(match.old, match.replacement);
}

function markerFor(relative) {
  if (relative === USAGE_RELATIVE) return MAIN_MARKER;
  if (UI_RELATIVES.has(relative)) return UI_MARKER;
  return PROVIDERS_MARKER;
}

function buildPatched(relative, original) {
  if (relative === USAGE_RELATIVE) return buildUsagePatched(original);
  if (UI_RELATIVES.has(relative)) return buildUiPatched(original);
  return buildProvidersPatched(original);
}

function originalPath(relative) {
  return path.join(ORIGINALS_DIR, "server", relative);
}

function saveOriginal(relative, content) {
  const file = originalPath(relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, content);
  }
}

function apply() {
  assertVersion();
  const entries = Object.entries(CATALOG_HASHES).map(([relative, expectedHash]) => {
    const file = path.join(SERVER_ROOT, relative);
    let content = fs.readFileSync(file, "utf8");
    if (relative === USAGE_RELATIVE) content = stripV1(content);
    return { relative, expectedHash, file, content };
  });
  const patchedCount = entries.filter(({ relative, content }) =>
    content.includes(markerFor(relative)),
  ).length;
  if (patchedCount === entries.length) {
    for (const entry of entries) {
      const saved = originalPath(entry.relative);
      if (!fs.existsSync(saved)) {
        throw new Error(`Original bundle unavailable for verification: ${entry.relative}`);
      }
      const original = fs.readFileSync(saved, "utf8");
      if (hash(original) !== entry.expectedHash) {
        throw new Error(`Saved original hash mismatch: ${entry.relative}`);
      }
      if (entry.content !== buildPatched(entry.relative, original)) {
        throw new Error(`Patched bundle changed unexpectedly: ${entry.relative}`);
      }
    }
    return false;
  }
  if (patchedCount !== 0) {
    const restore = [];
    for (const entry of entries) {
      if (!entry.content.includes(markerFor(entry.relative))) {
        if (hash(entry.content) !== entry.expectedHash) {
          throw new Error(`Unsafe partial patch recovery for ${entry.relative}`);
        }
        continue;
      }
      const saved = originalPath(entry.relative);
      if (!fs.existsSync(saved)) {
        throw new Error(`Original bundle unavailable for recovery: ${entry.relative}`);
      }
      const original = fs.readFileSync(saved, "utf8");
      if (
        hash(original) !== entry.expectedHash ||
        entry.content !== buildPatched(entry.relative, original)
      ) {
        throw new Error(`Unsafe partial patch recovery for ${entry.relative}`);
      }
      restore.push({ file: entry.file, original });
    }
    for (const entry of restore) atomicWrite(entry.file, entry.original);
    return apply();
  }

  for (const entry of entries) {
    const actualHash = hash(entry.content);
    if (actualHash !== entry.expectedHash) {
      throw new Error(`Unsupported bundle hash for ${entry.relative}: ${actualHash}`);
    }
  }
  const outputs = entries.map((entry) => ({
    ...entry,
    patched: buildPatched(entry.relative, entry.content),
  }));
  for (const entry of entries) saveOriginal(entry.relative, entry.content);
  for (const output of outputs) atomicWrite(output.file, output.patched);
  return true;
}

function rollback() {
  assertVersion();
  const entries = Object.keys(CATALOG_HASHES).map((relative) => {
    const file = path.join(SERVER_ROOT, relative);
    const saved = originalPath(relative);
    if (!fs.existsSync(saved)) {
      throw new Error(`Original bundle unavailable for rollback: ${relative}`);
    }
    const original = fs.readFileSync(saved, "utf8");
    const expected = buildPatched(relative, original);
    return { relative, file, original, expected, current: fs.readFileSync(file, "utf8") };
  });
  const patchedCount = entries.filter(({ relative, current }) =>
    current.includes(markerFor(relative)),
  ).length;
  if (patchedCount === 0) return false;
  if (patchedCount !== entries.length) {
    throw new Error("Partial quota patch detected; refusing unsafe rollback");
  }
  for (const entry of entries) {
    if (entry.current !== entry.expected) {
      throw new Error(`Patched bundle changed unexpectedly: ${entry.relative}`);
    }
  }
  for (const entry of entries) atomicWrite(entry.file, entry.original);
  return true;
}

function sanitize() {
  let restored = 0;
  for (const relative of Object.keys(CATALOG_HASHES)) {
    const file = path.join(SERVER_ROOT, relative);
    if (!fs.existsSync(file)) continue;
    const current = fs.readFileSync(file, "utf8");
    if (!current.includes(markerFor(relative))) continue;
    const saved = originalPath(relative);
    if (!fs.existsSync(saved)) {
      throw new Error(`Original bundle unavailable for sanitization: ${relative}`);
    }
    const original = fs.readFileSync(saved, "utf8");
    if (current !== buildPatched(relative, original)) {
      throw new Error(`Refusing to sanitize an unknown patched bundle: ${relative}`);
    }
    atomicWrite(file, original);
    restored++;
  }
  return restored;
}

function check() {
  const usage = fs.readFileSync(USAGE_CHUNK, "utf8");
  const catalogPatched = Object.keys(CATALOG_HASHES).filter((relative) => {
    const content = fs.readFileSync(path.join(SERVER_ROOT, relative), "utf8");
    return content.includes(markerFor(relative));
  }).length;
  const state = {
    version: JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8")).version,
    usagePatched: usage.includes(MAIN_MARKER),
    catalogPatched,
    catalogTotal: Object.keys(CATALOG_HASHES).length,
    usageHash: hash(usage),
  };
  console.log(JSON.stringify(state, null, 2));
  return state;
}

function main() {
  const command = process.argv[2] || "--check";
  if (command === "--apply") console.log(apply() ? "applied" : "already applied");
  else if (command === "--rollback") {
    console.log(rollback() ? "rolled back" : "already clean");
  } else if (command === "--sanitize") {
    const restored = sanitize();
    console.log(restored ? `sanitized ${restored} bundle(s)` : "already clean");
  } else if (command === "--check") check();
  else throw new Error("usage: --check|--apply|--rollback|--sanitize");
}

module.exports = {
  qtpBalance,
  qtpParseCommandCode,
  qtpParseDeepSeek,
  qtpParseCline,
  qtpParseMimo,
  qtpParseOpenRouter,
  qtpNormalizeXai,
  qtpQuota,
};

if (require.main === module) main();
