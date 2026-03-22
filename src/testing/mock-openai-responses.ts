import {
  createTextResponse,
  createToolCallResponse,
  type MockResponderContext,
  type MockServerOptions,
} from "./mock-openai-server.js";

export function createYoloFlowModels(): MockServerOptions["models"] {
  return {
    title: () => createTextResponse("title-model", "YOLO E2E"),
    agent: ({ agentRequests }: MockResponderContext) => {
      if (agentRequests.length === 1) {
        return createToolCallResponse("agent-model", [
          {
            name: "bash",
            arguments: {
              command: "echo 'YOLO test passed'",
              description: "Test bash command execution",
            },
          },
        ]);
      }

      const lastBody = agentRequests.at(-1)?.body ?? "";
      const hasYoloPrompt = lastBody.includes("YOLO Mode is ENABLED");

      return createTextResponse(
        "agent-model",
        hasYoloPrompt
          ? "YOLO mode verification completed successfully"
          : "ERROR: YOLO system prompt not found",
      );
    },
  };
}

export function createPermissionFlowModels(): MockServerOptions["models"] {
  return {
    title: () => createTextResponse("title-model", "YOLO E2E"),
    agent: ({ agentRequests }: MockResponderContext) => {
      if (agentRequests.length === 1) {
        return createToolCallResponse("agent-model", [
          {
            name: "bash",
            arguments: {
              command: "printf integration-test",
              description: "Run integration test command",
            },
          },
        ]);
      }

      const lastBody = agentRequests.at(-1)?.body ?? "";
      if (lastBody.includes('"reply":"reject"')) {
        return createTextResponse("agent-model", "rejected");
      }

      return createTextResponse(
        "agent-model",
        "Permission flow completed successfully. Additional message displayed.",
      );
    },
  };
}

export function createQuestionFlowModels(): MockServerOptions["models"] {
  return {
    title: () => createTextResponse("title-model", "YOLO E2E"),
    agent: ({ agentRequests }: MockResponderContext) => {
      if (agentRequests.length === 1) {
        return createToolCallResponse("agent-model", [
          {
            name: "question",
            arguments: {
              questions: [
                {
                  question: "What answer should I use?",
                  header: "Answer",
                  options: [],
                  multiple: false,
                },
              ],
            },
          },
        ]);
      }

      const lastBody = agentRequests.at(-1)?.body ?? "";
      if (lastBody.includes('"rejected"') || lastBody.includes("rejected")) {
        return createTextResponse("agent-model", "Question was rejected as expected");
      }

      return createTextResponse("agent-model", "ERROR: Question was not rejected");
    },
  };
}
