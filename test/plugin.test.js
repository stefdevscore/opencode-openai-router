import assert from "node:assert/strict";
import test from "node:test";
import plugin from "../dist/index.js";
import localEntry from "../server.js";

test("v2 entry initializes without registering hooks", async () => {
  assert.equal(plugin.id, "opencode.openai-router");
  assert.equal(localEntry, plugin);
  assert.equal(await plugin.setup({}), undefined);
  assert.equal("server" in plugin, false);
});
