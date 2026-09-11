export default {
  id: "orcarouter",
  priority: 60,
  alias: "orcarouter",
  aliases: ["orca"],
  display: {
    name: "OrcaRouter",
    icon: "hub",
    color: "#0891B2",
    textIcon: "OR",
    website: "https://orcarouter.ai",
    notice: { text: "OpenAI-compatible model gateway. New models appear automatically after sync.", apiKeyUrl: "https://orcarouter.ai" },
  },
  category: "apikey",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.orcarouter.ai/v1/chat/completions",
    validateUrl: "https://api.orcarouter.ai/v1/models",
    headers: {},
  },
  // Seed snapshot from the live public /v1/models (194 entries, 2026-09-05).
  // OrcaRouter serves third-party ids verbatim (anthropic/..., deepseek/...),
  // so these stay prefixed; the full account catalog arrives via modelsFetcher.
  models: [
    { id: "orcarouter/free", name: "OrcaRouter Free" },
    { id: "orcarouter/fusion", name: "OrcaRouter Fusion" },
    { id: "orcarouter/fusion-flash", name: "OrcaRouter Fusion Flash" },
    { id: "orcarouter/fusion-mini", name: "OrcaRouter Fusion Mini" },
    { id: "anthropic/claude-sonnet-5", name: "Anthropic: Claude Sonnet 5" },
    { id: "anthropic/claude-haiku-4.5", name: "Anthropic: Claude Haiku 4.5" },
    { id: "deepseek/deepseek-v4-flash", name: "DeepSeek: DeepSeek V4 Flash" },
    { id: "deepseek/deepseek-v4-pro", name: "DeepSeek: DeepSeek V4 Pro" },
    { id: "kimi/kimi-k2.5", name: "Kimi K2.5" },
  ],
  modelsFetcher: { url: "https://api.orcarouter.ai/v1/models", type: "openai" },
  passthroughModels: true,
};
