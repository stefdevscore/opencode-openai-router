import type { Plugin } from "@opencode/plugin/promise/plugin";

/** The v2 host entry stays inert until the automatic adapter is implemented. */
const plugin: Plugin = {
  id: "opencode.openai-router",
  setup: async () => {},
};

export default plugin;
