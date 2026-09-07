import { AI_PROVIDERS } from "@/shared/constants/providers";

/**
 * Human label for a provider id in usage/dashboard tables.
 * Order: custom node name → registry display name → friendly custom fallback → raw id.
 */
export function resolveProviderDisplayName(providerId, nodeNameMap = {}) {
  if (!providerId || typeof providerId !== "string") return "Unknown";
  const id = providerId.trim();
  if (!id) return "Unknown";

  if (nodeNameMap[id]) return nodeNameMap[id];

  const registryName = AI_PROVIDERS[id]?.name;
  if (registryName) return registryName;

  const custom = id.match(/^(openai|anthropic)-compatible-(chat|responses|messages|embedding)-(.+)$/i);
  if (custom) {
    const vendor = custom[1].toLowerCase() === "anthropic" ? "Custom Anthropic" : "Custom OpenAI";
    const rest = custom[3];
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(rest);
    if (uuidLike) return `${vendor} (${rest.slice(0, 8)})`;
    // slug ids e.g. hf-qwen-obliterated
    const pretty = rest.replace(/[-_]+/g, " ").trim();
    return pretty ? `${vendor} (${pretty})` : vendor;
  }

  return id;
}
