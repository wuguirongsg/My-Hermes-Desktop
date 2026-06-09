import type { Message } from "../types";

export interface ConversationGroup {
  id: string;
  user: Message | null;
  assistants: Message[];
}

export function buildConversationGroups(messages: Message[]): ConversationGroup[] {
  const groups: ConversationGroup[] = [];
  let currentGroup: ConversationGroup | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = {
        id: message.id,
        user: message,
        assistants: [],
      };
      continue;
    }

    if (!currentGroup) {
      currentGroup = {
        id: `orphan-${message.id}`,
        user: null,
        assistants: [],
      };
    }
    currentGroup.assistants.push(message);
  }

  if (currentGroup) groups.push(currentGroup);

  return groups;
}
