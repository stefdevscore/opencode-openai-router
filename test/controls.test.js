import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ControlStore, fileControlReader, userConfigPath } from "../dist/controls/index.js";
const permitted = async (controls, generation) => (await controls.issue(generation, () => Promise.resolve())).issued;

test("user config path ignores project options and relative XDG paths", () => {
  assert.equal(userConfigPath({ XDG_CONFIG_HOME: "/user/config" }, "/home/user"), "/user/config/opencode-openai-router/config.json");
  assert.equal(userConfigPath({ XDG_CONFIG_HOME: "relative" }, "/home/user"), "/home/user/.config/opencode-openai-router/config.json");
});

test("file controls reload, fail closed, retain valid state and recover without modifying files", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "router-controls-"));
  const file = path.join(dir, "config.json");
  const controls = new ControlStore(fileControlReader(file));
  try {
    const initial = await controls.refresh();
    assert.deepEqual(initial.config, { mode: "auto", profile: "balanced" });
    assert.equal(initial.status, "ready");
    assert.equal(await permitted(controls, initial.generation), true);
    assert.equal((await controls.refresh()).generation, initial.generation);
    await writeFile(file, JSON.stringify({ mode: "off", profile: "quality" }));
    assert.equal(await permitted(controls, initial.generation), false);
    const disabled = controls.snapshot();
    assert.equal(disabled.config.mode, "off");
    assert.equal(await permitted(controls, disabled.generation), false);
    await writeFile(file, '{"mode":null}');
    const invalid = await controls.refresh();
    assert.equal(invalid.status, "invalid_config");
    assert.deepEqual(invalid.config, disabled.config);
    assert.equal(await readFile(file, "utf8"), '{"mode":null}');
    assert.equal(await permitted(controls, invalid.generation), false);
    await writeFile(file, "{ broken");
    assert.equal((await controls.refresh()).status, "invalid_config");
    await writeFile(file, JSON.stringify({ mode: "auto", profile: "economy" }));
    const recovered = await controls.refresh();
    assert.equal(recovered.status, "ready");
    assert.ok(recovered.generation > invalid.generation);
    assert.equal(await permitted(controls, recovered.generation), true);
    const next = new ControlStore(fileControlReader(file));
    assert.deepEqual((await next.refresh()).config, recovered.config);
    next.dispose();
    await writeFile(file, "x".repeat(65537));
    assert.equal((await controls.refresh()).status, "invalid_config");
    await rm(file);
    assert.equal((await controls.refresh()).status, "unreadable_config");
    assert.equal(await permitted(controls, recovered.generation), false);
    await mkdir(file);
    assert.equal((await controls.refresh()).status, "invalid_config");
  } finally {
    controls.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});

test("reads serialize; uncertain reads and disposal invalidate pending decisions", async () => {
  let release;
  const slow = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const controls = new ControlStore(async () => {
    calls++;
    if (calls === 1) return { status: "ready", config: { mode: "auto", profile: "balanced" } };
    if (calls === 2) { await slow; return { status: "ready", config: { mode: "off", profile: "balanced" } }; }
    throw new Error("private host details");
  });
  const initial = await controls.refresh();
  const pending = controls.refresh();
  const check = permitted(controls, initial.generation);
  release();
  assert.equal((await pending).config.mode, "off");
  assert.equal(await check, false);
  assert.equal(controls.snapshot().status, "unreadable_config");
  assert.equal(controls.snapshot().config.mode, "off");
  assert.ok(!JSON.stringify(controls.snapshot()).includes("private host details"));
  controls.dispose();
  assert.equal((await controls.refresh()).status, "disposed");
  assert.equal(await permitted(controls, initial.generation), false);
});

test("dangling leaf and parent symlinks fail closed on startup", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "router-link-test-"));
  try {
    const missing = path.join(root, "missing");
    const leaf = path.join(root, "config.json");
    await symlink(missing, leaf);
    const read = fileControlReader(leaf);
    assert.equal((await read()).status, "unreadable_config");
    await rm(leaf);
    assert.equal((await read()).status, "unreadable_config");
    await writeFile(leaf, '{"mode":"off"}');
    assert.equal((await read()).config.mode, "off");
    const parent = path.join(root, "parent");
    await symlink(missing, parent);
    assert.equal((await fileControlReader(path.join(parent, "config.json"))()).status, "unreadable_config");
    assert.equal((await fileControlReader(path.join(root, "absent", "config.json"))()).status, "ready");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("disable and disposal serialize with issuance, not operation completion", async () => {
  let mode = "auto";
  let starts = 0;
  let complete;
  const delayed = new Promise(resolve => { complete = resolve; });
  const controls = new ControlStore(async () => ({ status: "ready", config: { mode, profile: "balanced" } }));
  const initial = await controls.refresh();
  mode = "off";
  const disable = controls.refresh();
  const stale = controls.issue(initial.generation, () => { starts++; return delayed; });
  assert.equal((await disable).config.mode, "off");
  assert.equal((await stale).issued, false);
  assert.equal(starts, 0);

  mode = "auto";
  const enabled = await controls.refresh();
  const issued = await controls.issue(enabled.generation, () => { starts++; return delayed; });
  assert.equal(issued.issued, true);
  mode = "off";
  assert.equal((await controls.refresh()).config.mode, "off");
  complete("finished");
  assert.equal(await issued.completion, "finished");
  assert.equal(starts, 1);

  mode = "auto";
  const enabledAgain = await controls.refresh();
  const pending = controls.issue(enabledAgain.generation, () => { starts++; return Promise.resolve(); });
  controls.dispose();
  assert.equal((await pending).issued, false);
  assert.equal(starts, 1);
});

test("late reads cannot revive a disposed instance", async () => {
  let release;
  let started;
  const began = new Promise(resolve => { started = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  const controls = new ControlStore(async () => { started(); await wait; return { status: "ready", config: { mode: "auto", profile: "quality" } }; });
  const pending = controls.refresh();
  await began;
  controls.dispose();
  release();
  assert.equal((await pending).status, "disposed");
  assert.equal(controls.snapshot().config, null);
});
