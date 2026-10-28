// Exercise the packed plugin's status command in a fresh session without a prompt.
// Usage: node scripts/probe-v2-inspection.mjs /absolute/path/to/opencode
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { OpenCode } from "@opencode/client";

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
  assert.match(execFileSync(binary, ["--version"], { cwd: root, env, encoding: "utf8", timeout: 10000 }).trim(), /(?:^|\s)v?2\.1\.4$/);
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
  let commands = await client.command.list({ location });
  for (let i = 0; i < 30 && !commands.data.some(command => command.name === "openai-router-status"); i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    commands = await client.command.list({ location });
  }
  assert.ok(commands.data.some(command => command.name === "openai-router-status"), "Packed plugin status command is registered");
  const before = await client.message.list({ sessionID: session.id });
  await client.session.command({ sessionID: session.id, name: "openai-router-status", text: "", delivery: "steer" });
  await client.session.wait({ sessionID: session.id });
  const after = await client.message.list({ sessionID: session.id });
  assert.deepEqual(after.data, before.data, "Inspection created no session message");
  assert.equal(requests.length, 0, "Inspection made no provider request");
  assert.ok(output.includes('"component":"opencode.openai-router"') && output.includes('"mode":"off"'), "Status is visible in server logs");
  console.log(JSON.stringify({ version: "2.1.4", scope: "isolated server API; no desktop UI", commandRegistered: true, statusLogged: true, messagesBefore: before.data.length, messagesAfter: after.data.length, providerRequests: requests.length }, null, 2));
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
