import { nowSec } from "./_base.js";

const ALIBABA_COMPAT_URL =
  "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions";

export default {
  buildUrl: () => ALIBABA_COMPAT_URL,
  buildHeaders: (credentials) => {
    const key = credentials?.apiKey || credentials?.accessToken || "";
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    };
  },
  buildBody: (model, body) => {
    const raw = String(body.size || "1024x1024");
    const size = raw.includes("4096")
      ? "4K"
      : raw.includes("2048") || raw.includes("1536")
        ? "2K"
        : "1K";
    const content = [{ text: String(body.prompt || "") }];
    const refs = [];
    if (Array.isArray(body.images)) refs.push(...body.images);
    if (body.image) refs.push(body.image);
    for (const image of refs.filter((x) => typeof x === "string" && x).slice(0, 4)) {
      content.push({ image });
    }
    const parameters = {
      size,
      watermark: typeof body.watermark === "boolean" ? body.watermark : false,
    };
    for (const key of ["negative_prompt", "prompt_extend", "seed", "enable_interleave"]) {
      if (body[key] !== undefined) parameters[key] = body[key];
    }
    return {
      model,
      messages: [{ role: "user", content }],
      parameters,
    };
  },
  normalize: (payload) => {
    const data = [];
    const seen = new Set();
    const add = (item) => {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        data.push(item);
      }
    };
    const walk = (value) => {
      if (typeof value === "string") {
        if (/^data:image\//i.test(value) || /^https?:\/\//i.test(value)) {
          add({ url: value });
        }
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) walk(item);
        return;
      }
      if (!value || typeof value !== "object") return;
      if (typeof value.b64_json === "string" && value.b64_json) {
        add({ b64_json: value.b64_json });
      }
      for (const key of [
        "url",
        "image_url",
        "image",
        "data",
        "output",
        "choices",
        "message",
        "content",
        "images",
      ]) {
        walk(value[key]);
      }
    };
    walk(payload);
    return { created: nowSec(), data };
  },
};
