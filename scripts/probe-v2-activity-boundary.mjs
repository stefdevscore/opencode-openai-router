// Isolated host-boundary experiment. The fixture deliberately switches an active session.
// Usage: node scripts/probe-v2-activity-boundary.mjs /absolute/path/to/opencode
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { OpenCode } from '@opencode/client';

const binary = process.argv[2];
assert.ok(binary && path.isAbsolute(binary));
const root = await mkdtemp(path.join(os.tmpdir(), 'router-activity-probe-'));
const events = path.join(root, 'events.jsonl');
const requests = [];
const held = [];
let child;
const provider = http.createServer(async (req, res) => {
  let body = ''; for await (const part of req) body += part;
  requests.push(JSON.parse(body).model);
  // Keep all requests active until observations have been made.
  held.push(res);
});
const waitFor = async (check, message) => {
  for (let i = 0; i < 150; i++) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(message);
};
try {
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const password = randomBytes(32).toString('hex');
  const env = Object.fromEntries(['PATH', 'TMPDIR', 'SystemRoot'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
  Object.assign(env, { HOME: root, XDG_CONFIG_HOME: path.join(root, 'config'), XDG_DATA_HOME: path.join(root, 'data'), XDG_CACHE_HOME: path.join(root, 'cache'), XDG_STATE_HOME: path.join(root, 'state'), OPENCODE_DISABLE_MODELS_FETCH: 'true', OPENCODE_DISABLE_AUTOUPDATE: 'true', OPENCODE_SERVER_PASSWORD: password });
  assert.match(execFileSync(binary, ['--version'], { cwd: root, env, encoding: 'utf8' }).trim(), /(?:^|\s)v?2\.2\.0$/);
  const pluginDir = path.join(root, 'fixture'); await mkdir(pluginDir);
  await writeFile(path.join(pluginDir, 'package.json'), JSON.stringify({ name: 'router-activity-fixture', type: 'module' }));
  await writeFile(path.join(pluginDir, 'server.js'), `import { appendFile } from 'node:fs/promises';
export default { id: 'router-activity-fixture', async setup(ctx) {
 const registration = await ctx.session.hook('prompt', async e => {
   if (e.prompt.text !== 'initial' && e.prompt.text !== 'steer' && e.prompt.text !== 'queued') return;
   await appendFile(${JSON.stringify(events)}, JSON.stringify({text:e.prompt.text, delivery:e.delivery})+'\\n');
   if (e.prompt.text === 'steer') await ctx.session.switchModel({sessionID:e.sessionID, model:{providerID:'local',id:'probe-b'}});
 });
 return () => registration.dispose();
}};`);
  const model = name => ({ name, capabilities: { tools: true, input: ['text'], output: ['text'] }, limit: { context: 32000, output: 1024 } });
  await writeFile(path.join(root, 'opencode.json'), JSON.stringify({ plugins: ['./fixture'], model: 'local/probe-a', providers: { local: { name: 'Fixture', package: '@opencode/ai/providers/openai-compatible', settings: { baseURL: `http://127.0.0.1:${provider.address().port}/v1` }, models: { 'probe-a': model('probe-a'), 'probe-b': model('probe-b') } } } }));
  let output = '';
  child = spawn(binary, ['serve', '--hostname', '127.0.0.1', '--port', String(port), '--print-logs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', c => { output += c; }); child.stderr.on('data', c => { output += c; });
  const client = OpenCode.make({ baseUrl: `http://127.0.0.1:${port}`, headers: { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}` } });
  await waitFor(async () => { if (child.exitCode !== null) throw new Error(output.slice(-3000)); try { await client.server.info(); return true; } catch { return false; } }, 'server did not start');
  const location = { directory: root };
  const session = await client.session.create({ title: 'activity fixture', location, model: { providerID: 'local', id: 'probe-a' } });
  await client.session.prompt({ sessionID: session.id, text: 'initial' });
  await waitFor(() => requests.includes('probe-a'), 'initial request did not reach provider');
  const active = await client.session.active();
  assert.equal(active[session.id]?.type, 'running', 'first prompt is running');
  await client.session.prompt({ sessionID: session.id, text: 'queued', delivery: 'queue' });
  const inbox = await client.session.inbox.list({ sessionID: session.id });
  assert.ok(inbox.some(item => item.delivery === 'queue'), 'queued item exists');
  await client.session.prompt({ sessionID: session.id, text: 'steer', delivery: 'steer' });
  const selection = (await client.session.get({ sessionID: session.id })).model;
  assert.equal(selection?.id, 'probe-b', 'switch changed the running session');
  const seen = (await readFile(events, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.ok(seen.some(item => item.text === 'steer' && item.delivery === 'steer'));
  assert.ok(seen.some(item => item.text === 'queued' && item.delivery === 'queue'));
  console.log(JSON.stringify({ version: '2.2.0', running: true, queued: true, steerHookDelivery: 'steer', selectionDuringActiveRequest: selection.id, providerRequests: requests.length }, null, 2));
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise(resolve => { child.once('exit', resolve); setTimeout(resolve, 3000).unref(); });
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  for (const res of held) res.destroy();
  provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve));
  await rm(root, { recursive: true, force: true });
}
