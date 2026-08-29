import { describe, expect, it } from "vitest";
import "./registerAll.js";
import {
  canonicalToolCallSignature,
  hasRepeatedTrailingToolCalls,
} from "../../open-sse/translator/concerns/toolCall.js";
import { openaiToAntigravityRequest } from "../../open-sse/translator/request/openai-to-gemini.js";

const call = (id, args = { query: "same" }) => ({
  id,
  type: "function",
  function: { name: "search", arguments: JSON.stringify(args) },
});

describe("Antigravity tool-loop breaker", () => {
  it("canonicalizes argument key order and ignores tool-call ids", () => {
    expect(canonicalToolCallSignature([call("a", { z: 1, a: 2 })])).toBe(
      canonicalToolCallSignature([call("b", { a: 2, z: 1 })]),
    );
  });

  it("detects three repeated assistant calls separated by results", () => {
    const messages = [];
    for (let index = 0; index < 3; index += 1) {
      messages.push({ role: "assistant", tool_calls: [call(`call-${index}`)] });
      messages.push({ role: "tool", tool_call_id: `call-${index}`, content: "no progress" });
    }
    expect(hasRepeatedTrailingToolCalls({ messages }, 3)).toBe(true);
  });

  it("does not cross an ordinary conversational turn", () => {
    expect(hasRepeatedTrailingToolCalls({
      messages: [
        { role: "assistant", tool_calls: [call("a")] },
        { role: "tool", tool_call_id: "a", content: "same" },
        { role: "user", content: "try a different approach" },
        { role: "assistant", tool_calls: [call("b")] },
        { role: "tool", tool_call_id: "b", content: "same" },
      ],
    }, 3)).toBe(false);
  });

  it("forces one Antigravity request turn to NONE", () => {
    const messages = [{ role: "user", content: "search" }];
    for (let index = 0; index < 3; index += 1) {
      messages.push({ role: "assistant", tool_calls: [call(`call-${index}`)] });
      messages.push({ role: "tool", tool_call_id: `call-${index}`, content: "no progress" });
    }
    const envelope = openaiToAntigravityRequest("gemini-3.7-flash-low", {
      messages,
      tools: [{
        type: "function",
        function: {
          name: "search",
          description: "Search",
          parameters: { type: "object", properties: {} },
        },
      }],
    }, true, { projectId: "project-1", connectionId: "connection-1" });

    expect(envelope.request.toolConfig.functionCallingConfig.mode).toBe("NONE");
  });
});
