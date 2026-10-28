// Isolated investigation only: tests the adapter with synthetic trusted evidence and deliberately overrides a CLI selection.
// Usage: node scripts/probe-v2-host-adapter.mjs /absolute/path/to/opencode
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const binary = process.argv[2];
assert.ok(binary && path.isAbsolute(binary), "Provide an absolute OpenCode binary path");
const scenario = process.argv[3] ?? "model";
assert.ok(["model", "variant", "off"].includes(scenario), "Use model, variant or off");
const variant = scenario === "variant";
const root = await mkdtemp(path.join(os.tmpdir(), "openai-router-v2-probe-"));
const requests = [];
const provider = http.createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw || "{}");
  requests.push({ model: body.model, reasoningEffort: body.reasoning_effort ?? null });
  const message = { role: "assistant", content: "probe-v2-ok" };
  if (body.stream) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    for (const choice of [
      { index: 0, delta: message, finish_reason: null },
      { index: 0, delta: {}, finish_reason: "stop" },
    ]) response.write(`data: ${JSON.stringify({ id: "probe", object: "chat.completion.chunk", created: 0, model: body.model, choices: [choice] })}\n\n`);
    response.end("data: [DONE]\n\n");
  } else {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ id: "probe", object: "chat.completion", model: body.model, choices: [{ index: 0, message, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
  }
});
await new Promise(resolve => provider.listen(0, "127.0.0.1", resolve));
const port = provider.address().port;
try {
  const env = Object.fromEntries(["PATH", "TMPDIR", "SystemRoot"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  Object.assign(env, {
    HOME: root,
    XDG_CONFIG_HOME: path.join(root, "config"), XDG_DATA_HOME: path.join(root, "data"), XDG_CACHE_HOME: path.join(root, "cache"), XDG_STATE_HOME: path.join(root, "state"),
    OPENCODE_DISABLE_MODELS_FETCH: "true", OPENCODE_DISABLE_AUTOUPDATE: "true",
  });
  const version = execFileSync(binary, ["--version"], { cwd: root, env, encoding: "utf8", timeout: 10000 }).trim();
  assert.match(version, /(?:^|\s)v?2\.2\.0$/, "This probe targets OpenCode 2.2.0");
  const marker = path.join(root, "events.jsonl");
  const pluginDir = path.join(root, "probe-plugin");
  await mkdir(pluginDir);
  await writeFile(path.join(pluginDir, "package.json"), JSON.stringify({ name: "router-v2-probe", type: "module", exports: "./index.js" }));
  const archive = JSON.parse(execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", root], { encoding: "utf8", timeout: 60000 }))[0].filename;
  execFileSync("tar", ["-xzf", path.join(root, archive), "-C", root]);
  const entry = pathToFileURL(path.join(root, "package/dist/index.js")).href;
  const adapterEntry = pathToFileURL(path.join(root, "package/dist/host/adapter.js")).href;
  const controlsEntry = pathToFileURL(path.join(root, "package/dist/controls/index.js")).href;
  await writeFile(path.join(pluginDir, "index.js"), `import { appendFile } from "node:fs/promises";
import plugin from ${JSON.stringify(entry)};
import { HostAdapter } from ${JSON.stringify(adapterEntry)};
import { ControlStore } from ${JSON.stringify(controlsEntry)};
export default { ...plugin, async setup(ctx) {
  await appendFile(${JSON.stringify(marker)}, JSON.stringify({ type: "setup", id: plugin.id }) + "\\n");
  const cleanup = await plugin.setup(ctx);
  const controls = new ControlStore(async () => ({status: "ready", config: {mode: ${JSON.stringify(scenario === "off" ? "off" : "auto")}, profile: "balanced"}}));
  const adapter = new HostAdapter({ controls, decide: async () => ({current: {providerID: "local", modelID: "probe-a"}, target: ${JSON.stringify(variant ? { providerID: "local", modelID: "probe-a", variant: "high" } : { providerID: "local", modelID: "probe-b" })}, evidence: "synthetic fixture only"}), valid: () => true, switchModel: (sessionID, target) => ctx.session.switchModel({sessionID, model: {providerID: target.providerID, id: target.modelID, variant: target.variant}}) });
  const registration = await ctx.session.hook("prompt", async event => {
    await appendFile(${JSON.stringify(marker)}, JSON.stringify({ type: "prompt", keys: Object.keys(event), promptKeys: Object.keys(event.prompt), matchesFixture: event.prompt.text === "v2-fixture" }) + "\\n");
    if (event.prompt.text === "v2-fixture") {
      const result = await adapter.admit({sessionID: event.sessionID, messageID: event.messageID, delivery: event.delivery, deadline: Date.now() + 5000, signal: new AbortController().signal});
      await appendFile(${JSON.stringify(marker)}, JSON.stringify({type: "adapter", result, delivery: event.delivery}) + "\\n");
    }
    const catalog = await ctx.model.list();
    await appendFile(${JSON.stringify(marker)}, JSON.stringify({ type: "catalog", localModels: catalog.data.filter(model => model.providerID === "local").map(model => model.id) }) + "\\n");
  });
  return async () => { adapter.dispose(); controls.dispose(); await registration.dispose(); if (cleanup) await cleanup(); };
} };\n`);
  const config = {
    $schema: "https://opencode.ai/config.json",
    plugins: ["./probe-plugin"], model: "local/probe-a",
    providers: { local: { name: "Local fixture", package: "@opencode/ai/providers/openai-compatible", settings: { baseURL: `http://127.0.0.1:${port}/v1` }, models: { "probe-b": { name: "probe-b", capabilities: { tools: true, input: ["text"], output: ["text"] }, limit: { context: 32000, output: 1024 } }, "probe-a": { name: "probe-a", capabilities: { tools: true, input: ["text"], output: ["text"] }, variants: [{ id: "high", settings: { reasoningEffort: "high" } }], limit: { context: 32000, output: 1024 } } } } },
  };
  await writeFile(path.join(root, "opencode.json"), JSON.stringify(config));
  const output = await new Promise((resolve, reject) => {
    const child = spawn(binary, ["run", "--standalone", "--format", "json", "--model", "local/probe-a", "v2-fixture"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], signal: AbortSignal.timeout(90000) });
    let text = "";
    child.stdout.on("data", data => { text += data; });
    child.stderr.on("data", data => { text += data; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(text) : reject(new Error(`v2 host exited (${code}): ${text.slice(-3000)}`)));
  });
  assert.ok(output.includes("probe-v2-ok"), "Local provider response reached v2 CLI");
  const firstRequestCount = requests.length;
  const followup = await new Promise((resolve, reject) => {
    const child = spawn(binary, ["run", "--standalone", "--continue", "--format", "json", "v2-followup"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], signal: AbortSignal.timeout(90000) });
    let text = "";
    child.stdout.on("data", data => { text += data; });
    child.stderr.on("data", data => { text += data; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(text) : reject(new Error(`followup host exited (${code}): ${text.slice(-3000)}`)));
  });
  assert.ok(followup.includes("probe-v2-ok"), "Followup response reached v2 CLI");
  const events = (await readFile(marker, "utf8")).trim().split("\n").map(JSON.parse);
  assert.ok(events.some(event => event.type === "setup" && event.id === "openai-router"), "Actual plugin entry was loaded");
  assert.ok(events.some(event => event.type === "adapter" && event.result === (scenario === "off" ? "kept" : "issued")), "Adapter applied the expected control behavior");
  assert.ok(events.some(event => event.type === "prompt" && event.matchesFixture), "V2 prompt hook received the fixture");
  assert.ok(events.some(event => event.type === "catalog" && event.localModels.includes("probe-a")), "V2 catalog exposes the configured local model");
  const selected = request => variant ? request.model === "probe-a" && request.reasoningEffort === "high" : scenario === "off" ? request.model === "probe-a" && request.reasoningEffort === null : request.model === "probe-b";
  assert.ok(requests.slice(0, firstRequestCount).some(selected), "First request used the expected selection");
  assert.ok(requests.slice(firstRequestCount).some(selected), "Selection persisted into the followup");
  console.log(JSON.stringify({ version, scope: "isolated fixture only; synthetic admission safety evidence", scenario, events, firstRequests: requests.slice(0, firstRequestCount), followupRequests: requests.slice(firstRequestCount) }, null, 2));
} finally {
  provider.closeAllConnections();
  await new Promise(resolve => provider.close(resolve));
  await rm(root, { recursive: true, force: true });
}
