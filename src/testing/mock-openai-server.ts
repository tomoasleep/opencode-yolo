import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export type MockRequestRecord = {
  body: string;
  model: string;
  path: string;
};

export type MockResponderContext = {
  request: MockRequestRecord;
  titleRequests: MockRequestRecord[];
  agentRequests: MockRequestRecord[];
};

export type MockResponder = (context: MockResponderContext) => unknown;

export type MockServerOptions = {
  port?: number;
  models: {
    title: MockResponder;
    agent: MockResponder;
  };
};

export type MockOpenAIServer = {
  url: string;
  titleRequests: MockRequestRecord[];
  agentRequests: MockRequestRecord[];
  stop: () => Promise<void>;
};

let globalServer: ReturnType<typeof createServer> | null = null;

export async function startMockOpenAIServer(options: MockServerOptions): Promise<MockOpenAIServer> {
  const titleRequests: MockRequestRecord[] = [];
  const agentRequests: MockRequestRecord[] = [];

  const server = createServer(async (request, response) => {
    try {
      await handleRequest(request, response, options.models, titleRequests, agentRequests);
    } catch (error) {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      );
    }
  });

  const port = await listen(server, options.port ?? 0);
  globalServer = server;

  return {
    url: `http://127.0.0.1:${port}`,
    titleRequests,
    agentRequests,
    stop: () => closeServer(server),
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  models: MockServerOptions["models"],
  titleRequests: MockRequestRecord[],
  agentRequests: MockRequestRecord[],
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  if (url.pathname === "/v1/models" && request.method === "GET") {
    writeJson(response, 200, {
      object: "list",
      data: [
        { id: "agent-model", object: "model", owned_by: "test" },
        { id: "title-model", object: "model", owned_by: "test" },
      ],
    });
    return;
  }

  if (url.pathname !== "/v1/chat/completions" || request.method !== "POST") {
    response.statusCode = 404;
    response.end("Not Found");
    return;
  }

  const bodyText = await readBody(request);
  const body = JSON.parse(bodyText) as { model: string };
  const record = {
    body: bodyText,
    model: body.model,
    path: url.pathname,
  };

  if (body.model === "title-model") {
    titleRequests.push(record);
    writeResponse(
      response,
      bodyText,
      models.title({
        request: record,
        titleRequests,
        agentRequests,
      }),
    );
    return;
  }

  if (body.model === "agent-model") {
    agentRequests.push(record);
    writeResponse(
      response,
      bodyText,
      models.agent({
        request: record,
        titleRequests,
        agentRequests,
      }),
    );
    return;
  }

  writeJson(response, 400, { error: `Unsupported model: ${body.model}` });
}

export function createTextResponse(model: string, content: string) {
  return {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  };
}

export function createToolCallResponse(
  model: string,
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>,
) {
  return {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: toolCalls.map((toolCall, index) => ({
            id: `call-${index + 1}`,
            type: "function",
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.arguments),
            },
          })),
        },
        finish_reason: "tool_calls",
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  };
}

function writeResponse(response: ServerResponse, requestBody: string, payload: unknown): void {
  const request = JSON.parse(requestBody) as { stream?: boolean };
  if (request.stream) {
    writeStreamResponse(response, payload);
    return;
  }

  writeJson(response, 200, payload);
}

function writeStreamResponse(response: ServerResponse, payload: unknown): void {
  response.statusCode = 200;
  response.setHeader("content-type", "text/event-stream");
  response.setHeader("cache-control", "no-cache");
  response.setHeader("connection", "keep-alive");

  const chunks = toStreamChunks(payload);
  for (const chunk of chunks) {
    response.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }

  response.end("data: [DONE]\n\n");
}

function toStreamChunks(payload: unknown): unknown[] {
  const response = payload as {
    id: string;
    model: string;
    created: number;
    choices: Array<{
      finish_reason: string;
      message: {
        role: string;
        content: string | null;
        tool_calls?: Array<{
          id: string;
          type: string;
          function: { name: string; arguments: string };
        }>;
      };
    }>;
  };

  const choice = response.choices[0];
  const chunks: unknown[] = [
    {
      id: response.id,
      object: "chat.completion.chunk",
      created: response.created,
      model: response.model,
      choices: [{ index: 0, delta: { role: choice.message.role } }],
    },
  ];

  if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
    chunks.push({
      id: response.id,
      object: "chat.completion.chunk",
      created: response.created,
      model: response.model,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: choice.message.tool_calls.map((toolCall, index) => ({
              ...toolCall,
              index,
            })),
          },
        },
      ],
    });
  } else if (choice.message.content) {
    chunks.push({
      id: response.id,
      object: "chat.completion.chunk",
      created: response.created,
      model: response.model,
      choices: [{ index: 0, delta: { content: choice.message.content } }],
    });
  }

  chunks.push({
    id: response.id,
    object: "chat.completion.chunk",
    created: response.created,
    model: response.model,
    choices: [{ index: 0, delta: {}, finish_reason: choice.finish_reason }],
  });

  return chunks;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function writeJson(response: ServerResponse, statusCode: number, value: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(value));
}

function listen(server: ReturnType<typeof createServer>, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.off("listening", onListening);
      reject(error);
    };

    const onListening = () => {
      server.off("error", onError);
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        reject(new Error("Failed to determine mock server port"));
        return;
      }
      resolve(address.port);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  if (globalServer === server) {
    globalServer = null;
  }
}

export async function stopMockOpenAIServer(): Promise<void> {
  if (!globalServer) {
    return;
  }

  await closeServer(globalServer);
}
