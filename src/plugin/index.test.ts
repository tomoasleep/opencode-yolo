import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import YoloPlugin, { isEnabled } from "./index.js";

describe("isEnabled", () => {
  let originalValue: string | undefined;

  beforeEach(() => {
    originalValue = process.env.OPENCODE_YOLO_ENABLE;
  });

  afterEach(() => {
    if (originalValue !== undefined) {
      process.env.OPENCODE_YOLO_ENABLE = originalValue;
    } else {
      delete process.env.OPENCODE_YOLO_ENABLE;
    }
  });

  test("returns false when OPENCODE_YOLO_ENABLE is not set", () => {
    delete process.env.OPENCODE_YOLO_ENABLE;
    expect(isEnabled()).toBe(false);
  });

  test("returns true when OPENCODE_YOLO_ENABLE is 'true'", () => {
    process.env.OPENCODE_YOLO_ENABLE = "true";
    expect(isEnabled()).toBe(true);
  });

  test("returns false when OPENCODE_YOLO_ENABLE is 'false'", () => {
    process.env.OPENCODE_YOLO_ENABLE = "false";
    expect(isEnabled()).toBe(false);
  });
});

describe("YoloPlugin", () => {
  let originalValue: string | undefined;

  beforeEach(() => {
    originalValue = process.env.OPENCODE_YOLO_ENABLE;
    process.env.OPENCODE_YOLO_ENABLE = "true";
  });

  afterEach(() => {
    if (originalValue !== undefined) {
      process.env.OPENCODE_YOLO_ENABLE = originalValue;
    } else {
      delete process.env.OPENCODE_YOLO_ENABLE;
    }
  });

  test("allows permissions, removes the question tool, and adds the YOLO prompt", async () => {
    type PermissionEvent = { action: string; effect: string };
    type ContextEvent = { system: { type: string; text: string }[] };
    const removedTools: string[] = [];
    const hooks: {
      permission?: (event: PermissionEvent) => void;
      context?: (event: ContextEvent) => void;
    } = {};
    const context = {
      tool: {
        transform: async (transform: (editor: { remove: (id: string) => void }) => void) => {
          transform({ remove: (id) => removedTools.push(id) });
        },
      },
      permission: {
        hook: async (_name: string, callback: (event: PermissionEvent) => void) => {
          hooks.permission = callback;
        },
      },
      session: {
        hook: async (_name: string, callback: (event: ContextEvent) => void) => {
          hooks.context = callback;
        },
      },
    };

    await YoloPlugin.setup(context as unknown as Parameters<typeof YoloPlugin.setup>[0]);

    expect(removedTools).toEqual(["question"]);
    const permission = { action: "edit", effect: "ask" };
    hooks.permission?.(permission);
    expect(permission.effect).toBe("allow");
    const questionPermission = { action: "question", effect: "ask" };
    hooks.permission?.(questionPermission);
    expect(questionPermission.effect).toBe("deny");
    const request = { system: [] as { type: string; text: string }[] };
    hooks.context?.(request);
    expect(request.system.some((part) => part.text.includes("YOLO Mode is ENABLED"))).toBe(true);
  });

  test("does not register hooks when disabled", async () => {
    process.env.OPENCODE_YOLO_ENABLE = "false";
    const hooks: string[] = [];
    const context = {
      tool: { transform: async () => hooks.push("tool") },
      permission: { hook: async () => hooks.push("permission") },
      session: { hook: async () => hooks.push("session") },
    };

    await YoloPlugin.setup(context as unknown as Parameters<typeof YoloPlugin.setup>[0]);

    expect(hooks).toEqual([]);
  });
});
