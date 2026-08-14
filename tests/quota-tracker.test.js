#!/usr/bin/env node
"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const patchPath = fs.existsSync(path.join(__dirname, "../patches/quota-tracker.patch.js"))
  ? path.join(__dirname, "../patches/quota-tracker.patch.js")
  : path.join(__dirname, "quota-tracker.patch.js");
const {
  qtpParseCommandCode,
  qtpParseDeepSeek,
  qtpParseCline,
  qtpParseMimo,
  qtpParseOpenRouter,
  qtpNormalizeXai,
  qtpParseOpenCodeGo,
} = require(patchPath);

const openRouter = qtpParseOpenRouter({
  data: { total_credits: 27.01, total_usage: 24.516287573 },
});
assert.equal(openRouter.quotas["Credits (USD)"].total, 27.01);
assert.equal(openRouter.quotas["Credits (USD)"].used, 24.516287573);

const deepSeek = qtpParseDeepSeek({
  is_available: true,
  balance_infos: [
    {
      currency: "USD",
      total_balance: "3.04",
      granted_balance: "0.00",
      topped_up_balance: "3.04",
    },
  ],
});
assert.equal(deepSeek.quotas["Available balance (USD)"].total, 3.04);
assert.equal(deepSeek.quotas["Topped up balance (USD)"].total, 3.04);

const commandCode = qtpParseCommandCode({
  credits: {
    monthlyCredits: 0.0745,
    purchasedCredits: 0,
    freeCredits: 0,
  },
  windowLimits: {
    limited: true,
    fiveHour: { used: 0, cap: 9, resetAt: 0 },
    weekly: { used: 1.6686, cap: 18, resetAt: 1784222275457 },
  },
}, {
  success: true,
  data: {
    planId: "individual-pro",
    status: "active",
    currentPeriodEnd: "2026-07-25T13:02:09.000Z",
  },
});
assert.equal(commandCode.plan, "Pro");
assert.equal(
  commandCode.quotas["Monthly credits (USD) - renews 25/07/2026"].total,
  0.0745,
);
assert.equal(
  commandCode.quotas["Monthly credits (USD) - renews 25/07/2026"].resetAt,
  "2026-07-25T13:02:09.000Z",
);
assert.equal(commandCode.quotas["5 hour window (USD)"].total, 9);
assert.equal(commandCode.quotas["7 day window (USD)"].used, 1.6686);
assert.equal(
  commandCode.quotas["7 day window (USD)"].resetAt,
  "2026-07-16T17:17:55.457Z",
);

const xai = qtpNormalizeXai({
  plan: "GrokPro",
  quotas: {
    "On-demand": { used: 1, total: 1, remainingPercentage: 0 },
    Prepaid: { used: 0, total: 573, remainingPercentage: 100, resetAt: null },
  },
  rawConfig: {
    currentPeriod: {
      type: "USAGE_PERIOD_TYPE_WEEKLY",
      start: "2026-07-16T18:18:37.950203+00:00",
      end: "2026-07-23T18:18:37.950203+00:00",
    },
    creditUsagePercent: 100,
  },
});
assert.equal(xai.quotas.Prepaid, undefined);
assert.equal(xai.quotas["Prepaid balance (USD)"].total, 5.73);
assert.equal(xai.quotas["On-demand"].total, 1);
assert.equal(xai.quotas["Subscription usage (weekly)"].used, 100);
assert.equal(xai.quotas["Subscription usage (weekly)"].total, 100);
assert.equal(xai.quotas["Subscription usage (weekly)"].remainingPercentage, 0);
assert.equal(
  xai.quotas["Subscription usage (weekly)"].resetAt,
  "2026-07-23T18:18:37.950Z",
);
assert.equal(xai.rawConfig, undefined);

const xaiPercentOnly = qtpNormalizeXai({
  plan: "GrokPro",
  message: "Subscription access is active; Grok does not expose a numeric included quota.",
  quotas: {},
  rawConfig: {
    currentPeriod: {
      type: "USAGE_PERIOD_TYPE_WEEKLY",
      end: "2026-07-23T18:18:37.950203+00:00",
    },
    creditUsagePercent: 100,
    prepaidBalance: { val: 0 },
  },
});
assert.equal(xaiPercentOnly.message, undefined);
assert.equal(xaiPercentOnly.rawConfig, undefined);
assert.equal(xaiPercentOnly.quotas["Subscription usage (weekly)"].used, 100);

const mimo = qtpParseMimo({
  code: 0,
  data: {
    balance: "25.51",
    currency: "USD",
    cashBalance: "20.00",
    giftBalance: "5.51",
  },
});
assert.equal(mimo.quotas["Available balance (USD)"].total, 25.51);
assert.equal(mimo.quotas["Paid balance (USD)"].total, 20);
assert.equal(mimo.quotas["Granted balance (USD)"].total, 5.51);

const clineNow = Date.parse("2026-07-12T22:00:00.000Z");
const cline = qtpParseCline({
  data: {
    plan: {
      displayName: "Cline Pass (Monthly)",
      entitlements: {
        cline_pass: {
          enabled: true,
          inferenceCapThreshold: {
            last5HoursUsageCostUSDPerUser: 1000000000,
            last7daysUsageCostUSDPerUser: 2500000000,
            last30daysUsageCostUSDPerUser: 5000000000,
          },
        },
      },
    },
    currentPeriodEnd: "2026-08-01T13:50:23Z",
  },
}, [
  { createdAt: "2026-07-12T20:00:00.000Z", costUsd: 125000000 },
  { createdAt: "2026-07-08T20:00:00.000Z", costUsd: 250000000 },
  { createdAt: "2026-06-20T20:00:00.000Z", costUsd: 500000000 },
], clineNow);
assert.equal(cline.plan, "Cline Pass (Monthly) - renews 01/08/2026");
assert.equal(cline.quotas["5 hour window (USD)"].used, 1.25);
assert.equal(cline.quotas["7 day window (USD)"].used, 3.75);
assert.equal(cline.quotas["30 day window (USD)"].used, 8.75);
assert.equal(cline.quotas["5 hour window (USD)"].total, 10);
assert.equal(cline.quotas["7 day window (USD)"].total, 25);
assert.equal(cline.quotas["30 day window (USD)"].total, 50);
assert.equal(
  cline.quotas["5 hour window (USD)"].resetAt,
  "2026-07-13T01:00:00.000Z",
);

assert.equal(qtpParseOpenRouter({ data: {} }), null);
assert.equal(qtpParseDeepSeek({ balance_infos: [] }), null);
assert.equal(qtpParseCommandCode({ credits: {}, windowLimits: {} }), null);
assert.equal(qtpParseMimo({ data: {} }), null);

const openCodeGo = qtpParseOpenCodeGo({
  usage: {
    rolling: { status: "ok", percent: 12.5, resetsAt: "2026-08-14T19:38:42.207Z" },
    weekly: { status: "ok", percent: 0, resetsAt: "2026-08-17T00:00:00.207Z" },
    monthly: { status: "ok", percent: 40, resetsAt: "2026-09-12T12:23:26.207Z" },
  },
}, Date.parse("2026-08-14T14:00:00.000Z"));
assert.equal(openCodeGo.plan, "OpenCode Go");
assert.equal(openCodeGo.source, "opencode-go");
assert.equal(openCodeGo.status, "ok");
assert.equal(openCodeGo.quotas["Rolling (5h)"].used, 12.5);
assert.equal(openCodeGo.quotas["Rolling (5h)"].total, 100);
assert.equal(openCodeGo.quotas["Rolling (5h)"].remainingPercentage, 87.5);
assert.equal(openCodeGo.quotas["Rolling (5h)"].resetAt, "2026-08-14T19:38:42.207Z");
assert.equal(openCodeGo.quotas.Weekly.used, 0);
assert.equal(openCodeGo.quotas.Weekly.remainingPercentage, 100);
assert.equal(openCodeGo.quotas.Monthly.used, 40);
assert.equal(openCodeGo.quotas.Monthly.resetAt, "2026-09-12T12:23:26.207Z");

assert.equal(qtpParseOpenCodeGo({}), null);
assert.equal(qtpParseOpenCodeGo({ usage: {} }), null);
assert.equal(qtpParseOpenCodeGo({ usage: { rolling: { percent: "nope" } } }), null);

const clamped = qtpParseOpenCodeGo({
  usage: { rolling: { percent: 140, resetsAt: "2026-08-14T19:00:00.000Z" } },
});
assert.equal(clamped.quotas["Rolling (5h)"].used, 100);
assert.equal(clamped.quotas["Rolling (5h)"].remainingPercentage, 0);

console.log("quota tracker parser tests: ok");
