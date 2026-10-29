// Credential-free automatic calibration through OpenCode 2.2 stateless generation and a loopback provider.
// Usage: node scripts/probe-v2-automatic-calibration.mjs /absolute/path/to/opencode
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
const root = await mkdtemp(path.join(os.tmpdir(), 'router-baseline-probe-'));
const provider = http.createServer(async (req, res) => {
  try {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    const prompt = body.messages.map(m => typeof m.content === 'string' ? m.content : (m.content ?? []).map(p => p.text ?? '').join('')).join('\n');
    const packets = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
    const content = JSON.stringify({ assessments: packets.map(p => p.modelID === 'router-calibration-supported' ? { modelID: p.modelID, basis: 'sourced', suitability: 'higher', references: [{ sourceID: 'openai-model-index', quote: 'higher suitability' }] } : { modelID: p.modelID, basis: 'provisional', suitability: 'unknown', references: [] }) });
    if (body.stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const choice of [{ index: 0, delta: { role: 'assistant', content }, finish_reason: null }, { index: 0, delta: {}, finish_reason: 'stop' }]) res.write(`data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', created: 0, model: body.model, choices: [choice] })}\n\n`);
      res.end('data: [DONE]\n\n');
    } else { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ id: 'fixture', object: 'chat.completion', model: body.model, choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }] })); }
  } catch { res.writeHead(500).end(); }
});
let child; let requests = 0; provider.on('request', () => { requests++; });
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
  await writeFile(path.join(fixture, 'package.json'), JSON.stringify({ name: 'router-baseline-probe', type: 'module' }));
  const contract = { id: 'router-baseline-probe', methods: { run: { input: { type: 'object', properties: {}, additionalProperties: false }, output: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } } }, events: {} };
  const moduleURL = subpath => pathToFileURL(path.join(root, 'package/dist', subpath)).href;
  const source = `
    import { CatalogStore } from ${JSON.stringify(moduleURL('catalog/store.js'))};
    import { ControlStore } from ${JSON.stringify(moduleURL('controls/index.js'))};
    import { EvidenceStore } from ${JSON.stringify(moduleURL('evidence/store.js'))};
    import { EvidencePipeline } from ${JSON.stringify(moduleURL('evidence/pipeline.js'))};
    import { PublicEvidenceResolver } from ${JSON.stringify(moduleURL('evidence/resolver.js'))};
    export default { id: 'router-baseline-probe', async setup(ctx) {
      const registration = await ctx.rpc.register(${JSON.stringify(contract)}, { run: async () => {
        let stage = 0, clock = 100, calls = 0;
        const wanted = ['router-base', 'router-old', 'router-new'];
        const catalog = new CatalogStore({ providers: () => ctx.provider.list(), models: async () => { const result = await ctx.model.list(); return { data: result.data.filter(item => item.providerID === 'openai' && wanted.slice(0, stage + 1).includes(item.id)) }; }, connected: async () => true });
        const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
        const resolver = new PublicEvidenceResolver({ now: () => clock, cacheMs: 1, fetchIndex: async () => '- [Base](/api/docs/models/router-base.md): Existing model.\\n- [Old](/api/docs/models/router-old.md): Existing model.\\n' + (stage >= 2 ? '- [New](/api/docs/models/router-new.md): New model.\\n' : '') });
        const store = new EvidenceStore(${JSON.stringify(path.join(root, 'evidence.sqlite'))});
        const classifier = { modelID: 'fixture-judge', calibrationVersion: 'fixture', promptVersion: 'fixture' };
        const deps = { catalog, controls, resolver, store, now: () => 100, limit: 4, notify: () => {}, generate: async (classifier, prompt) => { calls++; const result = await ctx.experimental.generate.text({model:{providerID:'openai',id:classifier.modelID},prompt}); return result.text; } };
        let pipeline = new EvidencePipeline(deps);
        try {
          const results = []; for (stage = 0; stage < 3; stage++) { clock++; catalog.invalidate(); await catalog.refresh(); results.push(await pipeline.observe()); }
          pipeline.dispose(); pipeline = new EvidencePipeline(deps); results.push(await pipeline.observe());
          return { text: JSON.stringify({ results, calls, statuses: Object.values(store.snapshot().work) }) };
        } finally { pipeline.dispose(); resolver.dispose(); controls.dispose(); catalog.dispose(); store.close(); }
      }}); return () => registration.dispose();
    }};`;
  await writeFile(path.join(fixture, 'server.js'), source);
  const model = id => ({ name: id, capabilities: { tools: true, input: ['text'], output: ['text'] }, limit: { context: 32000, output: 1024 } });
  const config = { plugins: ['./fixture'], model: 'local/probe-a', providers: { local: { name: 'Local', package: '@opencode/ai/providers/openai-compatible', settings: { baseURL: `http://127.0.0.1:${provider.address().port}/v1` }, models: { 'probe-a': model('probe-a') } }, openai: { name: 'OpenAI fixture', activation: 'enabled', package: '@opencode/ai/providers/openai-compatible', settings: { baseURL: `http://127.0.0.1:${provider.address().port}/v1` }, models: Object.fromEntries(['router-base', 'router-old', 'router-new'].map(id => [id, model(id)])) } } };
  await writeFile(path.join(root, 'opencode.json'), JSON.stringify(config));
  let log = ''; child = spawn(binary, ['serve', '--hostname', '127.0.0.1', '--port', String(port), '--print-logs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] }); child.stdout.on('data', c => { log += c; }); child.stderr.on('data', c => { log += c; });
  const client = OpenCode.make({ baseUrl: `http://127.0.0.1:${port}`, headers: { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}` } });
  let ready = false; for (let i = 0; i < 100; i++) { if (child.exitCode !== null) throw Error(log.slice(-2000)); try { await client.server.info(); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } } assert.ok(ready);
  const location = { directory: root }; const session = await client.session.create({ title: 'baseline fixture', location, model: { providerID: 'local', id: 'probe-a' } });
  let plugins; for (let i = 0; i < 50; i++) { plugins = await client.plugin.list({ location }); if (plugins.data.some(x => x.id === 'router-baseline-probe' && x.state.status === 'active')) break; await new Promise(resolve => setTimeout(resolve, 100)); }
  assert.ok(plugins.data.some(x => x.id === 'router-baseline-probe' && x.state.status === 'active'));
  const before = await client.message.list({ sessionID: session.id }); const selection = await client.session.get({ sessionID: session.id });
  const result = JSON.parse((await client.rpc(contract).run({}, { location })).text);
  assert.deepEqual(result.results, ['baseline', 'idle', 'issued', 'idle']); assert.equal(result.calls, 1); assert.deepEqual(result.statuses, ['complete']);
  assert.deepEqual((await client.message.list({ sessionID: session.id })).data, before.data); assert.deepEqual((await client.session.get({ sessionID: session.id })).model, selection.model); assert.equal(requests, 1);
  console.log(JSON.stringify({ version: '2.2.0', results: result.results, generationCalls: result.calls, providerRequests: requests, sessionUnchanged: true, limitations: 'Actual OpenCode generation with synthetic loopback model responses; no live OpenAI account or quality measurement.' }, null, 2));
} finally {
  if (child && child.exitCode === null) { child.kill('SIGTERM'); await new Promise(resolve => { child.once('exit', resolve); setTimeout(resolve, 3000).unref(); }); if (child.exitCode === null) child.kill('SIGKILL'); }
  provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve)); await rm(root, { recursive: true, force: true });
}
