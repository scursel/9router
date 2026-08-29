import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: vi.fn(),
}));

import { proxyAwareFetch } from "../../open-sse/utils/proxyFetch.js";
import { getUsageForProvider } from "../../open-sse/services/usage.js";
import { getOpenRouterUsage, parseOpenRouter } from "../../open-sse/services/usage/openrouter.js";
import { getCommandCodeUsage, parseCommandCode, commandCodeMonthlyTotal } from "../../open-sse/services/usage/commandcode.js";
import { getXiaomiMimoUsage, parseMimo } from "../../open-sse/services/usage/xiaomiMimo.js";
import { getClinePassUsage, parseCline } from "../../open-sse/services/usage/clinepass.js";
import { getOpencodeGoUsage, parseOpenCodeGo } from "../../open-sse/services/usage/opencodeGo.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Quota Collectors - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("OpenRouter Usage Collector", () => {
    it("returns error message when API key is missing", async () => {
      const res = await getOpenRouterUsage(null);
      expect(res).toEqual({
        message: "OpenRouter API key not available.",
        quotas: {},
      });
    });

    it("fetches credits first and parses total_credits / total_usage", async () => {
      proxyAwareFetch.mockResolvedValueOnce(
        jsonResponse({
          total_credits: 100,
          total_usage: 25,
        }),
      );

      const res = await getOpenRouterUsage("sk-or-v1-testkey");

      expect(proxyAwareFetch).toHaveBeenCalledTimes(1);
      expect(proxyAwareFetch).toHaveBeenCalledWith(
        "https://openrouter.ai/api/v1/credits",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer sk-or-v1-testkey",
          }),
        }),
        undefined,
      );

      expect(res).toEqual({
        plan: "Credits",
        quotas: {
          "Credits (USD)": {
            used: 25,
            total: 100,
            remainingPercentage: 75,
            resetAt: null,
            unlimited: false,
          },
        },
      });
    });

    it("falls back to /auth/key when /credits returns null parse", async () => {
      // /credits returns 404 or empty json
      proxyAwareFetch.mockResolvedValueOnce(jsonResponse({ error: "Not found" }, 404));
      // /auth/key returns key limit data
      proxyAwareFetch.mockResolvedValueOnce(
        jsonResponse({
          data: {
            limit: 50,
            usage: 10,
            is_free_tier: false,
            limit_reset: "2026-09-01T00:00:00Z",
          },
        }),
      );

      const res = await getOpenRouterUsage("sk-or-v1-testkey");

      expect(proxyAwareFetch).toHaveBeenCalledTimes(2);
      expect(res.plan).toBe("API key");
      expect(res.quotas["Key limit (USD)"]).toEqual({
        used: 10,
        total: 50,
        remainingPercentage: 80,
        resetAt: "2026-09-01T00:00:00.000Z",
        unlimited: false,
      });
    });

    it("returns 401 error message when both endpoints fail with 401", async () => {
      proxyAwareFetch.mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401));
      proxyAwareFetch.mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401));

      const res = await getOpenRouterUsage("invalid-key");
      expect(res).toEqual({
        message: "OpenRouter quota API error (401).",
        quotas: {},
      });
    });
  });

  describe("CommandCode Usage Collector", () => {
    it("returns error message when API key is missing", async () => {
      const res = await getCommandCodeUsage(null);
      expect(res).toEqual({
        message: "CommandCode API key not available.",
        quotas: {},
      });
    });

    it("calculates used = total - remaining using planId and parses 5h and 7d windows", async () => {
      proxyAwareFetch.mockImplementation(async (url) => {
        if (url.includes("/billing/credits")) {
          return jsonResponse({
            credits: {
              monthlyCredits: 60,
              purchasedCredits: 10,
              freeCredits: 5,
            },
            windowLimits: {
              fiveHour: { used: 2, cap: 20, resetAt: "2026-08-29T15:00:00Z" },
              weekly: { used: 15, cap: 50, resetAt: "2026-09-05T00:00:00Z" },
            },
          });
        }
        if (url.includes("/billing/subscriptions")) {
          return jsonResponse({
            data: {
              planId: "individual-pro",
              currentPeriodEnd: "2026-09-15T00:00:00Z",
            },
          });
        }
        return jsonResponse({}, 404);
      });

      const res = await getCommandCodeUsage("cc-key");

      expect(commandCodeMonthlyTotal("individual-pro")).toBe(80);
      expect(res.plan).toBe("Pro");
      expect(res.quotas).toHaveProperty("Monthly credits (USD) - renews 15/09/2026");
      expect(res.quotas["Monthly credits (USD) - renews 15/09/2026"]).toEqual({
        used: 20, // 80 - 60
        total: 80,
        remainingPercentage: 75,
        resetAt: "2026-09-15T00:00:00.000Z",
        unlimited: false,
      });
      expect(res.quotas["Purchased credits (USD)"]).toEqual({
        used: 0,
        total: 10,
        remainingPercentage: 100,
        resetAt: null,
        unlimited: false,
      });
      expect(res.quotas["Free credits (USD)"]).toEqual({
        used: 0,
        total: 5,
        remainingPercentage: 100,
        resetAt: null,
        unlimited: false,
      });
      expect(res.quotas["5 hour window (USD)"]).toEqual({
        used: 2,
        total: 20,
        remainingPercentage: 90,
        resetAt: "2026-08-29T15:00:00.000Z",
        unlimited: false,
      });
      expect(res.quotas["7 day window (USD)"]).toEqual({
        used: 15,
        total: 50,
        remainingPercentage: 70,
        resetAt: "2026-09-05T00:00:00.000Z",
        unlimited: false,
      });
    });
  });

  describe("Xiaomi MiMo Usage Collector", () => {
    it("returns exact error message when cookie is missing", async () => {
      const originalEnv = process.env.MIMO_QUOTA_COOKIE;
      delete process.env.MIMO_QUOTA_COOKIE;

      const res = await getXiaomiMimoUsage({});
      expect(res).toEqual({
        message:
          "MiMo balance requires the console cookie in MIMO_QUOTA_COOKIE or providerSpecificData.quotaCookie.",
        quotas: {},
      });

      process.env.MIMO_QUOTA_COOKIE = originalEnv;
    });

    it("fetches balance using providerSpecificData.quotaCookie and parses balances", async () => {
      proxyAwareFetch.mockResolvedValueOnce(
        jsonResponse({
          data: {
            balance: 50,
            currency: "USD",
            cashBalance: 40,
            giftBalance: 10,
          },
        }),
      );

      const res = await getXiaomiMimoUsage({ quotaCookie: "sess=abc123xyz" });

      expect(proxyAwareFetch).toHaveBeenCalledWith(
        "https://platform.xiaomimimo.com/api/v1/balance",
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: "sess=abc123xyz",
            Origin: "https://platform.xiaomimimo.com",
          }),
        }),
        undefined,
      );

      expect(res.plan).toBe("API balance");
      expect(res.quotas["Available balance (USD)"]).toEqual({
        used: 0,
        total: 50,
        remainingPercentage: 100,
        resetAt: null,
        unlimited: false,
      });
      expect(res.quotas["Paid balance (USD)"]).toEqual({
        used: 0,
        total: 40,
        remainingPercentage: 100,
        resetAt: null,
        unlimited: false,
      });
      expect(res.quotas["Granted balance (USD)"]).toEqual({
        used: 0,
        total: 10,
        remainingPercentage: 100,
        resetAt: null,
        unlimited: false,
      });
    });
  });

  describe("ClinePass Usage Collector", () => {
    it("returns error when credential is missing", async () => {
      const res = await getClinePassUsage(null);
      expect(res).toEqual({
        message: "ClinePass credential not available.",
        quotas: {},
      });
    });

    it("aggregates items within 5h, 7d, 30d windows scaled by 1e8 and derives resetAt", async () => {
      const now = 1700000000000;
      const h5 = 5 * 3600 * 1000;
      const d7 = 7 * 86400 * 1000;
      const d30 = 30 * 86400 * 1000;

      const item5h = { createdAt: new Date(now - 2 * 3600 * 1000).toISOString(), costUsd: 100000000 }; // $1
      const item7d = { createdAt: new Date(now - 2 * 86400 * 1000).toISOString(), costUsd: 200000000 }; // $2
      const item30d = { createdAt: new Date(now - 10 * 86400 * 1000).toISOString(), costUsd: 300000000 }; // $3

      const planBody = {
        data: {
          plan: {
            name: "ClinePass Pro",
            entitlements: {
              cline_pass: {
                enabled: true,
                inferenceCapThreshold: {
                  last5HoursUsageCostUSDPerUser: 500000000, // $5
                  last7daysUsageCostUSDPerUser: 2000000000, // $20
                  last30daysUsageCostUSDPerUser: 5000000000, // $50
                },
              },
            },
          },
          currentPeriodEnd: "2026-09-30T00:00:00Z",
        },
      };

      proxyAwareFetch.mockImplementation(async (url) => {
        if (url.includes("/users/me/plan")) return jsonResponse(planBody);
        if (url.includes("/users/me")) return jsonResponse({ data: { id: "user-1" } });
        if (url.includes("/usages")) {
          return jsonResponse({
            data: {
              items: [item5h, item7d, item30d],
              nextToken: "",
            },
          });
        }
        return jsonResponse({}, 404);
      });

      const parsed = parseCline(planBody, [item5h, item7d, item30d], now);

      expect(parsed.plan).toBe("ClinePass Pro - renews 30/09/2026");

      // 5h window: only item5h ($1). Limit = $5. Earliest item in 5h = item5h -> resetAt = item5h.createdAt + 5h
      const expectedReset5h = new Date(new Date(item5h.createdAt).getTime() + h5).toISOString();
      expect(parsed.quotas["5 hour window (USD)"]).toEqual({
        used: 1,
        total: 5,
        remainingPercentage: 80,
        resetAt: expectedReset5h,
        unlimited: false,
      });

      // 7d window: item5h ($1) + item7d ($2) = $3. Limit = $20. Earliest = item7d -> resetAt = item7d.createdAt + 7d
      const expectedReset7d = new Date(new Date(item7d.createdAt).getTime() + d7).toISOString();
      expect(parsed.quotas["7 day window (USD)"]).toEqual({
        used: 3,
        total: 20,
        remainingPercentage: 85,
        resetAt: expectedReset7d,
        unlimited: false,
      });

      // 30d window: item5h ($1) + item7d ($2) + item30d ($3) = $6. Limit = $50. Earliest = item30d -> resetAt = item30d.createdAt + 30d
      const expectedReset30d = new Date(new Date(item30d.createdAt).getTime() + d30).toISOString();
      expect(parsed.quotas["30 day window (USD)"]).toEqual({
        used: 6,
        total: 50,
        remainingPercentage: 88,
        resetAt: expectedReset30d,
        unlimited: false,
      });
    });
  });

  describe("OpenCode Go Usage Collector", () => {
    it("returns error when API key is missing", async () => {
      const res = await getOpencodeGoUsage(null);
      expect(res).toEqual({
        message: "OpenCode Go API key not available.",
        quotas: {},
      });
    });

    it("clamps percent at 100 when API returns > 100", () => {
      const body = {
        usage: {
          rolling: { percent: 125, resetsAt: "2026-08-29T18:00:00Z" },
          weekly: { percent: 40, resetsAt: null },
        },
      };

      const parsed = parseOpenCodeGo(body);

      expect(parsed.quotas["Rolling (5h)"]).toEqual({
        used: 100,
        total: 100,
        remainingPercentage: 0,
        resetAt: "2026-08-29T18:00:00.000Z",
        unlimited: false,
      });

      expect(parsed.quotas["Weekly"]).toEqual({
        used: 40,
        total: 100,
        remainingPercentage: 60,
        resetAt: null,
        unlimited: false,
      });
    });

    it("reuses cache within 45s for the same API key", async () => {
      proxyAwareFetch.mockResolvedValue(
        jsonResponse({
          usage: {
            rolling: { percent: 10 },
          },
        }),
      );

      const uniqueKey = "og-key-cache-test-" + Date.now();

      const res1 = await getOpencodeGoUsage(uniqueKey);
      expect(proxyAwareFetch).toHaveBeenCalledTimes(1);
      expect(res1.quotas["Rolling (5h)"].used).toBe(10);

      // Second call immediately after should hit cache without calling proxyAwareFetch again
      const res2 = await getOpencodeGoUsage(uniqueKey);
      expect(proxyAwareFetch).toHaveBeenCalledTimes(1);
      expect(res2).toEqual(res1);
    });
  });

  describe("getUsageForProvider integration with USAGE_HANDLERS", () => {
    it("routes openrouter via getUsageForProvider", async () => {
      proxyAwareFetch.mockResolvedValueOnce(
        jsonResponse({ total_credits: 50, total_usage: 10 }),
      );

      const res = await getUsageForProvider({
        provider: "openrouter",
        apiKey: "sk-or-key",
      });

      expect(res.quotas["Credits (USD)"].total).toBe(50);
    });

    it("routes commandcode via getUsageForProvider", async () => {
      proxyAwareFetch.mockImplementation(async (url) => {
        if (url.includes("/billing/credits")) {
          return jsonResponse({ credits: { monthlyCredits: 10 } });
        }
        return jsonResponse({ data: { planId: "individual-go" } });
      });

      const res = await getUsageForProvider({
        provider: "commandcode",
        apiKey: "cc-key",
      });

      expect(res.quotas["Monthly credits (USD)"].total).toBe(10);
    });

    it("routes xiaomi-mimo via getUsageForProvider", async () => {
      proxyAwareFetch.mockResolvedValueOnce(
        jsonResponse({ data: { balance: 100, currency: "USD" } }),
      );

      const res = await getUsageForProvider({
        provider: "xiaomi-mimo",
        providerSpecificData: { quotaCookie: "cookie123" },
      });

      expect(res.quotas["Available balance (USD)"].total).toBe(100);
    });

    it("routes clinepass via getUsageForProvider", async () => {
      proxyAwareFetch.mockImplementation(async (url) => {
        if (url.includes("/users/me/plan")) {
          return jsonResponse({
            data: {
              plan: {
                name: "ClinePass",
                entitlements: {
                  cline_pass: {
                    enabled: true,
                    inferenceCapThreshold: { last5HoursUsageCostUSDPerUser: 100000000 },
                  },
                },
              },
            },
          });
        }
        if (url.includes("/users/me")) return jsonResponse({ data: { id: "u1" } });
        return jsonResponse({ data: { items: [] } });
      });

      const res = await getUsageForProvider({
        provider: "clinepass",
        apiKey: "cline-key",
      });

      expect(res.quotas["5 hour window (USD)"].total).toBe(1);
    });

    it("routes opencode-go via getUsageForProvider", async () => {
      proxyAwareFetch.mockResolvedValueOnce(
        jsonResponse({ usage: { rolling: { percent: 50 } } }),
      );

      const res = await getUsageForProvider({
        provider: "opencode-go",
        apiKey: "og-key-dispatch-" + Date.now(),
      });

      expect(res.quotas["Rolling (5h)"].used).toBe(50);
    });
  });
});
