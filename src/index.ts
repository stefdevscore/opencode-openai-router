import type { Plugin } from "@opencode-ai/plugin";
import type { Plugin as V2Plugin } from "@opencode/plugin/promise/plugin";

/** A deliberately inert starting point for the OpenAI router. */
export const OpenAIRouterPlugin: Plugin = async () => {
  return {};
};

/** Dual-format entry point; both integrations are intentionally non-mutating. */
const plugin: V2Plugin & { server: Plugin } = {
  id: "opencode.openai-router",
  setup: async () => {},
  server: OpenAIRouterPlugin,
};

export default plugin;
