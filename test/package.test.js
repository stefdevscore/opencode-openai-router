import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

test("packed plugin includes and loads the local and package entries", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "router-package-test-"));
  const previous = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = temp;
  try {
    const [archive] = JSON.parse(execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", temp], { encoding: "utf8" }));
    const paths = new Set(archive.files.map(file => file.path));
    for (const entry of ["package.json", "server.js", "dist/index.js", "dist/gui-experimental.cjs", "dist/evidence/store.js", "dist/evidence/discovery.js", "dist/evidence/usage.js"]) assert.ok(paths.has(entry), `package missing ${entry}`);
    execFileSync("tar", ["-xzf", path.join(temp, archive.filename), "-C", temp]);
    const root = path.join(temp, "package");
    const metadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    assert.equal(metadata.exports["."], "./dist/index.js");
    assert.equal(metadata.exports["./gui-experimental"], "./dist/gui-experimental.cjs");
    const local = await import(pathToFileURL(path.join(root, "server.js")).href);
    const exported = await import(pathToFileURL(path.join(root, metadata.exports["."])).href);
    assert.equal(local.default, exported.default);
    assert.equal(local.default.id, "openai-router");
    const { EvidenceStore } = await import(pathToFileURL(path.join(root, "dist/evidence/store.js")).href);
    const evidence = new EvidenceStore(path.join(temp, "evidence.sqlite"));
    try {
      assert.deepEqual(evidence.observe({ complete: true, modelIDs: ["base"] }), []);
      const added = evidence.observe({ complete: true, modelIDs: ["base", "new"] });
      assert.equal(evidence.reserve(added, 100, 1).allowed, true);
    } finally { evidence.close(); }
    const cleanup = await local.default.setup({ rpc: { register: async () => ({ dispose: async () => {} }) } });
    assert.equal(typeof cleanup, "function");
    await cleanup();
  } finally {
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = previous;
    await rm(temp, { recursive: true, force: true });
  }
});
