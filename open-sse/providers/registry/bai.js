export default {
  id: "bai",
  priority: 60,
  alias: "bai",
  display: {
    name: "b.ai",
    icon: "hub",
    color: "#2563EB",
    textIcon: "BA",
    website: "https://docs.b.ai",
    notice: { text: "OpenAI-compatible model gateway. New models appear automatically after sync.", apiKeyUrl: "https://docs.b.ai" },
  },
  category: "apikey",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.b.ai/v1/chat/completions",
    validateUrl: "https://api.b.ai/v1/models",
    headers: {},
  },
  models: [],
  modelsFetcher: { url: "https://api.b.ai/v1/models", type: "openai" },
  passthroughModels: true,
  features: {
    usage: true,
    usageApikey: true,
  },
};
