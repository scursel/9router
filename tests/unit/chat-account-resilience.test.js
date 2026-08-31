import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProviderCredentials: vi.fn(),
  markAccountUnavailable: vi.fn(),
  clearAccountError: vi.fn(),
  extractApiKey: vi.fn(() => null),
  isValidApiKey: vi.fn(),
  getSettings: vi.fn(),
  getModelInfo: vi.fn(),
  getComboModels: vi.fn(),
  handleChatCore: vi.fn(),
  checkAndRefreshToken: vi.fn(),
  handleAntigravityQuotaError: vi.fn(),
}));

vi.mock("open-sse/index.js", () => ({}));

vi.mock("@/sse/services/auth.js", () => ({
  getProviderCredentials: mocks.getProviderCredentials,
  markAccountUnavailable: mocks.markAccountUnavailable,
  clearAccountError: mocks.clearAccountError,
  extractApiKey: mocks.extractApiKey,
  isValidApiKey: mocks.isValidApiKey,
}));

vi.mock("@/lib/localDb", () => ({
  getSettings: mocks.getSettings,
  getCombos: vi.fn(),
}));

vi.mock("@/sse/services/model.js", () => ({
  getModelInfo: mocks.getModelInfo,
  getComboModels: mocks.getComboModels,
}));

vi.mock("open-sse/handlers/chatCore.js", () => ({
  handleChatCore: mocks.handleChatCore,
}));

vi.mock("@/sse/services/tokenRefresh.js", () => ({
  checkAndRefreshToken: mocks.checkAndRefreshToken,
  updateProviderCredentials: vi.fn(),
}));

vi.mock("@/sse/utils/logger.js", () => ({
  request: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  maskKey: vi.fn(() => "masked"),
  line: vi.fn(),
  errorLine: vi.fn(),
}));

vi.mock("@/sse/services/antigravityQuota.js", () => ({
  handleAntigravityQuotaError: mocks.handleAntigravityQuotaError,
}));

vi.mock("@/lib/pxpipe/loader.js", () => ({
  getTransform: vi.fn(async () => null),
}));

vi.mock("@/lib/pxpipe/events.js", () => ({
  appendPxpipeEvent: vi.fn(),
}));

import { handleChat } from "@/sse/handlers/chat.js";
import {
  getCircuitBreaker,
  recordFailure,
  resetAllCircuitBreakers,
  buildAccountBreakerName,
  isBlocked,
  canExecute,
  shouldRecordBreakerFailure,
} from "../../open-sse/utils/circuitBreaker.js";
import {
  acquire,
  resolveAccountSemaphoreKey,
  SemaphoreCapacityError,
} from "../../open-sse/services/accountSemaphore.js";

const PROVIDER = "glm";
const MODEL = "glm-4";
const MODEL_STR = `${PROVIDER}/${MODEL}`;
const ACCOUNT_ID = "acc-resilience";

function chatRequest({ stream = false } = {}) {
  return new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL_STR,
      stream,
      messages: [{ role: "user", content: "hi" }],
    }),
  });
}

function credentials(overrides = {}) {
  return {
    apiKey: "test-key",
    connectionId: ACCOUNT_ID,
    connectionName: "Resilience Acc",
    providerSpecificData: { maxConcurrency: 1 },
    ...overrides,
  };
}

function allRateLimited(overrides = {}) {
  return {
    allRateLimited: true,
    lastErrorCode: 503,
    lastError: "Unavailable",
    retryAfter: new Date(Date.now() + 30_000).toISOString(),
    retryAfterHuman: "reset after 30s",
    ...overrides,
  };
}

describe("handleChat account resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllCircuitBreakers();
    mocks.getSettings.mockResolvedValue({ requireApiKey: false });
    mocks.getModelInfo.mockResolvedValue({ provider: PROVIDER, model: MODEL });
    mocks.getComboModels.mockResolvedValue(null);
    mocks.checkAndRefreshToken.mockImplementation(async (_provider, creds) => creds);
    mocks.markAccountUnavailable.mockResolvedValue({ shouldFallback: true });
    mocks.getProviderCredentials.mockImplementation(async (_provider, exclude) => {
      if (exclude instanceof Set && exclude.has(ACCOUNT_ID)) return allRateLimited();
      return credentials();
    });
  });

  it("records 5xx toward the breaker and does not count 429", async () => {
    const name = buildAccountBreakerName({ provider: PROVIDER, connectionId: ACCOUNT_ID });
    expect(shouldRecordBreakerFailure(500)).toBe(true);
    expect(shouldRecordBreakerFailure(429)).toBe(false);

    getCircuitBreaker(name, {
      failureThreshold: 5,
      resetTimeout: 30_000,
      isFailure: (err) => shouldRecordBreakerFailure(err?.statusCode),
    });
    for (let i = 0; i < 4; i++) recordFailure(name, { statusCode: 500 });

    mocks.handleChatCore.mockResolvedValue({
      success: false,
      status: 429,
      error: "rate limited",
      response: new Response("rl", { status: 429 }),
    });
    await handleChat(chatRequest());
    expect(isBlocked(name)).toBe(false);
    expect(canExecute(name)).toBe(true);

    mocks.handleChatCore.mockResolvedValue({
      success: false,
      status: 500,
      error: "upstream 500",
      response: new Response("boom", { status: 500 }),
    });
    await handleChat(chatRequest());
    expect(isBlocked(name)).toBe(true);
    expect(canExecute(name)).toBe(false);
  });

  it("holds the semaphore until onStreamComplete", async () => {
    let capturedOnStreamComplete;
    mocks.handleChatCore.mockImplementation(async (args) => {
      capturedOnStreamComplete = args.onStreamComplete;
      return {
        success: true,
        response: new Response("sse", {
          headers: { "Content-Type": "text/event-stream" },
        }),
      };
    });

    const response = await handleChat(chatRequest({ stream: true }));
    expect(response.status).toBe(200);
    expect(typeof capturedOnStreamComplete).toBe("function");

    const key = resolveAccountSemaphoreKey({
      provider: PROVIDER,
      connectionId: ACCOUNT_ID,
    });
    await expect(
      acquire(key, { maxConcurrency: 1, timeoutMs: 50 }),
    ).rejects.toThrow(SemaphoreCapacityError);

    capturedOnStreamComplete();

    const release = await acquire(key, { maxConcurrency: 1, timeoutMs: 50 });
    expect(typeof release).toBe("function");
    release();
  });

  it("returns 503 when remaining accounts are circuit-open even if lastStatus is 401", async () => {
    mocks.handleChatCore.mockResolvedValue({
      success: false,
      status: 401,
      error: "unauthorized",
      response: new Response("no", { status: 401 }),
    });
    mocks.getProviderCredentials
      .mockResolvedValueOnce(credentials())
      .mockResolvedValueOnce(allRateLimited({ lastErrorCode: 503 }));

    const response = await handleChat(chatRequest());
    expect(response.status).toBe(503);
  });

  it("does not create a breaker for noauth (missing connectionId)", async () => {
    mocks.getProviderCredentials.mockResolvedValue({
      accessToken: "public",
      connectionName: "Public",
    });
    mocks.markAccountUnavailable.mockResolvedValue({ shouldFallback: false });
    mocks.handleChatCore.mockResolvedValue({
      success: false,
      status: 500,
      error: "upstream 500",
      response: new Response("boom", { status: 500 }),
    });

    await handleChat(chatRequest());

    expect(getCircuitBreaker(`${PROVIDER}:undefined`)).toBe(null);
    expect(getCircuitBreaker(`${PROVIDER}:noauth`)).toBe(null);
    expect(mocks.handleChatCore).toHaveBeenCalled();
  });
});
