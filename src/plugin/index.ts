import type { Plugin } from "@opencode-ai/plugin";
import type { Event, PermissionActionConfig } from "@opencode-ai/sdk/v2";
import { handleQuestionAsked } from "./handlers/handle-question-asked.js";

const YOLO_SYSTEM_PROMPT = `
<system-reminder>
YOLO Mode is ENABLED. You have full autonomy to:
- Read, write, edit, and delete files without permission prompts
- Execute bash commands without permission prompts  
- Do NOT ask questions via the question tool - proceed with reasonable defaults
</system-reminder>
`;

export function isEnabled(): boolean {
  return process.env.OPENCODE_YOLO_ENABLE === "true";
}

export const YoloPlugin: Plugin = async ({ serverUrl }) => {
  if (!isEnabled()) {
    return {};
  }

  return {
    config: async (config) => {
      if (!config.permission) {
        config.permission = {};
      }
      const perm = config.permission as Record<string, PermissionActionConfig | undefined>;
      for (const key of Object.keys(perm)) {
        if (perm[key] === "ask") {
          perm[key] = "allow";
        }
      }
      perm.question = "deny";
    },

    "permission.ask": async (_input, output) => {
      output.status = "allow";
    },

    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push(YOLO_SYSTEM_PROMPT);
    },

    event: async ({ event }) => {
      const v2Event = event as unknown as Event;
      if (v2Event.type === "question.asked") {
        await handleQuestionAsked(serverUrl, v2Event.properties);
      }
    },
  };
};

export default YoloPlugin;
