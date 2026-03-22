import { afterEach, beforeEach, describe, expect, test } from "bun:test";

describe("handleQuestionAsked", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("rejects question by calling the reject endpoint", async () => {
    const { handleQuestionAsked } = await import("./handle-question-asked.js");

    let calledUrl = "";
    let calledMethod = "";

    const mockServerUrl = new URL("http://localhost:1234");

    globalThis.fetch = (async (url: string | URL, options?: RequestInit) => {
      calledUrl = url.toString();
      calledMethod = options?.method ?? "GET";
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    await handleQuestionAsked(mockServerUrl, {
      id: "test-question-id",
      sessionID: "test-session",
      questions: [],
    });

    expect(calledUrl).toBe("http://localhost:1234/question/test-question-id/reject");
    expect(calledMethod).toBe("POST");
  });

  test("throws error when reject fails", async () => {
    const { handleQuestionAsked } = await import("./handle-question-asked.js");

    const mockServerUrl = new URL("http://localhost:1234");

    globalThis.fetch = (async () => {
      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch;

    await expect(
      handleQuestionAsked(mockServerUrl, {
        id: "test-question-id",
        sessionID: "test-session",
        questions: [],
      }),
    ).rejects.toThrow("Failed to reject question: 500");
  });
});
