import assert from "node:assert/strict";
import test from "node:test";
import gui from "../dist/gui.js";

test('evidence inspection displays status and usage limits without generation', async () => {
  const commands = [], alerts = []; let calls = 0;
  const session = { key: 'evidence', location: { directory: '/fixture' }, pending: false, server: { client: { rpc: () => ({ evidence: async () => { calls++; return { status: 'inactive', pending: 1, completed: 2, unknown: 0, notices: [] }; } }) } } };
  gui.setup({ signal: new AbortController().signal, sessions: { current: () => session }, dialogs: { select: async options => { assert.match(options.options[0].description, /Pending: 1/); return 'summary'; }, alert: async value => alerts.push(value) }, add: (_registry, get) => commands.push(get()) });
  await commands.find(item => item.id === 'evidence').run();
  assert.equal(calls, 1); assert.match(alerts[0].description, /classification is inactive/); assert.match(alerts[0].description, /allowance: unavailable/);
});

test("desktop status reads the session's server and displays an inference-free result", async () => {
  let command;
  let calls = 0;
  const alerts = [];
  const signal = new AbortController().signal;
  const location = { directory: "/fixture" };
  const session = { location, pending: false, server: { client: { rpc: () => ({ status: async (input, options) => { calls++; assert.deepEqual(input, {}); assert.deepEqual(options, { location, signal }); return { status: "ready", mode: "off", profile: "quality", routing: "inactive" }; } }) } } };
  gui.setup({ signal, sessions: { current: () => session }, dialogs: { alert: async value => alerts.push(value) }, add: (_registry, get) => { const item = get(); if (item.id === "status") command = item; } });
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
  gui.setup({ signal, sessions: { current: () => session }, dialogs: { alert: async value => alerts.push(value) }, add: (_registry, get) => { const item = get(); if (item.id === "status") command = item; } });
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
  gui.setup({ signal: new AbortController().signal, sessions: { current: () => session }, dialogs: { alert: async value => alerts.push(value) }, add: (_registry, get) => { const item = get(); if (item.id === "status") command = item; } });
  const pending = command.run();
  session = { ...session, key: "second" };
  finish({ status: "ready", mode: "auto", profile: "balanced", routing: "inactive" });
  await pending;
  assert.deepEqual(alerts, []);
});

test('catalog command shows current models without a coding prompt', async () => {
  const commands = []; const alerts = []; const signal = new AbortController().signal;
  const session = { key: 's', location: { directory: '/fixture' }, pending: false, server: { client: { rpc: () => ({ catalog: async () => ({ status: 'ready', hostAvailable: true, connected: true, complete: true, fresh: true, truncated: false, models: [{ id: 'example', context: 1000, tools: true, input: ['text'], variants: ['high'] }] }) }) } } };
  gui.setup({ signal, sessions: { current: () => session }, dialogs: { select: async value => { assert.equal(value.options[1].title, 'example'); assert.match(value.options[1].description, /1,000/); return '0'; }, alert: async value => alerts.push(value) }, add: (_registry, get) => commands.push(get()) });
  await commands.find(c => c.id === 'catalog').run();
  assert.equal(alerts[0].title, 'example'); assert.match(alerts[0].description, /high/);
});
