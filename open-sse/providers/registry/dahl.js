export default {
  id: "dahl",
  priority: 60,
  alias: "dahl",
  display: {
    name: "Dahl",
    icon: "hub",
    color: "#7C3AED",
    textIcon: "DH",
    website: "https://dahl.global",
    notice: { text: "Dahl OpenAI-compatible endpoint. New models appear automatically after sync.", apiKeyUrl: "https://dahl.global" },
  },
  category: "apikey",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://inference.dahl.global/v1/chat/completions",
    validateUrl: "https://inference.dahl.global/v1/models",
    headers: {},
  },
  // Seed snapshot from the live public /v1/models (2 entries, 2026-09-05).
  models: [
    { id: "MiniMaxAI/MiniMax-M2.7", name: "MiniMaxAI MiniMax M2.7" },
    { id: "deepseek-ai/DeepSeek-V4-Flash-0731", name: "DeepSeek V4 Flash 0731" },
  ],
  modelsFetcher: { url: "https://inference.dahl.global/v1/models", type: "openai" },
  passthroughModels: true,
};
