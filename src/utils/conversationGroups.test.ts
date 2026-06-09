import { describe, expect, it } from "vitest";
import type { Message } from "../types";
import { buildConversationGroups } from "./conversationGroups";

function message(id: string, role: Message["role"], text = id, status: Message["status"] = "done"): Message {
  return {
    id,
    role,
    blocks: [{ type: "text", content: text }],
    timestamp: "2026-06-09T00:00:00.000Z",
    status,
  };
}

describe("buildConversationGroups", () => {
  it("groups all consecutive assistant replies under the preceding user question", () => {
    const groups = buildConversationGroups([
      message("u1", "user", "first question"),
      message("a1", "assistant", "first answer part one"),
      message("a2", "assistant", "first answer part two"),
      message("u2", "user", "second question"),
      message("a3", "assistant", "second answer"),
    ]);

    expect(groups.map((group) => [group.user?.id, group.assistants.map((reply) => reply.id)])).toEqual([
      ["u1", ["a1", "a2"]],
      ["u2", ["a3"]],
    ]);
  });

  it("keeps an unanswered latest user message as its own group", () => {
    const groups = buildConversationGroups([
      message("u1", "user"),
      message("a1", "assistant"),
      message("u2", "user", "pending question"),
    ]);

    expect(groups.map((group) => [group.user?.id, group.assistants.map((reply) => reply.id)])).toEqual([
      ["u1", ["a1"]],
      ["u2", []],
    ]);
  });

  it("keeps consecutive assistant messages before the first user in one orphan group", () => {
    const groups = buildConversationGroups([
      message("a1", "assistant"),
      message("a2", "assistant"),
      message("u1", "user"),
    ]);

    expect(groups.map((group) => [group.user?.id ?? null, group.assistants.map((reply) => reply.id)])).toEqual([
      [null, ["a1", "a2"]],
      ["u1", []],
    ]);
  });
});
