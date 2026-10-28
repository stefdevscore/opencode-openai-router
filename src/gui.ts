import { Command, Plugin } from "@opencode/plugin/gui";
import { RouterRpc } from "./rpc.js";

type Status = { status: string; mode: string | null; profile: string | null; routing: string };

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
  },
});
