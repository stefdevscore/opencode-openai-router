// Exercise the packed plugin's status RPC in a fresh session without a prompt.
// Usage: node scripts/probe-v2-gui-rpc.mjs /absolute/path/to/opencode
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { OpenCode } from "@opencode/client";
import { RouterRpc } from "../dist/rpc.js";

const binary = process.argv[2];
assert.ok(binary && path.isAbsolute(binary), "Provide an absolute OpenCode binary path");
const root = await mkdtemp(path.join(os.tmpdir(), "router-inspect-probe-"));
const requests = [];
const provider = http.createServer((request, response) => { requests.push(request.url); response.writeHead(500).end(); });
let child;
try {
  await new Promise(resolve => provider.listen(0, "127.0.0.1", resolve));
  const portProbe = net.createServer();
  await new Promise(resolve => portProbe.listen(0, "127.0.0.1", resolve));
  const port = portProbe.address().port;
  await new Promise(resolve => portProbe.close(resolve));
  const env = Object.fromEntries(["PATH", "TMPDIR", "SystemRoot"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  const password = randomBytes(32).toString("hex");
  Object.assign(env, { HOME: root, XDG_CONFIG_HOME: path.join(root, "config"), XDG_DATA_HOME: path.join(root, "data"), XDG_CACHE_HOME: path.join(root, "cache"), XDG_STATE_HOME: path.join(root, "state"), OPENCODE_DISABLE_MODELS_FETCH: "true", OPENCODE_DISABLE_AUTOUPDATE: "true", OPENCODE_SERVER_PASSWORD: password });
  assert.match(execFileSync(binary, ["--version"], { cwd: root, env, encoding: "utf8", timeout: 10000 }).trim(), /(?:^|\s)v?2\.2\.0$/);
  await mkdir(path.join(root, "config", "opencode-openai-router"), { recursive: true });
  await writeFile(path.join(root, "config", "opencode-openai-router", "config.json"), '{"mode":"off","profile":"quality"}');
  const archive = JSON.parse(execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", root], { encoding: "utf8", timeout: 60000 }))[0].filename;
  execFileSync("tar", ["-xzf", path.join(root, archive), "-C", root]);
  const config = { model: "local/probe-a", providers: { local: { name: "Local fixture", package: "@opencode/ai/providers/openai-compatible", settings: { baseURL: `http://127.0.0.1:${provider.address().port}/v1` }, models: { "probe-a": { name: "probe-a", capabilities: { tools: true, input: ["text"], output: ["text"] }, limit: { context: 32000, output: 1024 } } } } } };
  await writeFile(path.join(root, "opencode.json"), JSON.stringify(config));
  await mkdir(path.join(root, "config", "opencode"), { recursive: true });
  await writeFile(path.join(root, "config", "opencode", "opencode.json"), JSON.stringify({ plugins: [path.join(root, "package")] }));
  let output = "";
  child = spawn(binary, ["serve", "--hostname", "127.0.0.1", "--port", String(port), "--print-logs"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  const client = OpenCode.make({ baseUrl: `http://127.0.0.1:${port}`, headers: { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` } });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${output.slice(-2000)}`);
    try { await client.server.info(); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(ready, `Server did not start: ${output.slice(-2000)}`);
  const location = { directory: root };
  const session = await client.session.create({ title: "isolated inspection", location, model: { providerID: "local", id: "probe-a" } });
  let plugins = await client.plugin.list({ location });
  for (let i = 0; i < 30 && !plugins.data.some(plugin => plugin.id === "openai-router" && plugin.state.status === "active"); i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    plugins = await client.plugin.list({ location });
  }
  assert.ok(plugins.data.some(plugin => plugin.id === "openai-router" && plugin.state.status === "active"), "Packed plugin is active");
  const router = plugins.data.find(plugin => plugin.id === "openai-router");
  assert.equal(router.features.gui, true, "Packed GUI entry is discovered");
  const before = await client.message.list({ sessionID: session.id });
  const beforeSession = await client.session.get({ sessionID: session.id });
  const rpc = client.rpc(RouterRpc);
  const status = await rpc.status({}, { location });
  assert.deepEqual({ status: status.status, mode: status.mode, profile: status.profile, routing: status.routing }, { status: "ready", mode: "off", profile: "quality", routing: "inactive" });
  await writeFile(path.join(root, "config", "opencode-openai-router", "config.json"), '{"mode":null}');
  const invalid = await rpc.status({}, { location });
  assert.equal(invalid.status, "invalid_config");
  assert.equal(invalid.mode, null);
  assert.equal(invalid.profile, null);
  const after = await client.message.list({ sessionID: session.id });
  const afterSession = await client.session.get({ sessionID: session.id });
  assert.deepEqual(after.data, before.data, "Inspection created no session message");
  assert.deepEqual(afterSession.agent, beforeSession.agent, "Inspection did not change agent");
  assert.deepEqual(afterSession.model, beforeSession.model, "Inspection did not change model");
  assert.equal(requests.length, 0, "Inspection made no provider request");
  console.log(JSON.stringify({ version: "2.2.0", scope: "isolated server API; no desktop UI", status, invalid, messagesBefore: before.data.length, messagesAfter: after.data.length, providerRequests: requests.length, selectionUnchanged: true }, null, 2));
} finally {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise(resolve => { child.once("exit", resolve); setTimeout(resolve, 3000).unref(); });
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  provider.closeAllConnections();
  await new Promise(resolve => provider.close(resolve));
  await rm(root, { recursive: true, force: true });
}
