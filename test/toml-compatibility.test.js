import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Follow the plugin's dependency graph, including when npm nests its dependencies.
const pluginRequire = createRequire(import.meta.resolve("@opencode-ai/plugin"));
const { Effect, FileSystem, Path } = await import(pathToFileURL(pluginRequire.resolve("effect")).href);
const { Primitive } = await import(pathToFileURL(pluginRequire.resolve("effect/unstable/cli")).href);

function parseToml(content) {
  const fs = FileSystem.makeNoop({
    exists: () => Effect.succeed(true),
    stat: () => Effect.succeed({ type: "File" }),
    readFileString: () => Effect.succeed(content),
  });

  return Effect.runPromise(
    Primitive.fileParse().parse("/config.toml").pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provide(Path.layer),
    ),
  );
}

test("Effect's file parser reads TOML using the patched dependency", async () => {
  const config = await parseToml(`
title = "router"
enabled = true
levels = [1, 2, 3]
[model]
name = "example"
`);

  assert.equal(Object.getPrototypeOf(config), null);
  assert.equal(Object.getPrototypeOf(config.model), null);
  assert.deepEqual(JSON.parse(JSON.stringify(config)), {
    title: "router",
    enabled: true,
    levels: [1, 2, 3],
    model: { name: "example" },
  });
  await assert.rejects(parseToml("title = ["), /Failed to parse.*toml/);
});
