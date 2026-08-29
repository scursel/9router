import { describe, expect, it } from "vitest";

import { formatQuotaUsage } from "@/app/(dashboard)/dashboard/usage/components/ProviderLimits/utils.js";

// Intl separates symbol and amount with U+00A0; plain toLocaleString() follows
// whatever locale the browser runs under, so counting quotas are compared
// against the same call instead of a hardcoded grouping.
const plain = (value) => value.toLocaleString();
const nbsp = (text) => text.replace(/\u00a0/g, " ");

describe("quota row formatting", () => {
  it("renders money quotas as pt-BR currency, keyed off the ISO code in the name", () => {
    expect(
      nbsp(formatQuotaUsage({ name: "Credits (USD)", used: 24.516287573, total: 27.01 })),
    ).toBe("US$ 24,52 / US$ 27,01");
  });

  it("leaves counting quotas as plain numbers", () => {
    expect(formatQuotaUsage({ name: "Rolling (5h)", used: 1200, total: 5000 })).toBe(
      `${plain(1200)} / ${plain(5000)}`,
    );
  });

  it("keeps the official unlimited wording", () => {
    expect(
      formatQuotaUsage({ name: "Consumo 7d (medido local)", used: 940, unlimited: true }),
    ).toBe(`${plain(940)} used · Unlimited`);
  });

  it("falls back to infinity when a counting quota has no total", () => {
    expect(formatQuotaUsage({ name: "Weekly", used: 3, total: 0 })).toBe("3 / ∞");
  });

  it("formats an unlimited money quota as currency too", () => {
    expect(
      nbsp(formatQuotaUsage({ name: "Purchased credits (USD)", used: 5, unlimited: true })),
    ).toBe("US$ 5,00 used · Unlimited");
  });

  it("picks the currency the collector reported, not a fixed one", () => {
    expect(nbsp(formatQuotaUsage({ name: "Available balance (CNY)", used: 0, total: 12.5 }))).toBe(
      "CN¥ 0,00 / CN¥ 12,50",
    );
  });
});
