import { spawn, spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createOpencodeClient } from "@opencode-ai/sdk/v2";

export type OpencodeProcessOptions = {
  yoloPort: number;
  mockServerUrl: string;
  opencodePort?: number;
  permission?: Record<string, string>;
  prompt: string;
};

export type OpencodeProcess = {
  pid: number | undefined;
  sessionID: string;
  logsDir: string;
  readonly stdout: string;
  readonly stderr: string;
  stop: () => void;
  waitForExit: () => Promise<number>;
  waitForLog: (pattern: RegExp, timeoutMs?: number) => Promise<string>;
  readMessages: () => Promise<string>;
  cleanup: () => Promise<void>;
};

let buildPromise: Promise<void> | null = null;

export async function startOpencodeProcess(
  options: OpencodeProcessOptions,
): Promise<OpencodeProcess> {
  await ensurePluginBuilt();

  const tempDir = await mkdtemp(join(tmpdir(), "yolo-opencode-"));
  const configDir = join(tempDir, "config");
  const workspaceDir = join(tempDir, "workspace");
  const logsDir = join(tempDir, "logs");
  const opencodePort = options.opencodePort ?? (await getAvailablePort());
  await mkdir(configDir, { recursive: true });
  await mkdir(workspaceDir, { recursive: true });
  await mkdir(logsDir, { recursive: true });

  await writePluginFixture(configDir);

  const stdoutLogPath = join(logsDir, "stdout.log");
  const stderrLogPath = join(logsDir, "stderr.log");
  const stdoutStream = createWriteStream(stdoutLogPath);
  const stderrStream = createWriteStream(stderrLogPath);

  let stdout = "";
  let stderr = "";

  const config: Record<string, unknown> = {
    model: "mock/agent-model",
    small_model: "mock/title-model",
    enabled_providers: ["mock"],
    share: "disabled",
    provider: {
      mock: {
        npm: "@ai-sdk/openai-compatible",
        name: "Mock",
        options: {
          baseURL: `${options.mockServerUrl}/v1`,
          apiKey: "test-key",
        },
        models: {
          "agent-model": {
            name: "Agent Model",
            limit: {
              context: 128000,
              output: 8192,
            },
          },
          "title-model": {
            name: "Title Model",
            limit: {
              context: 4096,
              output: 128,
            },
          },
        },
      },
    },
    ...(options.permission ? { permission: options.permission } : {}),
  };

  const childProcess = spawn(
    "opencode",
    ["serve", "--port", String(opencodePort), "--print-logs"],
    {
      cwd: workspaceDir,
      env: {
        ...process.env,
        OPENCODE_YOLO_ENABLE: "true",
        NO_COLOR: "1",
        OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
        OPENCODE_CONFIG_DIR: configDir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const stdoutHandle = childProcess.stdout ?? childProcess.stdio[1];
  const stderrHandle = childProcess.stderr ?? childProcess.stdio[2];

  stdoutHandle?.on("data", (chunk: Buffer | string) => {
    const text = chunk.toString();
    stdout += text;
    stdoutStream.write(text);
  });

  stderrHandle?.on("data", (chunk: Buffer | string) => {
    const text = chunk.toString();
    stderr += text;
    stderrStream.write(text);
  });

  const waitForExit = () =>
    new Promise<number>((resolveExit) => {
      childProcess.once("close", (code) => {
        stdoutStream.end();
        stderrStream.end();
        resolveExit(code ?? 0);
      });
    });

  await waitForLog(logsDir, /opencode server listening on /, 15000);

  const client = createOpencodeClient({
    baseUrl: `http://127.0.0.1:${opencodePort}`,
  });

  const sessionResponse = await client.session.create(
    {
      directory: workspaceDir,
    },
    { responseStyle: "data", throwOnError: true },
  );
  const session = "data" in sessionResponse ? sessionResponse.data : sessionResponse;

  await client.session.promptAsync(
    {
      sessionID: session.id,
      parts: [{ type: "text", text: options.prompt }],
    },
    { responseStyle: "data", throwOnError: true },
  );

  return {
    pid: childProcess.pid,
    sessionID: session.id,
    logsDir,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
    stop: () => {
      childProcess.kill("SIGTERM");
    },
    waitForExit,
    waitForLog: (pattern, timeoutMs = 15000) => waitForLog(logsDir, pattern, timeoutMs),
    readMessages: async () => {
      const messages = await client.session.messages(
        { sessionID: session.id, directory: workspaceDir },
        { responseStyle: "data", throwOnError: true },
      );
      return JSON.stringify(messages);
    },
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function writePluginFixture(configDir: string): Promise<void> {
  const pluginsDir = join(configDir, "plugins");
  await mkdir(pluginsDir, { recursive: true });

  const pluginPath = join(pluginsDir, "yolo.ts");
  const distPath = resolve(
    "/Users/tomoya/.ghq/github.com/tomoasleep/opencode-yolo/dist/index.js",
  ).replaceAll("\\", "\\\\");

  const contents = `import YoloPlugin from ${JSON.stringify(distPath)};

export default async (context) => {
  console.log(\`[yolo:e2e] serverUrl \${context.serverUrl}\`)
  console.log("[yolo:e2e] plugin loaded")
  return await YoloPlugin(context)
}
`;

  await writeFile(pluginPath, contents);
  await chmod(pluginPath, 0o644);
}

async function waitForLog(logsDir: string, pattern: RegExp, timeoutMs: number): Promise<string> {
  const stdoutLogPath = join(logsDir, "stdout.log");
  const stderrLogPath = join(logsDir, "stderr.log");
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const output = `${await readLog(stdoutLogPath)}\n${await readLog(stderrLogPath)}`;
    const match = output.match(pattern);
    if (match) {
      return match[0];
    }

    await delay(100);
  }

  throw new Error(`Timed out waiting for log ${pattern} in ${logsDir}`);
}

async function readLog(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function ensurePluginBuilt(): Promise<void> {
  if (!buildPromise) {
    buildPromise = runBuild().catch((error) => {
      buildPromise = null;
      throw error;
    });
  }

  await buildPromise;
}

async function runBuild(): Promise<void> {
  const result = spawnSync("bun", ["run", "build"], {
    cwd: "/Users/tomoya/.ghq/github.com/tomoasleep/opencode-yolo",
    encoding: "utf8",
  });

  if (result.status === 0) {
    return;
  }

  throw new Error(result.stderr || `bun run build failed with code ${result.status ?? -1}`);
}

async function getAvailablePort(): Promise<number> {
  return await new Promise<number>((resolvePort, rejectPort) => {
    const server = createServer();

    server.once("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        server.close();
        rejectPort(new Error("Failed to determine available port"));
        return;
      }

      server.close((error) => {
        if (error) {
          rejectPort(error);
          return;
        }

        resolvePort(address.port);
      });
    });
  });
}
