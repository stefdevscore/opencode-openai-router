import assert from "node:assert/strict";
import test from "node:test";
import gui from "../dist/gui.js";

test("desktop status reads the session's server and displays an inference-free result", async () => {
  let command;
  let calls = 0;
  const alerts = [];
  const signal = new AbortController().signal;
  const location = { directory: "/fixture" };
  const session = { location, pending: false, server: { client: { rpc: () => ({ status: async (input, options) => { calls++; assert.deepEqual(input, {}); assert.deepEqual(options, { location, signal }); return { status: "ready", mode: "off", profile: "quality", routing: "inactive" }; } }) } } };
  gui.setup({ signal, sessions: { current: () => session }, dialogs: { alert: async value => alerts.push(value) }, add: (_registry, get) => { command = get(); } });
  assert.equal(command.title, "OpenAI router: Show status");
  assert.equal(command.slash, undefined);
  await command.run();
  assert.equal(calls, 1);
  assert.match(alerts[0].description, /Mode: off/);
  assert.match(alerts[0].description, /Profile: quality/);
  assert.match(alerts[0].description, /inactive/);
});

test("desktop status handles missing session and unavailable server without leaking errors", async () => {
  let command;
  let session;
  const alerts = [];
  const signal = new AbortController().signal;
  gui.setup({ signal, sessions: { current: () => session }, dialogs: { alert: async value => alerts.push(value) }, add: (_registry, get) => { command = get(); } });
  await command.run();
  assert.match(alerts[0].description, /Open a session/);
  session = { location: { directory: "/fixture" }, pending: false, server: { client: { rpc: () => ({ status: async () => { throw new Error("private"); } }) } } };
  await command.run();
  assert.match(alerts[1].description, /unavailable/);
  assert.ok(!JSON.stringify(alerts).includes("private"));
});

test("a late status result is not displayed for a different session", async () => {
  let command;
  let finish;
  const response = new Promise(resolve => { finish = resolve; });
  const alerts = [];
  let session = { key: "first", location: { directory: "/first" }, pending: false, server: { client: { rpc: () => ({ status: () => response }) } } };
  gui.setup({ signal: new AbortController().signal, sessions: { current: () => session }, dialogs: { alert: async value => alerts.push(value) }, add: (_registry, get) => { command = get(); } });
  const pending = command.run();
  session = { ...session, key: "second" };
  finish({ status: "ready", mode: "auto", profile: "balanced", routing: "inactive" });
  await pending;
  assert.deepEqual(alerts, []);
});
