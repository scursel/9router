import { describe, it, expect } from "vitest";
import { getImageAdapter, isImageProvider } from "../../open-sse/handlers/imageProviders/index.js";

const PROVIDER_ID = "openai-compatible-chat-f13a8bca-e94e-478a-99e2-d4b1032f1522";

describe("Alibaba Wan Image Adapter", () => {
  it("resolves adapter via index functions", () => {
    expect(isImageProvider(PROVIDER_ID)).toBe(true);
    const adapter = getImageAdapter(PROVIDER_ID);
    expect(adapter).toBeDefined();
    expect(typeof adapter.buildUrl).toBe("function");
    expect(typeof adapter.buildHeaders).toBe("function");
    expect(typeof adapter.buildBody).toBe("function");
    expect(typeof adapter.normalize).toBe("function");
  });

  it("buildUrl returns aliyuncs token-plan host", () => {
    const adapter = getImageAdapter(PROVIDER_ID);
    const url = adapter.buildUrl("wan-2.1", { apiKey: "secret" });
    expect(url).toBe("https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions");
    expect(url).toContain("token-plan.ap-southeast-1.maas.aliyuncs.com");
  });

  it("buildHeaders includes Authorization Bearer header", () => {
    const adapter = getImageAdapter(PROVIDER_ID);
    expect(adapter.buildHeaders({ apiKey: "key-123" })).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer key-123",
    });
    expect(adapter.buildHeaders({ accessToken: "token-456" })).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer token-456",
    });
    expect(adapter.buildHeaders(null)).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer ",
    });
  });

  it("buildBody maps sizes (4K, 2K, 1K), caps reference images at 4, and sets parameters", () => {
    const adapter = getImageAdapter(PROVIDER_ID);

    // 4K mapping
    const body4K = adapter.buildBody("wan-model", { prompt: "a sunset", size: "4096x4096" });
    expect(body4K.parameters.size).toBe("4K");
    expect(body4K.parameters.watermark).toBe(false);

    // 2K mapping
    const body2K_1 = adapter.buildBody("wan-model", { prompt: "a sunset", size: "2048x2048" });
    expect(body2K_1.parameters.size).toBe("2K");
    const body2K_2 = adapter.buildBody("wan-model", { prompt: "a sunset", size: "1536x1024" });
    expect(body2K_2.parameters.size).toBe("2K");

    // 1K default mapping
    const body1K = adapter.buildBody("wan-model", { prompt: "a sunset", size: "1024x1024" });
    expect(body1K.parameters.size).toBe("1K");

    // Images ref capping at 4 + parameter passing
    const bodyComplex = adapter.buildBody("wan-model", {
      prompt: "landscape",
      size: "1024x1024",
      watermark: true,
      image: "http://example.com/single.jpg",
      images: [
        "http://example.com/1.jpg",
        "http://example.com/2.jpg",
        "http://example.com/3.jpg",
        "http://example.com/4.jpg",
        "http://example.com/5.jpg",
        null,
        123,
      ],
      negative_prompt: "blurry",
      prompt_extend: true,
      seed: 42,
      enable_interleave: false,
    });

    expect(bodyComplex.model).toBe("wan-model");
    expect(bodyComplex.messages).toHaveLength(1);
    expect(bodyComplex.messages[0].role).toBe("user");

    const content = bodyComplex.messages[0].content;
    expect(content[0]).toEqual({ text: "landscape" });
    // First ref is body.images[0..], then body.image -> total sliced to 4
    expect(content.slice(1)).toHaveLength(4);
    expect(content.slice(1)).toEqual([
      { image: "http://example.com/1.jpg" },
      { image: "http://example.com/2.jpg" },
      { image: "http://example.com/3.jpg" },
      { image: "http://example.com/4.jpg" },
    ]);

    expect(bodyComplex.parameters).toEqual({
      size: "1K",
      watermark: true,
      negative_prompt: "blurry",
      prompt_extend: true,
      seed: 42,
      enable_interleave: false,
    });
  });

  it("normalize extracts b64_json and URLs and deduplicates items", () => {
    const adapter = getImageAdapter(PROVIDER_ID);

    const mockPayload = {
      id: "chatcmpl-123",
      choices: [
        {
          message: {
            content: "Here is the image:",
            images: [
              "https://example.com/img1.png",
              "https://example.com/img1.png", // duplicate
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            ],
          },
        },
      ],
      output: {
        b64_json: "b64string123",
        data: [
          { b64_json: "b64string123" }, // duplicate b64
          { url: "https://example.com/img2.png" },
        ],
      },
    };

    const result = adapter.normalize(mockPayload);
    expect(result.created).toBeGreaterThan(0);
    // Traversal order of keys: ["url", "image_url", "image", "data", "output", "choices", "message", "content", "images"]
    // "output" is checked before "choices", so output.b64_json and output.data are extracted first.
    expect(result.data).toEqual([
      { b64_json: "b64string123" },
      { url: "https://example.com/img2.png" },
      { url: "https://example.com/img1.png" },
      { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" },
    ]);
  });
});
