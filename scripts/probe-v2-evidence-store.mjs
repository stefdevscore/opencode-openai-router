// Credential-free probe: transactional state in the OpenCode 2.2 plugin runtime.
// Usage: node scripts/probe-v2-classifier-transport.mjs /absolute/path/to/opencode
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { OpenCode } from '@opencode/client';
const binary = process.argv[2]; assert.ok(binary && path.isAbsolute(binary));
const root = await mkdtemp(path.join(os.tmpdir(), 'router-generation-probe-'));
let child; const calls = [];
const provider = http.createServer(async (req, res) => {
  let input = ''; for await (const chunk of req) input += chunk;
  const body = JSON.parse(input); calls.push({ model: body.model, stream: body.stream === true });
  const message = { role: 'assistant', content: '{"result":"fixture"}' };
  if (body.stream) {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    for (const choice of [{ index: 0, delta: message, finish_reason: null }, { index: 0, delta: {}, finish_reason: 'stop' }]) res.write(`data: ${JSON.stringify({ id: 'probe', object: 'chat.completion.chunk', created: 0, model: body.model, choices: [choice] })}\n\n`);
    res.end('data: [DONE]\n\n');
  } else {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'probe', object: 'chat.completion', model: body.model, choices: [{ index: 0, message, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
  }
});
try {
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  const socket = net.createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve)); const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const password = randomBytes(32).toString('hex');
  const env = Object.fromEntries(['PATH', 'TMPDIR', 'SystemRoot'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
  Object.assign(env, { HOME: root, XDG_CONFIG_HOME: path.join(root, 'config'), XDG_DATA_HOME: path.join(root, 'data'), XDG_CACHE_HOME: path.join(root, 'cache'), XDG_STATE_HOME: path.join(root, 'state'), OPENCODE_DISABLE_MODELS_FETCH: 'true', OPENCODE_DISABLE_AUTOUPDATE: 'true', OPENCODE_SERVER_PASSWORD: password });
  assert.match(execFileSync(binary, ['--version'], { cwd: root, env, encoding: 'utf8' }).trim(), /(?:^|\s)v?2\.2\.0$/);
  const [archive] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', root], { encoding: 'utf8' }));
  execFileSync('tar', ['-xzf', path.join(root, archive.filename), '-C', root]);
  const fixture = path.join(root, 'fixture'); await mkdir(fixture);
  await writeFile(path.join(fixture, 'package.json'), JSON.stringify({ name: 'router-generate-probe', type: 'module' }));
  const contract = { id: 'router-generation-probe', methods: { generate: { input: { type: 'object', properties: {}, additionalProperties: false }, output: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } } }, events: {} };
  await writeFile(path.join(fixture, 'server.js'), `import { EvidenceStore } from ${JSON.stringify(pathToFileURL(path.join(root, 'package/dist/evidence/store.js')).href)}; export default {id:'router-generate-probe',async setup(ctx){const store=new EvidenceStore(${JSON.stringify(path.join(root, 'evidence.sqlite'))});const r=await ctx.rpc.register(${JSON.stringify(contract)},{generate:async()=>{store.observe({complete:true,modelIDs:['base']});const keys=store.observe({complete:true,modelIDs:['base','new']});const result=store.reserve(keys,100000000,1);return {text:JSON.stringify({added:keys.length,allowed:result.allowed})}}});return async()=>{store.close();await r.dispose()}}}`);
  const config = { plugins: ['./fixture'], model: 'local/probe-a', providers: { local: { name: 'Fixture', package: '@opencode/ai/providers/openai-compatible', settings: { baseURL: `http://127.0.0.1:${provider.address().port}/v1` }, models: { 'probe-a': { name: 'probe-a', capabilities: { tools: true, input: ['text'], output: ['text'] }, limit: { context: 32000, output: 1024 } } } } } };
  await writeFile(path.join(root, 'opencode.json'), JSON.stringify(config));
  let log = ''; child = spawn(binary, ['serve', '--hostname', '127.0.0.1', '--port', String(port), '--print-logs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] }); child.stdout.on('data', c => { log += c; }); child.stderr.on('data', c => { log += c; });
  const client = OpenCode.make({ baseUrl: `http://127.0.0.1:${port}`, headers: { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}` } });
  let ready = false; for (let i = 0; i < 100; i++) { if (child.exitCode !== null) throw Error(log.slice(-2000)); try { await client.server.info(); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } } assert.ok(ready);
  const location = { directory: root }; const session = await client.session.create({ title: 'generation isolation', location, model: { providerID: 'local', id: 'probe-a' } });
  let plugins; for (let i = 0; i < 50; i++) { plugins = await client.plugin.list({ location }); if (plugins.data.some(x => x.id === 'router-generate-probe' && x.state.status === 'active')) break; await new Promise(resolve => setTimeout(resolve, 100)); }
  assert.ok(plugins.data.some(x => x.id === 'router-generate-probe' && x.state.status === 'active'));
  const before = await client.message.list({ sessionID: session.id }); const selection = await client.session.get({ sessionID: session.id });
  const result = await client.rpc(contract).generate({}, { location });
  assert.equal(result.text, '{"added":1,"allowed":true}'); assert.deepEqual(Object.keys(result), ['text']);
  const after = await client.message.list({ sessionID: session.id });
  assert.deepEqual(after.data, before.data); assert.deepEqual((await client.session.get({ sessionID: session.id })).model, selection.model);
  assert.equal(calls.length, 0);
  console.log(JSON.stringify({ version: '2.2.0', resultFields: Object.keys(result), localProviderRequests: calls.length, sessionMessagesBefore: before.data.length, sessionMessagesAfter: after.data.length, selectionUnchanged: true, transactionalStore: 'fixture passed', accountCompatibility: 'not tested' }, null, 2));
} finally {
  if (child && child.exitCode === null) { child.kill('SIGTERM'); await new Promise(resolve => { child.once('exit', resolve); setTimeout(resolve, 3000).unref(); }); if (child.exitCode === null) child.kill('SIGKILL'); }
  provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve)); await rm(root, { recursive: true, force: true });
}
