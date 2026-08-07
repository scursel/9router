#!/usr/bin/env node
"use strict";

const assert = require("assert/strict");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  qtpParseAlibabaTokenPlan,
  qtpFetchAlibabaTokenPlan,
  qtpFetchAlibabaPayload,
  qtpSafeAlibabaReason,
  qtpAlibabaCache,
  qtpAlibaba,
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

async function runAdapterTests() {
  const responseHelper = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  });

  const mockEnv = {
    ALIBABA_TOKEN_PLAN_QUOTA_COOKIE: "fixture-cookie",
    ALIBABA_TOKEN_PLAN_SEC_TOKEN: "fixture-sec-token",
  };

  // 7. Missing environment secrets
  {
    const calls = [];
    const dummyFetcher = async (url, init) => {
      calls.push({ url, init });
      return responseHelper(200, fixture);
    };
    const dummyCache = new Map();

    const missingCookie = await qtpFetchAlibabaTokenPlan(dummyFetcher, dummyCache, {
      ALIBABA_TOKEN_PLAN_SEC_TOKEN: "fixture-sec-token",
    });
    assert.equal(missingCookie.status, "unavailable");
    assert.equal(missingCookie.source, "alibaba-console");
    assert.equal(missingCookie.reason, "session unavailable");
    assert.equal(calls.length, 0);

    const missingSecToken = await qtpFetchAlibabaTokenPlan(dummyFetcher, dummyCache, {
      ALIBABA_TOKEN_PLAN_QUOTA_COOKIE: "fixture-cookie",
    });
    assert.equal(missingSecToken.status, "unavailable");
    assert.equal(missingSecToken.source, "alibaba-console");
    assert.equal(missingSecToken.reason, "session unavailable");
    assert.equal(calls.length, 0);
  }

  // 8. Normal success response & request shape verification
  {
    const calls = [];
    const fetcher = async (url, init) => {
      calls.push({ url, init });
      return responseHelper(200, fixture);
    };
    const testCache = new Map();
    const now = Date.parse("2026-08-07T12:00:00.000Z");

    const res = await qtpFetchAlibabaTokenPlan(fetcher, testCache, mockEnv, now);
    assert.equal(res.status, "ok");
    assert.equal(res.source, "alibaba-console");
    assert.equal(res.plan, "Alibaba Token Plan");
    assert.equal(res.message, undefined);
    assert.equal(res.fetchedAt, "2026-08-07T12:00:00.000Z");
    assert.equal(res.quotas["5 hour window (%)"].used, 37);
    assert.equal(res.quotas["5 hour window (%)"].total, 100);
    assert.equal(res.quotas["5 hour window (%)"].remainingPercentage, 63);
    assert.equal(res.quotas["5 hour window (%)"].resetAt, "2026-08-08T01:00:00.000Z");
    assert.equal(res.quotas["7 day window (%)"].used, 12);
    assert.equal(res.quotas["7 day window (%)"].total, 100);
    assert.equal(res.quotas["7 day window (%)"].remainingPercentage, 88);
    assert.equal(res.quotas["7 day window (%)"].resetAt, "2026-08-13T00:00:00.000Z");

    // Verify fetcher request parameters
    assert.equal(calls.length, 1);
    const { url, init } = calls[0];
    assert.equal(
      url,
      "https://cs-data.qwencloud.com/data/api.json?action=IntlBroadScopeAspnGateway&product=sfm_bailian&api=zeldaHttp.apikeyMgr.%2Ftokenplan%2Fpersonal%2Fapi%2Fv2%2Fusage&_v=undefined",
    );
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/x-www-form-urlencoded");
    assert.equal(init.headers["Cookie"], "fixture-cookie");
    assert.equal(
      init.headers["Referer"],
      "https://home.qwencloud.com/billing/subscription/token-plan-individual",
    );
    assert.equal(init.headers["Origin"], "https://home.qwencloud.com");
    assert.equal(init.headers["X-Requested-With"], "XMLHttpRequest");
    assert.equal(init.headers["Accept"], "application/json, text/plain, */*");
    const searchParams = new URLSearchParams(init.body);
    assert.equal(searchParams.get("product"), "sfm_bailian");
    assert.equal(searchParams.get("action"), "IntlBroadScopeAspnGateway");
    assert.equal(searchParams.get("sec_token"), "fixture-sec-token");
    assert.equal(searchParams.get("region"), "ap-southeast-1");
    assert.equal(searchParams.get("language"), "en-US");

    const rawParams = searchParams.get("params");
    assert.ok(rawParams, "params field must be present");
    const parsedParams = JSON.parse(rawParams);
    assert.equal(parsedParams.Api, "zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/usage");
    assert.equal(parsedParams.V, "1.0");
    assert.equal(typeof parsedParams.Data, "object");
    assert.notEqual(parsedParams.Data, null);
    assert.notEqual(typeof parsedParams.Data, "string");
    assert.equal(typeof parsedParams.Data.cornerstoneParam, "object");
    assert.notEqual(parsedParams.Data.cornerstoneParam, null);

    const cp = parsedParams.Data.cornerstoneParam;
    assert.equal(typeof cp.feTraceId, "string");
    assert.ok(cp.feTraceId.length > 0);
    assert.equal(cp.feURL, "https://home.qwencloud.com/billing/subscription/token-plan-individual");
    assert.equal(cp.protocol, "V2");
    assert.equal(cp.console, "ONE_CONSOLE");
    assert.equal(cp.productCode, "p_efm");
    assert.equal(cp.domain, "home.qwencloud.com");
    assert.equal(cp.consoleSite, "QWENCLOUD");
    assert.equal(cp.userNickName, "");
    assert.equal(cp.userPrincipalName, "");
    assert.equal(cp.xsp_lang, "en-US");
    assert.equal(cp.sec_token, undefined);
  }

  // 9. Failure modes without cache
  {
    const testCache = new Map();

    // 401
    const f401 = async () => responseHelper(401, { error: "unauthorized" });
    const res401 = await qtpFetchAlibabaTokenPlan(f401, testCache, mockEnv);
    assert.equal(res401.status, "unavailable");
    assert.equal(res401.source, "alibaba-console");
    assert.equal(res401.reason, "authentication failed");

    // 403
    const f403 = async () => responseHelper(403, { error: "forbidden" });
    const res403 = await qtpFetchAlibabaTokenPlan(f403, testCache, mockEnv);
    assert.equal(res403.status, "unavailable");
    assert.equal(res403.source, "alibaba-console");
    assert.equal(res403.reason, "authentication failed");

    // 429
    const f429 = async () => responseHelper(429, { error: "rate limit" });
    const res429 = await qtpFetchAlibabaTokenPlan(f429, testCache, mockEnv);
    assert.equal(res429.status, "unavailable");
    assert.equal(res429.source, "alibaba-console");
    assert.equal(res429.reason, "quota unavailable");

    // 500
    const f500 = async () => responseHelper(500, { error: "server error" });
    const res500 = await qtpFetchAlibabaTokenPlan(f500, testCache, mockEnv);
    assert.equal(res500.status, "unavailable");
    assert.equal(res500.source, "alibaba-console");
    assert.equal(res500.reason, "quota unavailable");

    // Network rejection / timeout
    const fReject = async () => {
      throw new Error("connect ECONNREFUSED");
    };
    const resReject = await qtpFetchAlibabaTokenPlan(fReject, testCache, mockEnv);
    assert.equal(resReject.status, "unavailable");
    assert.equal(resReject.source, "alibaba-console");
    assert.equal(resReject.reason, "quota unavailable");

    // Empty JSON
    const fEmpty = async () => responseHelper(200, {});
    const resEmpty = await qtpFetchAlibabaTokenPlan(fEmpty, testCache, mockEnv);
    assert.equal(resEmpty.status, "unavailable");
    assert.equal(resEmpty.source, "alibaba-console");
    assert.equal(resEmpty.reason, "quota unavailable");

    // Invalid schema
    const fInvalid = async () => responseHelper(200, { code: 200, data: { DataV2: { data: { data: {} } } } });
    const resInvalid = await qtpFetchAlibabaTokenPlan(fInvalid, testCache, mockEnv);
    assert.equal(resInvalid.status, "unavailable");
    assert.equal(resInvalid.source, "alibaba-console");
    assert.equal(resInvalid.reason, "quota unavailable");
  }

  // 10. Cache behavior: fresh (<60s), stale (<=300s on error), expired (>300s on error)
  {
    const testCache = new Map();
    const t0 = Date.parse("2026-08-07T12:00:00.000Z");
    let fetchCount = 0;
    const succFetcher = async () => {
      fetchCount++;
      return responseHelper(200, fixture);
    };
    const failFetcher = async () => {
      fetchCount++;
      return responseHelper(500, { error: "fail" });
    };

    // Initial successful fetch at t0
    const r0 = await qtpFetchAlibabaTokenPlan(succFetcher, testCache, mockEnv, t0);
    assert.equal(r0.status, "ok");
    assert.equal(r0.fetchedAt, "2026-08-07T12:00:00.000Z");
    assert.equal(fetchCount, 1);

    // 30 seconds later (t0 + 30_000): fresh cache return without calling fetcher
    const r30s = await qtpFetchAlibabaTokenPlan(failFetcher, testCache, mockEnv, t0 + 30_000);
    assert.equal(r30s.status, "ok");
    assert.equal(r30s.fetchedAt, "2026-08-07T12:00:00.000Z");
    assert.equal(r30s.message, undefined);
    assert.equal(fetchCount, 1);

    // 120 seconds later (t0 + 120_000): cache older than 60s, fetcher is called and fails
    // Returns "stale" with original timestamp t0, and no message property
    const r120s = await qtpFetchAlibabaTokenPlan(failFetcher, testCache, mockEnv, t0 + 120_000);
    assert.equal(r120s.status, "stale");
    assert.equal(r120s.fetchedAt, "2026-08-07T12:00:00.000Z");
    assert.equal(r120s.message, undefined);
    assert.equal(r120s.quotas["5 hour window (%)"].used, 37);
    assert.equal(fetchCount, 2);

    // Exactly 300 seconds (5 min) later (t0 + 300_000): fetcher fails -> returns "stale"
    const r300s = await qtpFetchAlibabaTokenPlan(failFetcher, testCache, mockEnv, t0 + 300_000);
    assert.equal(r300s.status, "stale");
    assert.equal(r300s.fetchedAt, "2026-08-07T12:00:00.000Z");

    // 300_001 ms (5 min + 1 ms) later (t0 + 300_001): cache expired (>300s), fetcher fails -> returns "unavailable"
    const r300sPlus1 = await qtpFetchAlibabaTokenPlan(failFetcher, testCache, mockEnv, t0 + 300_001);
    assert.equal(r300sPlus1.status, "unavailable");
    assert.equal(r300sPlus1.reason, "quota unavailable");
  }

  // 11. No secret leakage in JSON.stringify of results
  {
    const testCache = new Map();
    const fetcher = async () => responseHelper(200, fixture);
    const okRes = await qtpFetchAlibabaTokenPlan(fetcher, testCache, mockEnv);
    const unavailRes = await qtpFetchAlibabaTokenPlan(async () => responseHelper(500, {}), new Map(), mockEnv);

    for (const obj of [okRes, unavailRes]) {
      const json = JSON.stringify(obj);
      assert.equal(json.includes("fixture-cookie"), false);
      assert.equal(json.includes("fixture-sec-token"), false);
    }
  }

  console.log("Alibaba Token Plan adapter tests: ok");
}

runAdapterTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
