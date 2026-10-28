import { Command, Plugin } from "@opencode/plugin/gui";
import { RouterRpc } from "./rpc.js";

type Status = { status: string; mode: string | null; profile: string | null; routing: string };
type CatalogView = { status: string; hostAvailable: boolean | null; connected: boolean | null; complete: boolean | null; fresh: boolean; truncated: boolean; models: { id: string; context: number | null; tools: boolean | null; input: string[] | null; variants: string[] | null }[] };

export default Plugin.define({
  setup(ctx) {
    ctx.add(Command, () => ({
      id: "status",
      title: "OpenAI router: Show status",
      description: "Refresh and inspect the router controls",
      run: async () => {
        const session = ctx.sessions.current();
        if (!session?.location || session.pending) {
          await ctx.dialogs.alert({ title: "OpenAI router status", description: "Open a session first to inspect its router controls." });
          return;
        }
        try {
          const value = await session.server.client.rpc(RouterRpc).status({}, { location: session.location, signal: ctx.signal }) as Status;
          if (ctx.signal.aborted || ctx.sessions.current()?.key !== session.key) return;
          const description = value.status === "ready"
            ? `Mode: ${value.mode}\nProfile: ${value.profile}\nAutomatic routing: inactive (under development)`
            : `Settings: ${value.status}\nAutomatic routing: inactive (under development)`;
          await ctx.dialogs.alert({ title: "OpenAI router status", description });
        } catch {
          if (!ctx.signal.aborted && ctx.sessions.current()?.key === session.key) await ctx.dialogs.alert({ title: "OpenAI router status", description: "Router status is unavailable for this session." });
        }
      },
    }));
    ctx.add(Command, () => ({
      id: "catalog",
      title: "OpenAI router: Show model catalog",
      description: "Inspect discovered OpenAI models and variants",
      run: async () => {
        const session = ctx.sessions.current();
        if (!session?.location || session.pending) {
          await ctx.dialogs.alert({ title: "OpenAI router catalog", description: "Open a session first to inspect its model catalog." });
          return;
        }
        try {
          const value = await session.server.client.rpc(RouterRpc).catalog({}, { location: session.location, signal: ctx.signal }) as CatalogView;
          if (ctx.signal.aborted || ctx.sessions.current()?.key !== session.key) return;
          const availability = value.hostAvailable === null ? "unknown" : value.hostAvailable ? "available" : "unavailable";
          const connection = value.connected === null ? "unknown" : value.connected ? "connected" : "not connected";
          const summary = `Provider ${availability} · ${connection} · ${value.fresh ? "fresh" : "not eligible for routing"}${value.complete === false ? " · incomplete" : ""}${value.truncated ? " · list truncated" : ""}`;
          const selected = await ctx.dialogs.select({
            title: "OpenAI router catalog",
            placeholder: "Search models",
            options: [
              { title: "Catalog status", description: summary, value: "__router_catalog_status__", group: "Overview" },
              ...value.models.map((model, index) => ({
                title: model.id,
                description: `Context: ${model.context?.toLocaleString("en-US") ?? "unknown"} · Tools: ${model.tools === null ? "unknown" : model.tools ? "yes" : "no"} · Input: ${model.input?.join(", ") || "unknown"}`,
                value: String(index),
                group: "Models",
              })),
            ],
          });
          if (selected === undefined || ctx.signal.aborted || ctx.sessions.current()?.key !== session.key) return;
          if (selected === "__router_catalog_status__") {
            await ctx.dialogs.alert({ title: "Catalog status", description: `${summary}. Availability does not prove account entitlement. Automatic routing is inactive.` });
            return;
          }
          const model = value.models[Number(selected)];
          if (!model) return;
          const variants = model.variants === null ? "unknown" : model.variants.length ? model.variants.join(", ") : "none";
          await ctx.dialogs.alert({ title: model.id, description: `Context: ${model.context?.toLocaleString("en-US") ?? "unknown"}. Tools: ${model.tools === null ? "unknown" : model.tools ? "yes" : "no"}. Input: ${model.input?.join(", ") || "unknown"}. Variants: ${variants}.` });
        } catch {
          if (!ctx.signal.aborted && ctx.sessions.current()?.key === session.key) await ctx.dialogs.alert({ title: "OpenAI router catalog", description: "Catalog is unavailable for this session." });
        }
      },
    }));
  },
});
