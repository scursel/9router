#!/usr/bin/env node
"use strict";

const assert = require("assert/strict");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  qtpParseAlibabaTokenPlan,
} = require("../patches/quota-tracker.patch.js");

function wrap(data) {
  return {
    data: {
      DataV2: {
        data: {
          data,
        },
      },
    },
  };
}

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

// 2. Envelope restriction tests (must only accept source.data.DataV2.data.data)
assert.equal(qtpParseAlibabaTokenPlan(null), null);
assert.equal(qtpParseAlibabaTokenPlan({}), null);
assert.equal(qtpParseAlibabaTokenPlan({ data: null }), null);
assert.equal(qtpParseAlibabaTokenPlan({ data: { DataV2: null } }), null);
assert.equal(qtpParseAlibabaTokenPlan({ data: { DataV2: { data: null } } }), null);
assert.equal(qtpParseAlibabaTokenPlan({ data: { DataV2: { data: { data: {} } } } }), null);
assert.equal(qtpParseAlibabaTokenPlan(wrap(null)), null);
assert.equal(qtpParseAlibabaTokenPlan(wrap([])), null);

// Alternate envelopes or top-level payload without exact path must return null
assert.equal(
  qtpParseAlibabaTokenPlan({
    per5HourPercentage: 0.37,
    per5HourResetTime: 1786150800000,
    per1WeekPercentage: 0.12,
    per1WeekResetTime: 1786579200000,
  }),
  null,
);
assert.equal(
  qtpParseAlibabaTokenPlan({
    DataV2: {
      data: {
        data: {
          per5HourPercentage: 0.37,
          per5HourResetTime: 1786150800000,
          per1WeekPercentage: 0.12,
          per1WeekResetTime: 1786579200000,
        },
      },
    },
  }),
  null,
);
assert.equal(
  qtpParseAlibabaTokenPlan({
    data: {
      data: {
        per5HourPercentage: 0.37,
        per5HourResetTime: 1786150800000,
        per1WeekPercentage: 0.12,
        per1WeekResetTime: 1786579200000,
      },
    },
  }),
  null,
);

// Payload missing one of the two window definitions must return null
assert.equal(
  qtpParseAlibabaTokenPlan(
    wrap({
      per5HourPercentage: 0.37,
      per5HourResetTime: 1786150800000,
    }),
  ),
  null,
);
assert.equal(
  qtpParseAlibabaTokenPlan(
    wrap({
      per1WeekPercentage: 0.12,
      per1WeekResetTime: 1786579200000,
    }),
  ),
  null,
);

// 3. Window reset timestamp validation tests (must return null on missing/invalid reset)
const valid5HourPercent = 0.37;
const valid1WeekPercent = 0.12;
const valid5HourReset = 1786150800000;
const valid1WeekReset = 1786579200000;

const invalidResets = [
  undefined,
  null,
  0,
  "0",
  "invalid",
  "not-a-date",
  false,
  true,
  [],
  [1786150800000],
  {},
  NaN,
];

for (const invalidReset of invalidResets) {
  assert.equal(
    qtpParseAlibabaTokenPlan(
      wrap({
        per5HourPercentage: valid5HourPercent,
        per5HourResetTime: invalidReset,
        per1WeekPercentage: valid1WeekPercent,
        per1WeekResetTime: valid1WeekReset,
      }),
    ),
    null,
    `Expected null for 5-hour invalid reset: ${JSON.stringify(invalidReset)}`,
  );

  assert.equal(
    qtpParseAlibabaTokenPlan(
      wrap({
        per5HourPercentage: valid5HourPercent,
        per5HourResetTime: valid5HourReset,
        per1WeekPercentage: valid1WeekPercent,
        per1WeekResetTime: invalidReset,
      }),
    ),
    null,
    `Expected null for 7-day invalid reset: ${JSON.stringify(invalidReset)}`,
  );
}

// 4. Percentage validation tests (reject malformed values, prevent fabricated zero/100)
const malformedPercentages = [
  "",
  "   ",
  false,
  true,
  [],
  [37],
  {},
  null,
  undefined,
  NaN,
  Infinity,
  -Infinity,
  "abc",
  "37%",
];

for (const malformed of malformedPercentages) {
  assert.equal(
    qtpParseAlibabaTokenPlan(
      wrap({
        per5HourPercentage: malformed,
        per5HourResetTime: valid5HourReset,
        per1WeekPercentage: valid1WeekPercent,
        per1WeekResetTime: valid1WeekReset,
      }),
    ),
    null,
    `Expected null for 5-hour malformed percentage: ${JSON.stringify(malformed)}`,
  );

  assert.equal(
    qtpParseAlibabaTokenPlan(
      wrap({
        per5HourPercentage: valid5HourPercent,
        per5HourResetTime: valid5HourReset,
        per1WeekPercentage: malformed,
        per1WeekResetTime: valid1WeekReset,
      }),
    ),
    null,
    `Expected null for 7-day malformed percentage: ${JSON.stringify(malformed)}`,
  );
}

// Valid percentages, ratio vs direct percentage, and clamping
const stringNumericRatio = qtpParseAlibabaTokenPlan(
  wrap({
    per5HourPercentage: "0.37",
    per5HourResetTime: valid5HourReset,
    per1WeekPercentage: "0.12",
    per1WeekResetTime: valid1WeekReset,
  }),
);
assert.equal(stringNumericRatio.quotas["5 hour window (%)"].used, 37);
assert.equal(stringNumericRatio.quotas["7 day window (%)"].used, 12);

const directPercentage = qtpParseAlibabaTokenPlan(
  wrap({
    per5HourPercentage: 37,
    per5HourResetTime: valid5HourReset,
    per1WeekPercentage: "12",
    per1WeekResetTime: valid1WeekReset,
  }),
);
assert.equal(directPercentage.quotas["5 hour window (%)"].used, 37);
assert.equal(directPercentage.quotas["7 day window (%)"].used, 12);

const clampedOutlier = qtpParseAlibabaTokenPlan(
  wrap({
    per5HourPercentage: -0.5,
    per5HourResetTime: valid5HourReset,
    per1WeekPercentage: 150,
    per1WeekResetTime: valid1WeekReset,
  }),
);
assert.equal(clampedOutlier.quotas["5 hour window (%)"].used, 0);
assert.equal(clampedOutlier.quotas["5 hour window (%)"].remainingPercentage, 100);
assert.equal(clampedOutlier.quotas["7 day window (%)"].used, 100);
assert.equal(clampedOutlier.quotas["7 day window (%)"].remainingPercentage, 0);

// Reset representation formats: seconds, milliseconds, ISO strings
const secondsReset = qtpParseAlibabaTokenPlan(
  wrap({
    per5HourPercentage: 0.37,
    per5HourResetTime: 1786150800,
    per1WeekPercentage: 0.12,
    per1WeekResetTime: "1786579200",
  }),
);
assert.equal(secondsReset.quotas["5 hour window (%)"].resetAt, "2026-08-08T01:00:00.000Z");
assert.equal(secondsReset.quotas["7 day window (%)"].resetAt, "2026-08-13T00:00:00.000Z");

const isoReset = qtpParseAlibabaTokenPlan(
  wrap({
    per5HourPercentage: 0.37,
    per5HourResetTime: "2026-08-08T01:00:00.000Z",
    per1WeekPercentage: 0.12,
    per1WeekResetTime: "2026-08-13T00:00:00.000Z",
  }),
);
assert.equal(isoReset.quotas["5 hour window (%)"].resetAt, "2026-08-08T01:00:00.000Z");
assert.equal(isoReset.quotas["7 day window (%)"].resetAt, "2026-08-13T00:00:00.000Z");

// 5. Prior-calendar-year reset with explicit now timestamp
const explicitNow = Date.parse("2026-08-07T00:00:00.000Z");
const prevYearReset = qtpParseAlibabaTokenPlan(
  wrap({
    per5HourPercentage: 0.5,
    per5HourResetTime: 1767225599000, // 2025-12-31T23:59:59.000Z
    per1WeekPercentage: 0.2,
    per1WeekResetTime: "2025-12-31T23:59:59.000Z",
  }),
  explicitNow,
);
assert.equal(prevYearReset.quotas["5 hour window (%)"].resetAt, "2025-12-31T23:59:59.000Z");
assert.equal(prevYearReset.quotas["7 day window (%)"].resetAt, "2025-12-31T23:59:59.000Z");

// 6. Timezone-independence comparison test across UTC and Pacific/Honolulu
const patchJsPath = path.join(__dirname, "../patches/quota-tracker.patch.js");
const tzRunnerScript = `
  const { qtpParseAlibabaTokenPlan } = require(${JSON.stringify(patchJsPath)});
  const now = Date.parse("2026-08-07T00:00:00.000Z");
  const payload = {
    data: {
      DataV2: {
        data: {
          data: {
            per5HourPercentage: 0.37,
            per5HourResetTime: 1786150800000,
            per1WeekPercentage: 0.12,
            per1WeekResetTime: "2026-08-13T00:00:00.000Z",
          },
        },
      },
    },
  };
  const result = qtpParseAlibabaTokenPlan(payload, now);
  process.stdout.write(JSON.stringify(result));
`;

function parseInTZ(tz) {
  const output = execFileSync(process.execPath, ["-e", tzRunnerScript], {
    env: { ...process.env, TZ: tz },
    encoding: "utf8",
  });
  return JSON.parse(output);
}

const utcResult = parseInTZ("UTC");
const honoluluResult = parseInTZ("Pacific/Honolulu");
const shanghaiResult = parseInTZ("Asia/Shanghai");

assert.notEqual(utcResult, null);
assert.deepEqual(utcResult, honoluluResult);
assert.deepEqual(utcResult, shanghaiResult);
assert.equal(utcResult.quotas["5 hour window (%)"].resetAt, "2026-08-08T01:00:00.000Z");
assert.equal(utcResult.quotas["7 day window (%)"].resetAt, "2026-08-13T00:00:00.000Z");

console.log("Alibaba Token Plan parser tests: ok");
