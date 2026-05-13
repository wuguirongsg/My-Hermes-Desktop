import { describe, expect, it } from "vitest";
import type { Message } from "../types";
import { getLastUserText, removeLastTurn } from "./messageActions";

function message(id: string, role: Message["role"]): Message {
  return {
    id,
    role,
    blocks: [{ type: "text", content: id }],
    timestamp: "2026-05-13T00:00:00.000Z",
    status: "done",
  };
}

describe("removeLastTurn", () => {
  it("removes the last user and assistant pair", () => {
    const messages = [
      message("user-1", "user"),
      message("assistant-1", "assistant"),
      message("user-2", "user"),
      message("assistant-2", "assistant"),
    ];

    expect(removeLastTurn(messages).map((item) => item.id)).toEqual([
      "user-1",
      "assistant-1",
    ]);
  });
});

describe("getLastUserText", () => {
  it("returns the latest user text content", () => {
    const messages = [
      message("user-1", "user"),
      message("assistant-1", "assistant"),
      message("user-2", "user"),
      message("assistant-2", "assistant"),
    ];

    expect(getLastUserText(messages)).toBe("user-2");
  });
});
