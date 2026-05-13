import type { Message } from "../types";

export function getLastUserText(messages: Message[]): string | null {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  if (!lastUser) return null;

  const text = lastUser.blocks
    .filter((block) => block.type === "text")
    .map((block) => block.content)
    .join("\n")
    .trim();

  return text || null;
}

export function removeLastTurn(messages: Message[]): Message[] {
  const assistantIndex = [...messages]
    .reverse()
    .findIndex((message) => message.role === "assistant");
  if (assistantIndex < 0) return messages;

  const lastAssistantIndex = messages.length - 1 - assistantIndex;
  const lastUserIndex = messages
    .slice(0, lastAssistantIndex)
    .map((message, index) => ({ message, index }))
    .reverse()
    .find((item) => item.message.role === "user")?.index;

  if (lastUserIndex === undefined) {
    return messages.slice(0, lastAssistantIndex);
  }

  return [
    ...messages.slice(0, lastUserIndex),
    ...messages.slice(lastAssistantIndex + 1),
  ];
}
