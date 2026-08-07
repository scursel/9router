#!/usr/bin/env node
"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const {
  qtpParseAlibabaTokenPlan,
} = require("../patches/quota-tracker.patch.js");

const fixture = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "fixtures/alibaba-token-plan/usage.json"),
    "utf8",
  ),
);

// 1. Standard fixture test
const parsed = qtpParseAlibabaTokenPlan(fixture);
assert.notEqual(parsed, null);
assert.equal(parsed.plan, "Alibaba Token Plan");
assert.equal(parsed.quotas["5 hour window (%)"].used, 37);
assert.equal(parsed.quotas["5 hour window (%)"].total, 100);
assert.equal(parsed.quotas["5 hour window (%)"].remainingPercentage, 63);
assert.equal(parsed.quotas["5 hour window (%)"].resetAt, "2026-08-08T01:00:00.000Z");
assert.equal(parsed.quotas["7 day window (%)"].used, 12);
assert.equal(parsed.quotas["7 day window (%)"].total, 100);
assert.equal(parsed.quotas["7 day window (%)"].remainingPercentage, 88);
assert.equal(parsed.quotas["7 day window (%)"].resetAt, "2026-08-13T00:00:00.000Z");

// 2. Invalid / missing cases
assert.equal(qtpParseAlibabaTokenPlan(null), null);
assert.equal(qtpParseAlibabaTokenPlan({}), null);
assert.equal(qtpParseAlibabaTokenPlan({ data: null }), null);
assert.equal(qtpParseAlibabaTokenPlan({ data: { DataV2: { data: { data: {} } } } }), null);
assert.equal(
  qtpParseAlibabaTokenPlan({
    data: {
      DataV2: {
        data: {
          data: {
            per5HourPercentage: 0.37,
            per5HourResetTime: 1786150800000,
          },
        },
      },
    },
  }),
  null,
);
assert.equal(
  qtpParseAlibabaTokenPlan({
    data: {
      DataV2: {
        data: {
          data: {
            per1WeekPercentage: 0.12,
            per1WeekResetTime: 1786579200000,
          },
        },
      },
    },
  }),
  null,
);
assert.equal(
  qtpParseAlibabaTokenPlan({
    per5HourPercentage: "invalid",
    per5HourResetTime: 1786150800000,
    per1WeekPercentage: 0.12,
    per1WeekResetTime: 1786579200000,
  }),
  null,
);

// 3. Percentage clamping, numeric strings, and ratio vs percentage
const stringNumericRatio = qtpParseAlibabaTokenPlan({
  per5HourPercentage: "0.37",
  per5HourResetTime: 1786150800000,
  per1WeekPercentage: "0.12",
  per1WeekResetTime: 1786579200000,
});
assert.equal(stringNumericRatio.quotas["5 hour window (%)"].used, 37);
assert.equal(stringNumericRatio.quotas["7 day window (%)"].used, 12);

const directPercentage = qtpParseAlibabaTokenPlan({
  per5HourPercentage: 37,
  per5HourResetTime: 1786150800000,
  per1WeekPercentage: "12",
  per1WeekResetTime: 1786579200000,
});
assert.equal(directPercentage.quotas["5 hour window (%)"].used, 37);
assert.equal(directPercentage.quotas["7 day window (%)"].used, 12);

const clampedOutlier = qtpParseAlibabaTokenPlan({
  per5HourPercentage: -0.5,
  per5HourResetTime: 1786150800000,
  per1WeekPercentage: 150,
  per1WeekResetTime: 1786579200000,
});
assert.equal(clampedOutlier.quotas["5 hour window (%)"].used, 0);
assert.equal(clampedOutlier.quotas["5 hour window (%)"].remainingPercentage, 100);
assert.equal(clampedOutlier.quotas["7 day window (%)"].used, 100);
assert.equal(clampedOutlier.quotas["7 day window (%)"].remainingPercentage, 0);

// 4. Resets: seconds, milliseconds, ISO strings
const secondsReset = qtpParseAlibabaTokenPlan({
  per5HourPercentage: 0.37,
  per5HourResetTime: 1786150800,
  per1WeekPercentage: 0.12,
  per1WeekResetTime: "1786579200",
});
assert.equal(secondsReset.quotas["5 hour window (%)"].resetAt, "2026-08-08T01:00:00.000Z");
assert.equal(secondsReset.quotas["7 day window (%)"].resetAt, "2026-08-13T00:00:00.000Z");

const isoReset = qtpParseAlibabaTokenPlan({
  per5HourPercentage: 0.37,
  per5HourResetTime: "2026-08-08T01:00:00.000Z",
  per1WeekPercentage: 0.12,
  per1WeekResetTime: "2026-08-13T00:00:00.000Z",
});
assert.equal(isoReset.quotas["5 hour window (%)"].resetAt, "2026-08-08T01:00:00.000Z");
assert.equal(isoReset.quotas["7 day window (%)"].resetAt, "2026-08-13T00:00:00.000Z");

// 5. Prior-calendar-year reset with explicit now timestamp
const explicitNow = Date.parse("2026-08-07T00:00:00.000Z");
const prevYearReset = qtpParseAlibabaTokenPlan(
  {
    per5HourPercentage: 0.5,
    per5HourResetTime: 1767225599000, // 2025-12-31T23:59:59.000Z
    per1WeekPercentage: 0.2,
    per1WeekResetTime: "2025-12-31T23:59:59.000Z",
  },
  explicitNow,
);
assert.equal(prevYearReset.quotas["5 hour window (%)"].resetAt, "2025-12-31T23:59:59.000Z");
assert.equal(prevYearReset.quotas["7 day window (%)"].resetAt, "2025-12-31T23:59:59.000Z");

console.log("Alibaba Token Plan parser tests: ok");
