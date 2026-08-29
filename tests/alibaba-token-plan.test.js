#!/usr/bin/env node
"use strict";

const assert = require("assert/strict");
const {
  qtpLocalQuota,
  qtpCalcSlidingWindowUsage,
  qtpAlibaba,
} = require("../patches/quota-tracker.patch.js");

console.log("Running Alibaba Token Plan local sliding-window quota meter tests...");

// 1. qtpLocalQuota helper tests
{
  const withLimit = qtpLocalQuota(1500, 10000);
  assert.equal(withLimit.used, 1500);
  assert.equal(withLimit.total, 10000);
  assert.equal(withLimit.remainingPercentage, 85);
  assert.equal(withLimit.unlimited, false);
  assert.equal(withLimit.resetAt, null);

  const noLimit = qtpLocalQuota(1500, 0);
  assert.equal(noLimit.used, 1500);
  assert.equal(noLimit.total, 0);
  assert.equal(noLimit.unlimited, true);
  assert.equal(noLimit.resetAt, null);

  const clampedNegative = qtpLocalQuota(-10, -50);
  assert.equal(clampedNegative.used, 0);
  assert.equal(clampedNegative.total, 0);
  assert.equal(clampedNegative.unlimited, true);
}

// 2. Sliding-window filtering tests (5h vs 7d vs outside 7d) with injected `now`
{
  const now = Date.parse("2026-08-07T12:00:00.000Z");

  const records = [
    // Within 5h (2h ago): 400 prompt + 600 completion = 1000 tokens
    {
      timestamp: new Date(now - 2 * 3600 * 1000).toISOString(),
      promptTokens: 400,
      completionTokens: 600,
    },
    // Within 5h (4h ago): 200 prompt + 300 completion = 500 tokens
    {
      timestamp: new Date(now - 4 * 3600 * 1000).toISOString(),
      promptTokens: 200,
      completionTokens: 300,
    },
    // Outside 5h but within 7d (20h ago): 1000 prompt + 1500 completion = 2500 tokens
    {
      timestamp: new Date(now - 20 * 3600 * 1000).toISOString(),
      promptTokens: 1000,
      completionTokens: 1500,
    },
    // Outside 5h but within 7d (3d ago): 5000 prompt + 5000 completion = 10000 tokens
    {
      timestamp: new Date(now - 3 * 86400 * 1000).toISOString(),
      promptTokens: 5000,
      completionTokens: 5000,
    },
    // Outside 7d (8d ago): 50000 tokens -> MUST BE EXCLUDED from both 5h and 7d
    {
      timestamp: new Date(now - 8 * 86400 * 1000).toISOString(),
      promptTokens: 25000,
      completionTokens: 25000,
    },
    // Future timestamp: MUST BE EXCLUDED
    {
      timestamp: new Date(now + 3600 * 1000).toISOString(),
      promptTokens: 9999,
      completionTokens: 9999,
    },
    // Invalid / malformed timestamp -> MUST BE EXCLUDED
    {
      timestamp: "invalid-date",
      promptTokens: 100,
      completionTokens: 100,
    },
  ];

  // Test without limits
  const res = qtpCalcSlidingWindowUsage(records, now);

  assert.equal(res.status, "ok");
  assert.equal(res.source, "router-local");
  assert.equal(res.plan, "Alibaba Token Plan (medido pelo router)");
  assert.equal(res.fetchedAt, "2026-08-07T12:00:00.000Z");

  const quota5h = res.quotas["Consumo 5h (medido local)"];
  const quota7d = res.quotas["Consumo 7d (medido local)"];

  // 5h sum: 1000 + 500 = 1500 tokens
  assert.equal(quota5h.used, 1500);
  assert.equal(quota5h.total, 0);
  assert.equal(quota5h.unlimited, true);

  // 7d sum: 1000 + 500 + 2500 + 10000 = 14000 tokens (excludes 8d ago 50000 tokens)
  assert.equal(quota7d.used, 14000);
  assert.equal(quota7d.total, 0);
  assert.equal(quota7d.unlimited, true);
}

// 3. Test with explicit limits in providerSpecificData
{
  const now = Date.parse("2026-08-07T12:00:00.000Z");
  const records = [
    {
      timestamp: new Date(now - 1 * 3600 * 1000).toISOString(),
      promptTokens: 2000,
      completionTokens: 3000, // 5000 tokens
    },
  ];

  const limits = {
    limit5h: 50000,
    limit7d: 200000,
  };

  const res = qtpCalcSlidingWindowUsage(records, now, limits);

  const quota5h = res.quotas["Consumo 5h (medido local)"];
  const quota7d = res.quotas["Consumo 7d (medido local)"];

  assert.equal(quota5h.used, 5000);
  assert.equal(quota5h.total, 50000);
  assert.equal(quota5h.remainingPercentage, 90);
  assert.equal(quota5h.unlimited, false);

  assert.equal(quota7d.used, 5000);
  assert.equal(quota7d.total, 200000);
  assert.equal(quota7d.remainingPercentage, 97.5);
  assert.equal(quota7d.unlimited, false);
}

// 3b. Credit estimate from qwen3.8 usage + Token Plan Standard windows
{
  const now = Date.parse("2026-08-15T13:00:00.000Z");
  const records = [
    {
      timestamp: new Date(now - 1800 * 1000).toISOString(),
      promptTokens: 47377,
      completionTokens: 120,
      tokens: JSON.stringify({
        prompt_tokens: 47377,
        completion_tokens: 120,
        cached_tokens: 44288,
      }),
    },
  ];
  const res = qtpCalcSlidingWindowUsage(records, now, { unit: "credits" });
  const quota5h = res.quotas["Créditos 5h (estimado)"];
  const quota7d = res.quotas["Créditos 7d (estimado)"];
  const uncached = 47377 - 44288;
  const usd = uncached * 2e-6 + 120 * 6e-6 + 44288 * 0.25e-6;
  const credits = usd / 0.002;
  assert.ok(Math.abs(quota5h.used - credits) < 1e-9);
  assert.equal(quota5h.total, 700);
  assert.equal(quota5h.unlimited, false);
  assert.ok(quota5h.remainingPercentage > 80);
  assert.ok(quota7d);
  assert.ok(Math.abs(quota7d.used - credits) < 1e-9);
  assert.equal(quota7d.total, 2500);
  assert.ok(quota7d.remainingPercentage > 90);
}

// 3c. 5h can be exhausted while the weekly bar still has remaining.
{
  const now = Date.parse("2026-08-15T16:00:00.000Z");
  const records = [
    {
      timestamp: new Date(now - 1800 * 1000).toISOString(),
      tokens: JSON.stringify({
        prompt_tokens: 800000,
        completion_tokens: 0,
        cached_tokens: 0,
      }),
    },
  ];
  const res = qtpCalcSlidingWindowUsage(records, now, { unit: "credits" });
  const quota5h = res.quotas["Créditos 5h (estimado)"];
  const quota7d = res.quotas["Créditos 7d (estimado)"];
  assert.ok(Math.abs(quota5h.used - 800) < 1e-9);
  assert.equal(quota5h.total, 700);
  assert.equal(quota5h.remainingPercentage, 0);
  assert.ok(Math.abs(quota7d.used - 800) < 1e-9);
  assert.equal(quota7d.total, 2500);
  assert.equal(quota7d.remainingPercentage, 68);
}

// 3e. Official weekly usage the router never saw is added only to the 7d bar.
{
  const now = Date.parse("2026-08-15T16:00:00.000Z");
  const windowStart = now - 20 * 3600 * 1000;
  const records = [
    {
      timestamp: new Date(windowStart).toISOString(),
      tokens: JSON.stringify({
        prompt_tokens: 0,
        completion_tokens: 0,
        cached_tokens: 0,
      }),
    },
    {
      timestamp: new Date(now - 1800 * 1000).toISOString(),
      tokens: JSON.stringify({
        prompt_tokens: 800000,
        completion_tokens: 0,
        cached_tokens: 0,
      }),
    },
  ];
  const matched = qtpCalcSlidingWindowUsage(records, now, {
    unit: "credits",
    untrackedCredits7d: 1525,
    untrackedCredits7dWindowStart: windowStart,
  });
  assert.ok(Math.abs(matched.quotas["Créditos 5h (estimado)"].used - 800) < 1e-9);
  assert.equal(matched.quotas["Créditos 5h (estimado)"].remainingPercentage, 0);
  assert.ok(Math.abs(matched.quotas["Créditos 7d (estimado)"].used - 2325) < 1e-9);
  assert.ok(Math.abs(matched.quotas["Créditos 7d (estimado)"].remainingPercentage - 7) < 1e-9);

  const stale = qtpCalcSlidingWindowUsage(records, now, {
    unit: "credits",
    untrackedCredits7d: 1525,
    untrackedCredits7dWindowStart: windowStart - 7 * 86400 * 1000,
  });
  assert.ok(Math.abs(stale.quotas["Créditos 7d (estimado)"].used - 800) < 1e-9);
  assert.equal(stale.quotas["Créditos 7d (estimado)"].remainingPercentage, 68);
}

// 3d. 5h window starts at first call, not a sliding last-5h clock.
{
  const now = Date.parse("2026-08-15T18:00:00.000Z");
  const tokens = JSON.stringify({
    prompt_tokens: 10000,
    completion_tokens: 0,
    cached_tokens: 0,
  });
  const res = qtpCalcSlidingWindowUsage(
    [
      { timestamp: now - 6 * 3600 * 1000, model: "qwen3.8-max-preview", tokens },
      { timestamp: now - 1 * 3600 * 1000, model: "qwen3.8-max-preview", tokens },
    ],
    now,
    { unit: "credits" },
  );
  const one = qtpCalcSlidingWindowUsage(
    [{ timestamp: now - 1 * 3600 * 1000, model: "qwen3.8-max-preview", tokens }],
    now,
    { unit: "credits" },
  );
  assert.equal(
    res.quotas["Créditos 5h (estimado)"].used,
    one.quotas["Créditos 5h (estimado)"].used,
  );
}

async function runAsyncTests() {
  // 4. Test qtpAlibaba async dispatcher (handles missing/empty DB gracefully)
  {
    const now = Date.parse("2026-08-07T12:00:00.000Z");

    // Call qtpAlibaba with empty database fallback
    const res = await qtpAlibaba({ connectionId: "test-conn" }, now);

    assert.equal(res.status, "ok");
    assert.equal(res.source, "router-local");
    assert.equal(res.plan, "Alibaba Token Plan Lite (créditos estimados)");
    assert.equal(res.fetchedAt, "2026-08-07T12:00:00.000Z");
    assert.ok("Créditos 5h (estimado)" in res.quotas);
    assert.ok("Créditos 7d (estimado)" in res.quotas);
    assert.equal(res.quotas["Créditos 7d (estimado)"].total, 2500);
  }

  // 5. Test qtpAlibaba with mock db attached to global._dbAdapter
  {
    const now = Date.parse("2026-08-07T12:00:00.000Z");
    const origDb = global._dbAdapter;

    global._dbAdapter = {
      instance: {
        all(sql, params) {
          return [
            {
              promptTokens: 100,
              completionTokens: 200,
              timestamp: new Date(now - 1 * 3600 * 1000).toISOString(),
            },
            {
              promptTokens: 300,
              completionTokens: 400,
              timestamp: new Date(now - 24 * 3600 * 1000).toISOString(),
            },
          ];
        },
      },
    };

    try {
      const res = await qtpAlibaba(
        { id: "conn-123", providerSpecificData: { quotaLimit5h: 10000 } },
        now,
      );

      assert.ok(
        Math.abs(res.quotas["Créditos 5h (estimado)"].used - (100 * 2e-6 + 200 * 6e-6) / 0.002) < 1e-9,
      );
      assert.equal(res.quotas["Créditos 5h (estimado)"].total, 10000);
      assert.ok(res.quotas["Créditos 7d (estimado)"].used > res.quotas["Créditos 5h (estimado)"].used);
    } finally {
      global._dbAdapter = origDb;
    }
  }

  // 5b. Official alitp-intl rows must be included in the local meter query.
  {
    const source = qtpAlibaba.toString();
    assert.match(
      source,
      /alitp-intl/,
      "qtpAlibaba must query usageHistory for official alitp-intl as well as qwen-cloud-token-plan",
    );

    const now = Date.parse("2026-08-07T12:00:00.000Z");
    const origDb = global._dbAdapter;
    global._dbAdapter = {
      instance: {
        all(sql, params) {
          assert.match(sql, /connectionId = \?/);
          assert.equal(sql.includes("OR connectionId"), false);
          assert.equal(params[0], "conn-scursel");
          return [
            {
              promptTokens: 40,
              completionTokens: 10,
              timestamp: new Date(now - 1800 * 1000).toISOString(),
            },
          ];
        },
      },
    };
    try {
      const res = await qtpAlibaba(
        { provider: "alitp-intl", connectionId: "conn-scursel" },
        now,
      );
      assert.equal(res.quotas["Créditos 5h (estimado)"].used, (40 * 2e-6 + 10 * 6e-6) / 0.002);
      assert.equal(res.source, "router-local");
      assert.ok("Créditos 7d (estimado)" in res.quotas);
    } finally {
      global._dbAdapter = origDb;
    }
  }

  // 5c. Resolve connection from apiKey and never mix two alitp accounts.
  {
    const now = Date.parse("2026-08-07T12:00:00.000Z");
    const origDb = global._dbAdapter;
    const seen = [];
    global._dbAdapter = {
      instance: {
        get(sql, params) {
          assert.match(sql, /json_extract/);
          assert.equal(params[0], "sk-lite-scursel");
          return { id: "conn-scursel" };
        },
        all(sql, params) {
          seen.push({ sql, params });
          assert.match(sql, /connectionId = \?/);
          assert.equal(params[0], "conn-scursel");
          return [
            {
              promptTokens: 10,
              completionTokens: 5,
              timestamp: new Date(now - 600 * 1000).toISOString(),
            },
          ];
        },
      },
    };
    try {
      const res = await qtpAlibaba(
        { provider: "alitp-intl", apiKey: "sk-lite-scursel" },
        now,
      );
      assert.equal(seen.length, 1);
      assert.ok(res.quotas["Créditos 5h (estimado)"].used > 0);
    } finally {
      global._dbAdapter = origDb;
    }
  }

  // 6. Usage chunk loads getDb via webpack 89718/71998, not 36366 (other chunk).
  {
    const now = Date.parse("2026-08-07T12:00:00.000Z");
    const source = qtpAlibaba.toString();
    assert.match(
      source,
      /89718/,
      "qtpAlibaba must require webpack module 89718 (getDb already in the usage chunk)",
    );

    const rows = [
      {
        promptTokens: 80,
        completionTokens: 20,
        timestamp: new Date(now - 3600 * 1000).toISOString(),
      },
    ];
    const webpackRequire = (id) => {
      if (id === 36366) throw new Error("36366 is not in the usage chunk");
      if (id === 89718) {
        return {
          c: async () => ({
            all() {
              return rows;
            },
          }),
        };
      }
      throw new Error(`unexpected webpack module ${id}`);
    };
    const isolated = new Function(
      "c",
      "qtpCalcSlidingWindowUsage",
      `${qtpAlibaba.toString()}; return qtpAlibaba;`,
    )(webpackRequire, qtpCalcSlidingWindowUsage);

    const previousAdapter = global._dbAdapter;
    global._dbAdapter = undefined;
    try {
      const res = await isolated({ connectionId: "conn-usage-chunk" }, now);
      assert.equal(res.quotas["Créditos 5h (estimado)"].used, (80 * 2e-6 + 20 * 6e-6) / 0.002);
      assert.equal(res.source, "router-local");
    } finally {
      global._dbAdapter = previousAdapter;
    }
  }

  console.log("Alibaba Token Plan local sliding-window quota meter tests: ok");
}

runAsyncTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
