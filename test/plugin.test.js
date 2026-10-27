import assert from "node:assert/strict";
import test from "node:test";
import plugin, { OpenAIRouterPlugin } from "../dist/index.js";

test("plugin initializes without changing OpenCode behavior", async () => {
  const hooks = await OpenAIRouterPlugin({});

  assert.deepEqual(hooks, {});
});

test("v2 entry initializes without registering hooks", async () => {
  assert.equal(plugin.id, "opencode.openai-router");
  assert.equal(plugin.server, OpenAIRouterPlugin);
  assert.equal(await plugin.setup({}), undefined);
});
