// Load the actual packed plugin alongside an independent probe fixture.
// Usage: node scripts/probe-v2-package.mjs /absolute/path/to/opencode
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";


const binary = process.argv[2];
assert.ok(binary && path.isAbsolute(binary), "Provide an absolute OpenCode binary path");
const root = await mkdtemp(path.join(os.tmpdir(), "openai-router-v2-probe-"));
const requests = [];
const provider = http.createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw || "{}");
  requests.push({ model: body.model });
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
  const env = Object.fromEntries(["PATH", "HOME", "TMPDIR", "SystemRoot"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  Object.assign(env, {
    XDG_CONFIG_HOME: path.join(root, "config"), XDG_DATA_HOME: path.join(root, "data"), XDG_CACHE_HOME: path.join(root, "cache"), XDG_STATE_HOME: path.join(root, "state"),
    OPENCODE_DISABLE_MODELS_FETCH: "true", OPENCODE_DISABLE_AUTOUPDATE: "true",
  });
  const version = execFileSync(binary, ["--version"], { cwd: root, env, encoding: "utf8", timeout: 10000 }).trim();
  assert.match(version, /(?:^|\s)v?2\.1\.4$/, "This probe targets OpenCode 2.1.4");
  const marker = path.join(root, "events.jsonl");
  const pluginDir = path.join(root, "probe-plugin");
  await mkdir(pluginDir);
  await mkdir(path.join(root, "config", "opencode-openai-router"), { recursive: true });
  await writeFile(path.join(root, "config", "opencode-openai-router", "config.json"), JSON.stringify({ mode: "off", profile: "quality" }));
  await writeFile(path.join(pluginDir, "package.json"), JSON.stringify({ name: "router-v2-probe", type: "module", exports: "./index.js" }));
  const archive = JSON.parse(execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", root], { encoding: "utf8", timeout: 60000 }))[0].filename;
  execFileSync("tar", ["-xzf", path.join(root, archive), "-C", root], { timeout: 30000 });
  await writeFile(path.join(pluginDir, "index.js"), `import { appendFile, writeFile } from "node:fs/promises";
import { appendFileSync } from "node:fs";
export default { id: "router.package.probe", async setup(ctx) {
  const originalError = console.error;
  console.error = (...args) => { try { const record = JSON.parse(args[0]); if (record.component === "opencode.openai-router") appendFileSync(${JSON.stringify(marker)}, JSON.stringify({ type: "status", record }) + "\\n"); } catch {} originalError(...args); };
  const registration = await ctx.session.hook("prompt", async event => {
    await appendFile(${JSON.stringify(marker)}, JSON.stringify({ type: "prompt", matchesFixture: event.prompt.text === "v2-fixture" }) + "\\n");
    const plugins = await ctx.plugin.list();
    await appendFile(${JSON.stringify(marker)}, JSON.stringify({ type: "plugin", active: plugins.data.some(p => p.id === "opencode.openai-router" && p.state.status === "active") }) + "\\n");
    const commands = await ctx.command.list();
    await appendFile(${JSON.stringify(marker)}, JSON.stringify({ type: "controls", registered: commands.data.some(c => c.name === "openai-router-status") }) + "\\n");
    if (event.prompt.text === "v2-fixture") {
      await ctx.session.command({ sessionID: event.sessionID, name: "openai-router-status", text: "", delivery: "steer" });
      await writeFile(${JSON.stringify(path.join(root, "config", "opencode-openai-router", "config.json"))}, JSON.stringify({ mode: "auto", profile: "balanced" }));
      await ctx.session.command({ sessionID: event.sessionID, name: "openai-router-status", text: "", delivery: "steer" });
    }
    const catalog = await ctx.model.list();
    await appendFile(${JSON.stringify(marker)}, JSON.stringify({ type: "catalog", localModels: catalog.data.filter(model => model.providerID === "local").map(model => model.id) }) + "\\n");
  });
  return async () => { console.error = originalError; await registration.dispose();  };
} };\n`);
  const config = {
    $schema: "https://opencode.ai/config.json",
    plugins: [{ package: "./package", options: { mode: "auto", profile: "economy" } }, "./probe-plugin"], model: "local/probe-a",
    providers: { local: { name: "Local fixture", package: "@opencode/ai/providers/openai-compatible", settings: { baseURL: `http://127.0.0.1:${port}/v1` }, models: { "probe-a": { name: "probe-a", capabilities: { tools: true, input: ["text"], output: ["text"] }, limit: { context: 32000, output: 1024 } } } } },
  };
  await writeFile(path.join(root, "opencode.json"), JSON.stringify(config));
  const output = await new Promise((resolve, reject) => {
    const child = spawn(binary, ["run", "--standalone", "--print-logs", "--format", "json", "--model", "local/probe-a", "v2-fixture"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], signal: AbortSignal.timeout(90000) });
    let text = "";
    child.stdout.on("data", data => { text += data; });
    child.stderr.on("data", data => { text += data; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(text) : reject(new Error(`v2 host exited (${code}): ${text.slice(-3000)}`)));
  });
  assert.ok(output.includes("probe-v2-ok"), "Local provider response reached v2 CLI");
  const events = (await readFile(marker, "utf8")).trim().split("\n").map(JSON.parse);
  assert.ok(events.some(event => event.type === "plugin" && event.active), "Actual packed plugin must be active in the host");
  assert.ok(events.some(event => event.type === "controls" && event.registered), "Packed plugin registered the status command");
  assert.ok(events.some(event => event.type === "status" && event.record?.config?.mode === "off" && event.record?.config?.profile === "quality"), "Status command uses the user configuration, not project options");
  assert.ok(events.some(event => event.type === "status" && event.record?.config?.mode === "auto" && event.record?.config?.profile === "balanced" && event.record.generation > 1), "Status command reloads changes in the same plugin instance");
  assert.ok(output.includes('"component":"opencode.openai-router"'), "Status is visible in host logs with --print-logs");
  assert.ok(events.some(event => event.type === "prompt" && event.matchesFixture), "V2 prompt hook received the fixture");
  assert.ok(events.some(event => event.type === "catalog" && event.localModels.includes("probe-a")), "V2 catalog exposes the configured local model");
  assert.ok(requests.some(request => request.model === "probe-a"), "Local provider received the model request");
  console.log(JSON.stringify({ version, scope: "isolated local fixture; no real OpenAI auth or automatic routing", events, requests }, null, 2));
} finally {
  provider.closeAllConnections();
  await new Promise(resolve => provider.close(resolve));
  await rm(root, { recursive: true, force: true });
}
