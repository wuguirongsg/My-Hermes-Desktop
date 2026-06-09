import { describe, expect, it } from "vitest";
import type { Message } from "../types";
import { buildConversationComparePairs, getMessageText } from "./conversationCompare";

function message(id: string, role: Message["role"], text = id, status: Message["status"] = "done"): Message {
  return {
    id,
    role,
    blocks: [{ type: "text", content: text }],
    timestamp: "2026-06-09T00:00:00.000Z",
    status,
  };
}

describe("buildConversationComparePairs", () => {
  it("pairs each assistant answer with the user question immediately before it", () => {
    const pairs = buildConversationComparePairs([
      message("u1", "user", "first question"),
      message("a1", "assistant", "first answer"),
      message("u2", "user", "second question"),
      message("a2", "assistant", "second answer"),
    ]);

    expect(pairs.map((pair) => [pair.user?.id, pair.assistant?.id])).toEqual([
      ["u1", "a1"],
      ["u2", "a2"],
    ]);
  });

  it("keeps an unanswered latest user message visible on the right side", () => {
    const pairs = buildConversationComparePairs([
      message("u1", "user"),
      message("a1", "assistant"),
      message("u2", "user", "pending question"),
    ]);

    expect(pairs.map((pair) => [pair.user?.id, pair.assistant?.id ?? null])).toEqual([
      ["u1", "a1"],
      ["u2", null],
    ]);
  });
});

describe("getMessageText", () => {
  it("joins text blocks so the compare view can show a compact question summary", () => {
    expect(
      getMessageText({
        ...message("u1", "user"),
        blocks: [
          { type: "text", content: "first" },
          { type: "image", dataUrl: "data:image/png;base64,abc", filename: "shot.png" },
          { type: "text", content: "second" },
        ],
      })
    ).toBe("first\n\nsecond");
  });
});
