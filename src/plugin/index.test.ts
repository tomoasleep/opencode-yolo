import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { isEnabled } from "./index.js";

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
