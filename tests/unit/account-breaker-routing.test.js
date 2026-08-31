import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connections: [],
  getProviderConnections: vi.fn(),
  getSettings: vi.fn(),
  resolveConnectionProxyConfig: vi.fn(),
  getAntigravityUsage: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getProviderConnections: mocks.getProviderConnections,
  getSettings: mocks.getSettings,
  getProxyPools: vi.fn(),
  validateApiKey: vi.fn(),
  updateProviderConnection: vi.fn(),
}));
vi.mock("@/lib/network/connectionProxy", () => ({
  resolveConnectionProxyConfig: mocks.resolveConnectionProxyConfig,
  pickProxyPoolId: vi.fn(),
}));
vi.mock("@/shared/constants/providers.js", () => ({
  FREE_PROVIDERS: {},
  resolveProviderId: (provider) => provider,
}));
vi.mock("open-sse/services/usage/google.js", () => ({
  getAntigravityUsage: mocks.getAntigravityUsage,
}));
vi.mock("@/sse/utils/logger.js", () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn() }));

import { getProviderCredentials } from "../../src/sse/services/auth.js";
import {
  getCircuitBreaker,
  recordFailure,
  resetAllCircuitBreakers,
  buildAccountBreakerName,
} from "../../open-sse/utils/circuitBreaker.js";

describe("getProviderCredentials skips OPEN breakers", () => {
  beforeEach(() => {
    resetAllCircuitBreakers();
    mocks.connections = [
      { id: "acc-a", provider: "glm", isActive: true, name: "A", providerSpecificData: {}, priority: 1 },
      { id: "acc-b", provider: "glm", isActive: true, name: "B", providerSpecificData: {}, priority: 2 },
    ];
    mocks.getProviderConnections.mockResolvedValue(mocks.connections);
    mocks.getSettings.mockResolvedValue({ fallbackStrategy: "fill-first" });
    mocks.resolveConnectionProxyConfig.mockResolvedValue({
      connectionProxyEnabled: false,
      connectionProxyUrl: "",
      connectionNoProxy: "",
      proxyPoolId: null,
      vercelRelayUrl: "",
    });
  });

  it("returns B when A is OPEN", async () => {
    const name = buildAccountBreakerName({ provider: "glm", connectionId: "acc-a" });
    getCircuitBreaker(name, { failureThreshold: 1, isFailure: () => true });
    recordFailure(name, { statusCode: 500 });
    const creds = await getProviderCredentials("glm");
    expect(creds.connectionId).toBe("acc-b");
  });

  it("returns allRateLimited when every account is OPEN", async () => {
    for (const id of ["acc-a", "acc-b"]) {
      const name = buildAccountBreakerName({ provider: "glm", connectionId: id });
      getCircuitBreaker(name, { failureThreshold: 1, resetTimeout: 30_000, isFailure: () => true });
      recordFailure(name, { statusCode: 500 });
    }
    const creds = await getProviderCredentials("glm");
    expect(creds.allRateLimited).toBe(true);
    expect(creds.retryAfter).toBeTruthy();
    expect(creds.retryAfterHuman).toBeTruthy();
    expect(creds.lastErrorCode).toBe(503);
  });
});
