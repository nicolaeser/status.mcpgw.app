import type { PromptMessage, PromptResult } from "../../types.js";

export function textPrompt(text: string, description?: string): PromptResult {
  return {
    ...(description && { description }),
    messages: [userMessage(text)],
  };
}

export function userMessage(text: string): PromptMessage {
  return {
    role: "user",
    content: { type: "text", text },
  };
}
