import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import plugin from "../dist/index.js";
import localEntry from "../server.js";

test("v2 entry registers inspection and disposes it without routing hooks", async () => {
  assert.equal(plugin.id, "opencode.openai-router");
  assert.equal(localEntry, plugin);
  const commands = [];
  let disposed = false;
  const root = await mkdtemp(path.join(os.tmpdir(), "router-plugin-test-"));
  const previous = process.env.XDG_CONFIG_HOME;
  const log = console.error;
  const reports = [];
  process.env.XDG_CONFIG_HOME = root;
  console.error = value => reports.push(JSON.parse(value));
  try {
    const cleanup = await plugin.setup({ command: { transform: async callback => { callback({ add: command => commands.push(command) }); return { dispose: async () => { disposed = true; } }; } } });
    assert.deepEqual(commands.map(command => command.name), ["openai-router-status"]);
    await mkdir(path.join(root, "opencode-openai-router"));
    await writeFile(path.join(root, "opencode-openai-router", "config.json"), '{"mode":"off"}');
    await commands[0].execute({});
    assert.equal(reports[0].config.mode, "off");
    assert.equal(reports[0].routing, "inactive");
    await cleanup();
    assert.equal(disposed, true);
    assert.equal("server" in plugin, false);
  } finally {
    console.error = log;
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = previous;
    await rm(root, { recursive: true, force: true });
  }
});
