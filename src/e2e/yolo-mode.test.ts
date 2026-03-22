import { describe, expect, test } from "bun:test";

import { createYoloFlowModels } from "../testing/mock-openai-responses.js";
import { startMockOpenAIServer } from "../testing/mock-openai-server.js";
import { startOpencodeProcess } from "../testing/opencode-process.js";

describe("YOLO Mode", () => {
  test("automatically allows file permissions and transforms system prompt", async () => {
    const mockServer = await startMockOpenAIServer({
      models: createYoloFlowModels(),
    });

    const opencodeProcess = await startOpencodeProcess({
      yoloPort: 4321,
      mockServerUrl: mockServer.url,
      permission: {
        bash: "ask",
      },
      prompt: "Run a test bash command",
    });

    try {
      await opencodeProcess.waitForLog(/\[yolo:e2e\] plugin loaded/);
      await opencodeProcess.waitForLog(/\[yolo:e2e\] serverUrl/);

      await waitUntil(async () => {
        const messages = await opencodeProcess.readMessages();
        return (
          messages.includes('"status":"completed"') &&
          messages.includes("YOLO mode verification completed successfully")
        );
      });

      const stdout = opencodeProcess.stdout;
      expect(stdout).toContain("[yolo:e2e] plugin loaded");

      const agentRequest = mockServer.agentRequests[1];
      expect(agentRequest.body).toContain("YOLO Mode is ENABLED");
    } finally {
      opencodeProcess.stop();
      await opencodeProcess.cleanup();
      await mockServer.stop();
    }
  }, 45000);

  test("config hook sets question permission to deny", async () => {
    const mockServer = await startMockOpenAIServer({
      models: createYoloFlowModels(),
    });

    const opencodeProcess = await startOpencodeProcess({
      yoloPort: 4322,
      mockServerUrl: mockServer.url,
      prompt: "Test that question permission is denied",
    });

    try {
      await opencodeProcess.waitForLog(/\[yolo:e2e\] plugin loaded/);

      await waitUntil(async () => {
        const messages = await opencodeProcess.readMessages();
        return messages.includes('"status":"completed"');
      });

      expect(opencodeProcess.stdout).toContain("[yolo:e2e] plugin loaded");
    } finally {
      opencodeProcess.stop();
      await opencodeProcess.cleanup();
      await mockServer.stop();
    }
  }, 45000);
});

async function waitUntil(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 15000,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out after ${timeoutMs}ms`);
}
