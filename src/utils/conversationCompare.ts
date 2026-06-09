import type { Message } from "../types";

export interface ConversationComparePair {
  id: string;
  user: Message | null;
  assistant: Message | null;
}

export function getMessageText(message: Message | null | undefined): string {
  if (!message) return "";
  const text = message.blocks
    .filter((block) => block.type === "text")
    .map((block) => block.content.trim())
    .filter(Boolean)
    .join("\n\n");
  return text || message.rawOutput?.trim() || "";
}

export function buildConversationComparePairs(messages: Message[]): ConversationComparePair[] {
  const pairs: ConversationComparePair[] = [];
  let pendingUser: Message | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      if (pendingUser) {
        pairs.push({
          id: `pending-${pendingUser.id}`,
          user: pendingUser,
          assistant: null,
        });
      }
      pendingUser = message;
      continue;
    }

    pairs.push({
      id: `${pendingUser?.id ?? "orphan"}-${message.id}`,
      user: pendingUser,
      assistant: message,
    });
    pendingUser = null;
  }

  if (pendingUser) {
    pairs.push({
      id: `pending-${pendingUser.id}`,
      user: pendingUser,
      assistant: null,
    });
  }

  return pairs;
}
