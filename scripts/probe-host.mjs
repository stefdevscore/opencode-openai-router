// Credential-free feasibility probe. Usage: node scripts/probe-host.mjs /absolute/path/to/opencode
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const binary = process.argv[2];
assert.ok(binary && path.isAbsolute(binary), "Provide an absolute OpenCode binary path");
const totalBudget = AbortSignal.timeout(240000);
const root = await mkdtemp(path.join(os.tmpdir(), "openai-router-probe-"));
const requests = [];
const endpoint = http.createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  requests.push({ url: req.url, ...body });
  const message = { role: "assistant", content: "probe-ok" };
  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    for (const choice of [
      { index: 0, delta: message, finish_reason: null },
      { index: 0, delta: {}, finish_reason: "stop" },
    ]) res.write(`data: ${JSON.stringify({ id: "probe", object: "chat.completion.chunk", created: 0, model: body.model, choices: [choice] })}\n\n`);
    res.end("data: [DONE]\n\n");
  } else {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "probe", object: "chat.completion", model: body.model, choices: [{ index: 0, message, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
  }
});
await new Promise((resolve) => endpoint.listen(0, "127.0.0.1", resolve));
const probePort = endpoint.address().port;
const reservation = http.createServer();
await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
const hostPort = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
let child;
let log = "";
try {
  const configDir = path.join(root, "config");
  await mkdir(configDir, { recursive: true });
  const hookLog = path.join(root, "hooks.jsonl");
  const pluginPath = path.join(root, "probe.js");
  await writeFile(pluginPath, `import { appendFile } from "node:fs/promises";
export const Probe = async () => ({
  "chat.message": async (input, output) => {
    const route = output.parts.some(p => p.type === "text" && p.text === "route-fixture");
    const effort = output.parts.some(p => p.type === "text" && p.text === "effort-fixture");
    await appendFile(${JSON.stringify(hookLog)}, JSON.stringify({ inputModel: input.model, inputVariant: input.variant, original: output.message.model, route, effort, argvRun: process.argv.includes("run"), argvServe: process.argv.includes("serve"), argvRunIndex: process.argv.indexOf("run"), argvServeIndex: process.argv.indexOf("serve") }) + "\\n");
    if (input.model || input.variant) return;
    if (route) output.message.model = { providerID: "openai", modelID: "probe-b", variant: "high" };
    if (effort) output.message.model = { ...output.message.model, variant: "high" };
  }
});\n`);
  const config = {
    $schema: "https://opencode.ai/config.json",
    plugin: [pathToFileURL(pluginPath).href],
    model: "openai/probe-a", small_model: "openai/probe-a",
    enabled_providers: ["openai"], share: "disabled", autoupdate: false,
    provider: { openai: { npm: "@ai-sdk/openai-compatible", options: { apiKey: "local-fixture-only", baseURL: `http://127.0.0.1:${probePort}/v1` }, models: Object.fromEntries(["probe-a", "probe-b"].map(id => [id, { name: id, limit: { context: 32000, output: 1024 }, variants: { low: { reasoningEffort: "low" }, high: { reasoningEffort: "high" } } }])) } },
  };
  const probePassword = randomBytes(32).toString("hex");
  // Inherit only runtime essentials. Never copy provider keys or the user's OpenCode config.
  const env = Object.fromEntries(["PATH", "HOME", "TMPDIR", "SystemRoot"].filter(k => process.env[k]).map(k => [k, process.env[k]]));
  Object.assign(env, {
    XDG_CONFIG_HOME: path.join(root, "xdg-config"), XDG_DATA_HOME: path.join(root, "data"), XDG_CACHE_HOME: path.join(root, "cache"), XDG_STATE_HOME: path.join(root, "state"),
    OPENCODE_CONFIG_DIR: configDir, OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
    OPENCODE_DISABLE_PROJECT_CONFIG: "true", OPENCODE_DISABLE_DEFAULT_PLUGINS: "true", OPENCODE_DISABLE_MODELS_FETCH: "true", OPENCODE_DISABLE_AUTOUPDATE: "true",
    OPENCODE_SERVER_USERNAME: "probe", OPENCODE_SERVER_PASSWORD: probePassword,
  });
  const hostVersion = execFileSync(binary, ["--version"], { cwd: root, env, encoding: "utf8", timeout: 10000 }).trim();
  assert.equal(hostVersion, "1.19.4", "This probe targets pinned OpenCode 1.19.4");
  child = spawn(binary, ["serve", "--hostname", "127.0.0.1", "--port", String(hostPort)], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  let spawnError;
  child.on("error", error => { spawnError = error; });
  child.stdout.on("data", data => { log += data; });
  child.stderr.on("data", data => { log += data; });
  const base = `http://127.0.0.1:${hostPort}`;
  async function api(url, body, timeout = 30000) {
    const response = await fetch(base + url, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`probe:${probePassword}`).toString("base64")}` }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.any([totalBudget, AbortSignal.timeout(timeout)]) });
    const value = await response.json();
    assert.ok(response.ok, `${url}: ${response.status} ${JSON.stringify(value)}`);
    return value;
  }
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { await api("/global/health", undefined, 1000); ready = true; break; } catch {}
    totalBudget.throwIfAborted();
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Host exited: ${log.slice(-3000)}`);
    await delay(100);
  }
  assert.ok(ready, `Host not ready: ${log.slice(-3000)}`);
  const unauthenticated = await fetch(`${base}/session`, { signal: AbortSignal.any([totalBudget, AbortSignal.timeout(3000)]) });
  assert.equal(unauthenticated.status, 401, "Temporary OpenCode server requires authentication");
  const catalog = await api("/provider");
  const provider = catalog.all?.find(p => p.id === "openai");
  assert.ok(provider?.models?.["probe-b"], "SDK catalog includes configured model");
  const results = [];
  let routedSession;
  for (const [text, explicit] of [["route-fixture", false], ["keep-fixture", true], ["default-fixture", false], ["effort-fixture", false], ["followup-fixture", false]]) {
    const session = text === "followup-fixture" ? routedSession : await api("/session", { title: "local-probe" });
    if (text === "route-fixture") routedSession = session;
    const before = requests.length;
    const result = await api(`/session/${session.id}/message`, { ...(explicit ? { model: { providerID: "openai", modelID: "probe-a" }, variant: "low" } : {}), parts: [{ type: "text", text }] });
    assert.equal(requests.length - before, 1, "Fixture dispatched exactly one provider request");
    results.push({ text, model: result.info?.modelID, variant: result.info?.variant, error: result.info?.error });
  }
  assert.equal(results[0].model, "probe-b", "Routed request uses changed model");
  assert.equal(results[0].variant, "high", "Routed request records changed variant");
  assert.equal(results[1].model, "probe-a", "Unchanged request uses original model");
  assert.equal(results[1].variant, "low", "Unchanged request keeps variant");
  assert.equal(results[3].model, "probe-a", "Variant-only change retains model");
  assert.equal(results[3].variant, "high", "Variant-only change applied");
  assert.equal(results[4].model, "probe-a", "Turn-local model change did not pin the session model");
  assert.equal(results[4].variant, undefined, "Omitted follow-up variant uses host default, not the routed high variant");
  assert.ok(requests.some(r => r.model === "probe-b"), "Local provider actually received routed model");
  assert.equal(requests[0].reasoning_effort, "high", "Provider actually received routed effort");
  assert.equal(requests[3].reasoning_effort, "high", "Provider received separate variant-only change");
  const serverRequests = requests.slice();
  const cliResults = [];
  for (const [label, args] of [
    ["default", ["run", "--format", "json", "--title", "local-probe", "route-fixture"]],
    ["explicit", ["run", "--format", "json", "--title", "local-probe", "--model", "openai/probe-a", "--variant", "low", "route-fixture"]],
    ["model-only", ["run", "--format", "json", "--title", "local-probe", "--model", "openai/probe-a", "route-fixture"]],
    ["variant-only", ["run", "--format", "json", "--title", "local-probe", "--variant", "low", "route-fixture"]],
  ]) {
    const before = requests.length;
    const result = await new Promise((resolve, reject) => {
      const cli = spawn(binary, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], signal: totalBudget });
      let output = "";
      cli.stdout.on("data", data => { output += data; });
      cli.stderr.on("data", data => { output += data; });
      cli.on("error", reject);
      cli.on("close", code => code === 0 ? resolve(output) : reject(new Error(`CLI ${label} failed (${code}): ${output.slice(-2000)}`)));
    });
    assert.ok(result.includes("probe-ok"), `CLI ${label} received fixture response`);
    assert.equal(requests.length - before, 1, `CLI ${label} issued one provider request`);
    const request = requests.at(-1);
    cliResults.push({ label, model: request.model, reasoningEffort: request.reasoning_effort });
  }
  assert.equal(cliResults[0].model, "probe-b", "CLI default path uses routed model");
  assert.equal(cliResults[0].reasoningEffort, "high", "CLI default path uses routed effort");
  assert.equal(cliResults[1].model, "probe-a", "CLI explicit model is preserved");
  assert.equal(cliResults[1].reasoningEffort, "low", "CLI explicit variant is preserved");
  assert.equal(cliResults[2].model, "probe-a", "CLI model-only selection is preserved");
  assert.equal(cliResults[3].model, "probe-a", "CLI variant-only selection preserves model");
  assert.equal(cliResults[3].reasoningEffort, "low", "CLI variant-only selection is preserved");
  const hooks = (await readFile(hookLog, "utf8")).trim().split("\n").map(JSON.parse);
  assert.ok(hooks.slice(-4).every(hook => hook.argvRun && !hook.argvServe), "Standalone CLI fixtures use the run process boundary");
  assert.ok(!hooks.at(-2).inputVariant, "Model-only input is distinguishable at the hook");
  assert.ok(!hooks.at(-1).inputModel, "Variant-only input is distinguishable at the hook");
  console.log(JSON.stringify({ hostVersion, scope: "isolated local fixture; no live OpenAI authentication or quality evaluation", results, hooks, connected: catalog.connected, configuredVariants: Object.keys(provider.models["probe-b"].variants ?? {}), providerRequests: serverRequests.map(r => ({ model: r.model, reasoningEffort: r.reasoning_effort })), cliResults }, null, 2));
} catch (error) {
  console.error(log.slice(-4000));
  throw error;
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await Promise.race([new Promise(resolve => child.once("exit", resolve)), delay(2000)]);
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once("exit", resolve));
      child.kill("SIGKILL");
      await Promise.race([exited, delay(2000)]);
    }
  }
  endpoint.closeAllConnections();
  await new Promise(resolve => endpoint.close(resolve));
  await rm(root, { recursive: true, force: true });
}
