import type { Plugin } from "@opencode/plugin/promise/plugin";
import { ControlStore, fileControlReader, userConfigPath } from "./controls/index.js";
import { RouterRpc } from "./rpc.js";
import { CatalogStore } from "./catalog/store.js";

/** Controls are available now; no routing hook is registered until the adapter is proven. */
const plugin: Plugin = {
  id: "openai-router",
  setup: async ctx => {
    const controls = new ControlStore(fileControlReader(userConfigPath()));
    const catalog = new CatalogStore({
      providers: () => ctx.provider.list(),
      models: () => ctx.model.list(),
      connected: async id => {
        const connection = await ctx.integration.connection.active(id);
        return connection !== undefined && connection.status === undefined;
      },
    });
    const listener = new AbortController();
    void (async () => {
      try {
        for await (const _event of ctx.event.subscribe({ types: ["provider.updated", "model.updated", "integration.updated", "credential.updated", "credential.switched", "config.updated"], signal: listener.signal })) catalog.invalidate();
      } catch { /* Treat a failed stream like a clean but unexpected end. */ }
      finally { if (!listener.signal.aborted) catalog.monitoringLost(); }
    })();
    void catalog.refresh();
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
        catalog: async () => {
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const state = await Promise.race([catalog.refresh(), new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 3000); })]);
            if (!state) return { status: "unavailable" as const, hostAvailable: null, connected: null, complete: null, fresh: false, models: [], truncated: false };
            const available = state.catalog?.status === "available" ? state.catalog : null;
            const models = available?.models ?? [];
            return { status: state.status, hostAvailable: state.hostAvailable, connected: state.connected, complete: available?.complete ?? null, fresh: catalog.fresh(), models: models.slice(0, 100).map(model => ({ id: model.id, context: model.contextLimit, tools: model.toolCalls, input: model.inputModalities ?? null, variants: model.variants?.map(item => item.name) ?? null })), truncated: models.length > 100 };
          } finally { if (timer) clearTimeout(timer); }
        },
      });
    } catch (error) {
      controls.dispose();
      listener.abort(); catalog.dispose();
      throw error;
    }
    return async () => { listener.abort(); catalog.dispose(); controls.dispose(); await registration.dispose(); };
  },
};

export default plugin;
