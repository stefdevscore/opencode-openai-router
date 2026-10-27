import assert from "node:assert/strict";
import test from "node:test";
import { OpenAIRouterPlugin } from "../dist/index.js";

test("plugin initializes without changing OpenCode behavior", async () => {
  const hooks = await OpenAIRouterPlugin({});

  assert.deepEqual(hooks, {});
});
