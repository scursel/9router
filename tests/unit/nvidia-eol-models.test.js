import { describe, expect, it } from "vitest";
import { PROVIDER_MODELS } from "../../open-sse/providers/index.js";
import { PROVIDER_CAPABILITIES } from "../../open-sse/providers/capabilities.js";
import alitpIntl from "../../open-sse/providers/registry/alitp-intl.js";
import opencodeGo from "../../open-sse/providers/registry/opencode-go.js";
import nvidiaRegistry from "../../open-sse/providers/registry/nvidia.js";

describe("NVIDIA EOL models & registry usage flags", () => {
  it("removes EOL models from nvidia registry and PROVIDER_MODELS", () => {
    const nvidiaModelIds = nvidiaRegistry.models.map((m) => m.id);
    expect(nvidiaModelIds).not.toContain("z-ai/glm-5.2");
    expect(nvidiaModelIds).not.toContain("deepseek-ai/deepseek-v4-pro");

    const exportedNvidiaModelIds = (PROVIDER_MODELS.nvidia || []).map((m) => m.id || m.value);
    expect(exportedNvidiaModelIds).not.toContain("z-ai/glm-5.2");
    expect(exportedNvidiaModelIds).not.toContain("deepseek-ai/deepseek-v4-pro");
  });

  it("removes EOL model entries from PROVIDER_CAPABILITIES.nvidia", () => {
    const nvidiaCaps = PROVIDER_CAPABILITIES.nvidia || {};
    expect(nvidiaCaps["z-ai/glm-5.2"]).toBeUndefined();
    expect(nvidiaCaps["deepseek-ai/deepseek-v4-pro"]).toBeUndefined();
  });

  it("retains model entries in alitp-intl and opencode-go registries", () => {
    const alitpIds = alitpIntl.models.map((m) => m.id);
    expect(alitpIds).toContain("glm-5.2");
    expect(alitpIds).toContain("deepseek-v4-pro");

    const opencodeGoIds = opencodeGo.models.map((m) => m.id);
    expect(opencodeGoIds).toContain("glm-5.2");
    expect(opencodeGoIds).toContain("deepseek-v4-pro");
  });

  it("has usage feature flags in alitp-intl and opencode-go registries", () => {
    expect(alitpIntl.features).toEqual({
      usage: true,
      usageApikey: true,
    });
    expect(opencodeGo.features).toEqual({
      usage: true,
      usageApikey: true,
    });
  });
});
