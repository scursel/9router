import { describe, expect, it } from "vitest";
import {
  modelsFromStoredCatalog,
  pickerModelLabel,
  resolvePickerModels,
} from "../../src/shared/utils/pickerCatalog.js";

const ALITP_STATIC = [
  { id: "qwen3.8-max-preview", name: "Qwen3.8 Max Preview" },
  { id: "qwen3.7-max", name: "Qwen3.7 Max" },
];

const ALITP_STORED = [
  { id: "qwen3.8-max", name: "qwen3.8-max", kind: "llm" },
  { id: "qwen3.8-flash", name: "qwen3.8-flash", kind: "llm" },
  { id: "qwen-audio-3.0-tts-plus", name: "qwen-audio-3.0-tts-plus", kind: "tts" },
  { id: "wan2.7-image-pro", name: "wan2.7-image-pro", kind: "image" },
];

describe("modelsFromStoredCatalog", () => {
  it("merges unique ids across accounts of the same provider", () => {
    const connections = [
      { provider: "alitp-intl", modelCatalog: { models: ALITP_STORED.slice(0, 2) } },
      { provider: "alitp-intl", modelCatalog: { models: [ALITP_STORED[0], ALITP_STORED[2]] } },
      { provider: "cursor", modelCatalog: { models: [{ id: "gpt-5" }] } },
    ];
    const ids = modelsFromStoredCatalog(connections, "alitp-intl").map((m) => m.id);
    expect(ids).toEqual(["qwen3.8-max", "qwen3.8-flash", "qwen-audio-3.0-tts-plus"]);
  });

  it("skips unavailable entries and uncatalogued accounts", () => {
    const connections = [
      { provider: "alitp-intl" },
      { provider: "alitp-intl", modelCatalog: { models: [{ id: "gone", availability: "unavailable" }, { id: "qwen3.8-max" }] } },
    ];
    expect(modelsFromStoredCatalog(connections, "alitp-intl").map((m) => m.id)).toEqual(["qwen3.8-max"]);
  });

  it("ignores catalogs on inactive accounts", () => {
    const connections = [
      { provider: "alitp-intl", isActive: false, modelCatalog: { models: [{ id: "qwen3.8-max-preview" }] } },
      { provider: "alitp-intl", isActive: true, modelCatalog: { models: [{ id: "qwen3.8-max" }] } },
    ];
    expect(modelsFromStoredCatalog(connections, "alitp-intl").map((m) => m.id)).toEqual(["qwen3.8-max"]);
  });
});

describe("resolvePickerModels", () => {
  it("does not offer stale registry ids when the account catalog has moved on", () => {
    const picked = resolvePickerModels({
      storedModels: ALITP_STORED,
      staticModels: ALITP_STATIC,
    });
    const ids = picked.map((m) => m.id);
    expect(ids).toContain("qwen3.8-max");
    expect(ids).toContain("qwen3.8-flash");
    expect(ids).not.toContain("qwen3.8-max-preview");
  });

  it("keeps the static registry when no account has been catalogued yet", () => {
    const picked = resolvePickerModels({
      storedModels: [],
      staticModels: ALITP_STATIC,
    });
    expect(picked.map((m) => m.id)).toEqual(["qwen3.8-max-preview", "qwen3.7-max"]);
  });

  it("prefers a live fetch over the stored catalog", () => {
    const live = [{ id: "composer-1.5" }];
    const picked = resolvePickerModels({
      liveModels: live,
      storedModels: ALITP_STORED,
      staticModels: ALITP_STATIC,
    });
    expect(picked).toBe(live);
  });
});

describe("pickerModelLabel", () => {
  it("falls back to id when the upstream listing has no display name", () => {
    expect(pickerModelLabel({ id: "qwen3.8-max" })).toBe("qwen3.8-max");
    expect(pickerModelLabel({ id: "qwen3.8-max", display_name: "Qwen3.8 Max" })).toBe("Qwen3.8 Max");
  });
});
