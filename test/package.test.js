import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

test("packed plugin includes and loads the local and package entries", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "router-package-test-"));
  try {
    const [archive] = JSON.parse(execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", temp], { encoding: "utf8" }));
    const paths = new Set(archive.files.map(file => file.path));
    for (const entry of ["package.json", "server.js", "dist/index.js"]) assert.ok(paths.has(entry), `package missing ${entry}`);
    execFileSync("tar", ["-xzf", path.join(temp, archive.filename), "-C", temp]);
    const root = path.join(temp, "package");
    const metadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    assert.equal(metadata.exports, "./dist/index.js");
    const local = await import(pathToFileURL(path.join(root, "server.js")).href);
    const exported = await import(pathToFileURL(path.join(root, metadata.exports)).href);
    assert.equal(local.default, exported.default);
    assert.equal(local.default.id, "opencode.openai-router");
    assert.equal(await local.default.setup({}), undefined);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
