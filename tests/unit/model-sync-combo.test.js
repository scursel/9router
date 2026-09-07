import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/localDb", () => ({
  getModelAliases: vi.fn(async () => ({})),
  getComboByName: vi.fn(async () => null),
  getProviderNodes: vi.fn(async () => []),
  getProviderConnections: vi.fn(async () => []),
}));

import { getComboModels } from "../../src/sse/services/model.js";
import { getComboByName, getProviderConnections } from "@/lib/localDb";

beforeEach(() => {
  vi.clearAllMocks();
  getComboByName.mockImplementation(async () => null);
  getProviderConnections.mockImplementation(async () => []);
});

function catalogConn(provider, models) {
  return { id: `${provider}-1`, provider, isActive: true, modelCatalog: { models, lastSuccessAt: new Date().toISOString(), lastError: null } };
}

describe("combo member filtering against synced catalogs", () => {
  it("keeps the stored combo untouched when nothing is catalogued", async () => {
    getComboByName.mockResolvedValue({ name: "mix", models: ["bai/m1", "orcarouter/m2"] });
    expect(await getComboModels("mix")).toEqual(["bai/m1", "orcarouter/m2"]);
  });

  it("skips a twice-removed member but keeps the saved order of the rest", async () => {
    getComboByName.mockResolvedValue({ name: "mix", models: ["bai/old", "bai/new"] });
    getProviderConnections.mockResolvedValue([
      catalogConn("bai", [
        { id: "old", availability: "unavailable", missingSyncs: 2 },
        { id: "new", availability: "available", missingSyncs: 0 },
      ]),
    ]);
    expect(await getComboModels("mix")).toEqual(["bai/new"]);
  });

  it("keeps a member absent only once (temporarily-absent)", async () => {
    getComboByName.mockResolvedValue({ name: "mix", models: ["bai/wobbly"] });
    getProviderConnections.mockResolvedValue([
      catalogConn("bai", [{ id: "wobbly", availability: "temporarily-absent", missingSyncs: 1 }]),
    ]);
    expect(await getComboModels("mix")).toEqual(["bai/wobbly"]);
  });

  it("keeps a member when a second account still offers it", async () => {
    getComboByName.mockResolvedValue({ name: "mix", models: ["bai/shared"] });
    getProviderConnections.mockResolvedValue([
      catalogConn("bai", [{ id: "shared", availability: "unavailable", missingSyncs: 2 }]),
      catalogConn("bai", [{ id: "shared", availability: "available", missingSyncs: 0 }]),
    ]);
    expect(await getComboModels("mix")).toEqual(["bai/shared"]);
  });

  it("matches gateway-prefixed ids against bare member models", async () => {
    getComboByName.mockResolvedValue({ name: "mix", models: ["orcarouter/claude-sonnet-5"] });
    getProviderConnections.mockResolvedValue([
      catalogConn("orcarouter", [{ id: "anthropic/claude-sonnet-5", availability: "available", missingSyncs: 0 }]),
    ]);
    expect(await getComboModels("mix")).toEqual(["orcarouter/claude-sonnet-5"]);
  });

  it("returns an empty list when every member is confirmed unavailable (clear 503 downstream)", async () => {
    getComboByName.mockResolvedValue({ name: "mix", models: ["bai/dead-a", "bai/dead-b"] });
    getProviderConnections.mockResolvedValue([
      catalogConn("bai", [
        { id: "dead-a", availability: "unavailable", missingSyncs: 2 },
        { id: "dead-b", availability: "unavailable", missingSyncs: 2 },
      ]),
    ]);
    expect(await getComboModels("mix")).toEqual([]);
  });

  it("never touches aliases or custom-node prefixes: unresolvable members pass through", async () => {
    getComboByName.mockResolvedValue({ name: "mix", models: ["myalias", "local-qwen/model"] });
    expect(await getComboModels("mix")).toEqual(["myalias", "local-qwen/model"]);
  });
});
