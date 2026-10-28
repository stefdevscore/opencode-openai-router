import type { Plugin } from "@opencode/plugin/promise/plugin";
import { ControlStore, fileControlReader, userConfigPath } from "./controls/index.js";

/** Controls are available now; no routing hook is registered until the adapter is proven. */
const plugin: Plugin = {
  id: "opencode.openai-router",
  setup: async ctx => {
    const controls = new ControlStore(fileControlReader(userConfigPath()));
    const report = (state: ReturnType<ControlStore["snapshot"]>) => {
      console.error(JSON.stringify({ component: "opencode.openai-router", event: "controls", ...state, routing: "inactive" }));
    };
    const state = await controls.refresh();
    if (state.status !== "ready") report(state);
    let registration;
    try {
      registration = await ctx.command.transform(editor => editor.add({
        name: "openai-router-status",
        description: "Refresh and report OpenAI router controls to the server log",
        execute: async () => { report(await controls.refresh()); },
      }));
    } catch (error) {
      controls.dispose();
      throw error;
    }
    return async () => { controls.dispose(); await registration.dispose(); };
  },
};

export default plugin;
