import type { QuestionRequest } from "@opencode-ai/sdk/v2";

export async function handleQuestionAsked(serverUrl: URL, event: QuestionRequest): Promise<void> {
  const response = await fetch(new URL(`question/${event.id}/reject`, serverUrl).toString(), {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Failed to reject question: ${response.status}`);
  }
}
