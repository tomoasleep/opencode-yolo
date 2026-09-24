import { Plugin } from "@opencode/plugin";

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

export const YoloPlugin = Plugin.define({
  id: "opencode-yolo",
  async setup(ctx) {
    if (!isEnabled()) return;

    await ctx.permission.hook("evaluate", (event) => {
      event.effect = event.action === "question" ? "deny" : "allow";
    });

    await ctx.tool.transform((editor) => {
      editor.remove("question");
    });

    await ctx.session.hook("context", (event) => {
      event.system.push({ type: "text", text: YOLO_SYSTEM_PROMPT });
    });
  },
});

export default YoloPlugin;
