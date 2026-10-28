import type { Plugin } from "@opencode/plugin/promise/plugin";
import { ControlStore, fileControlReader, userConfigPath } from "./controls/index.js";
import { RouterRpc } from "./rpc.js";

/** Controls are available now; no routing hook is registered until the adapter is proven. */
const plugin: Plugin = {
  id: "openai-router",
  setup: async ctx => {
    const controls = new ControlStore(fileControlReader(userConfigPath()));
    const report = (state: ReturnType<ControlStore["snapshot"]>) => {
      console.error(JSON.stringify({ component: "openai-router", event: "controls", ...state, routing: "inactive" }));
    };
    const state = await controls.refresh();
    if (state.status !== "ready") report(state);
    let registration;
    try {
      registration = await ctx.rpc.register(RouterRpc, {
        status: async () => {
          const current = await controls.refresh();
          return { status: current.status, mode: current.status === "ready" ? current.config?.mode ?? null : null, profile: current.status === "ready" ? current.config?.profile ?? null : null, generation: current.generation, routing: "inactive" };
        },
      });
    } catch (error) {
      controls.dispose();
      throw error;
    }
    return async () => { controls.dispose(); await registration.dispose(); };
  },
};

export default plugin;
