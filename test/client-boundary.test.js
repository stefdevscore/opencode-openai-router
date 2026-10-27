import assert from "node:assert/strict";
import test from "node:test";
import { isTestedStandaloneRun } from "../dist/host/client-boundary.js";

test("candidate client boundary only admits the tested standalone run shape", () => {
  assert.equal(isTestedStandaloneRun("1.19.4", ["bun", "opencode", "run", "make a change"]), true);
  for (const argv of [
    ["bun", "opencode", "serve", "run"],
    ["bun", "opencode", "run", "--attach", "http://localhost"],
    ["bun", "opencode", "run", "--attach=http://localhost"],
    ["bun", "opencode", "run", "--interactive"],
    ["bun", "opencode", "run", "--interactive=true"],
    ["bun", "opencode", "run", "-i"],
    ["bun", "opencode", "run", "--mini"],
    ["bun", "opencode", "run", "--command", "review"],
    ["bun", "opencode", "run", "--command=review"],
    ["bun", "opencode"],
  ]) assert.equal(isTestedStandaloneRun("1.19.4", argv), false);
  assert.equal(isTestedStandaloneRun("1.3.13", ["bun", "opencode", "run"]), false);
  assert.equal(isTestedStandaloneRun(undefined, ["bun", "opencode", "run"]), false);
});
