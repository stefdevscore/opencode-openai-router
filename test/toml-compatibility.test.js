import assert from "node:assert/strict";
import test from "node:test";
import { Effect, FileSystem, Path } from "effect";
import { Primitive } from "effect/unstable/cli";

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
