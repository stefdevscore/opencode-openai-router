import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceFingerprint, validateAssessments } from '../dist/evidence/assessment.js';
import { formatDispatchNotice, reserveDispatch, WINDOW_MS } from '../dist/evidence/usage.js';

const packet = { modelID: 'model-a', sources: [{ id: 'source-1', url: 'https://example.test/card', text: 'The model supports coding and analysis.' }] };
const sourced = { assessments: [{ modelID: 'model-a', basis: 'sourced', suitability: 'middle', references: [{ sourceID: 'source-1', quote: 'supports coding' }] }] };
test('assessment validation accepts exact source references and rejects invented identities or citations', () => {
  assert.deepEqual(validateAssessments(sourced, [packet]), sourced.assessments);
  for (const result of [
    { assessments: [{ ...sourced.assessments[0], modelID: 'other' }] },
    { assessments: [{ ...sourced.assessments[0], references: [{ sourceID: 'source-1', quote: 'invented quotation' }] }] },
    { assessments: [{ ...sourced.assessments[0], references: [] }] },
    { assessments: [{ ...sourced.assessments[0], price: 0 }] },
    { assessments: [sourced.assessments[0], sourced.assessments[0]] },
  ]) assert.equal(validateAssessments(result, [packet]), null);
  assert.deepEqual(validateAssessments({ assessments: [{ modelID: 'model-a', basis: 'provisional', suitability: 'unknown', references: [] }] }, [packet])?.[0].basis, 'provisional');
});

test('fingerprint changes on source, classifier, variant and schema, but not source order', () => {
  const classifier = { modelID: 'judge', variant: 'low' }; const a = evidenceFingerprint(packet, classifier, 'v1');
  assert.notEqual(a, evidenceFingerprint({ ...packet, sources: [{ ...packet.sources[0], text: 'changed evidence' }] }, classifier, 'v1'));
  assert.notEqual(a, evidenceFingerprint(packet, { ...classifier, variant: 'high' }, 'v1'));
  assert.notEqual(a, evidenceFingerprint(packet, classifier, 'v2'));
  const second = { id: 'source-2', url: 'https://example.test/b', text: 'More evidence' };
  assert.equal(evidenceFingerprint({ ...packet, sources: [packet.sources[0], second] }, classifier, 'v1'), evidenceFingerprint({ ...packet, sources: [second, packet.sources[0]] }, classifier, 'v1'));
});

test('rolling dispatch allowance renews automatically and reports token and monetary usage unknown', () => {
  let ledger = { dispatches: [] }; const now = WINDOW_MS + 100;
  for (let i = 0; i < 4; i++) { const result = reserveDispatch(ledger, now + i); assert.equal(result.allowed, true); ledger = result.ledger; }
  const exhausted = reserveDispatch(ledger, now + 4); assert.equal(exhausted.allowed, false); assert.equal(exhausted.usage.nextEligibleAt, now + WINDOW_MS); assert.equal(exhausted.usage.tokenUsage, null); assert.equal(exhausted.usage.cost, null);
  assert.equal(reserveDispatch(ledger, now + WINDOW_MS).allowed, true);
  assert.match(formatDispatchNotice(exhausted.usage), /Token usage and subscription allowance are unavailable/);
  assert.equal(reserveDispatch(ledger, 0).allowed, false);
});

test('OpenAI index adapter matches exact public IDs and rejects conflicts and aliases', async () => {
  const { parseOpenAIIndex } = await import('../dist/evidence/sources/openai.js');
  const text = '- [Model A](/api/docs/models/model-a.md): Provider describes coding ability.\n- [Other](/api/docs/models/model-ab.md): Different model.\n';
  const packets = parseOpenAIIndex(text, ['model-a', 'model', '../model-a']);
  assert.deepEqual(packets.map(item => item.modelID), ['model-a']);
  assert.match(packets[0].sources[0].text, /coding ability/);
  assert.deepEqual(parseOpenAIIndex(text + '- [Model A](/api/docs/models/model-a.md): Contradictory entry.\n', ['model-a']), []);
});

test('OpenAI index fetch is fixed-host, bounded and rejects redirects or other content types', async () => {
  const { fetchOpenAIIndex, OPENAI_MODEL_INDEX } = await import('../dist/evidence/sources/openai.js');
  let target;
  const body = '- [Model A](/api/docs/models/model-a.md): Test description.';
  assert.equal(await fetchOpenAIIndex(undefined, async (url, options) => { target = url; assert.equal(options.redirect, 'error'); return new Response(body, { headers: { 'content-type': 'text/markdown; charset=utf-8' } }); }), body);
  assert.equal(target, OPENAI_MODEL_INDEX);
  await assert.rejects(fetchOpenAIIndex(undefined, async () => new Response('wrong', { headers: { 'content-type': 'text/html' } })));
  await assert.rejects(fetchOpenAIIndex(undefined, async () => new Response('x'.repeat(512 * 1024 + 1), { headers: { 'content-type': 'text/markdown' } })));
});

test('worker deduplicates a changed public batch, reports a dispatch and caches only valid results', async () => {
  const { AssessmentWorker } = await import('../dist/evidence/worker.js');
  const { ControlStore } = await import('../dist/controls/index.js');
  let calls = 0; const notices = []; const cache = new Map();
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const publicPacket = { modelID: 'model-a', sources: [{ id: 'openai-model-index', url: 'https://developers.openai.com/api/docs/models.md', text: 'The model supports coding and analysis.' }] };
  const worker = new AssessmentWorker({ controls, reserve: async () => ({ allowed: true, usage: { dispatchesInWindow: 1, limit: 4, nextEligibleAt: null, tokenUsage: null, cost: null } }), cached: async key => cache.has(key), save: async rows => { for (const row of rows) cache.set(row.fingerprint, row.assessment); }, generate: async (_classifier, prompt) => { calls++; assert.ok(prompt.includes('model-a')); return JSON.stringify({ assessments: [{ modelID: 'model-a', basis: 'sourced', suitability: 'middle', references: [{ sourceID: 'openai-model-index', quote: 'supports coding' }] }] }); }, notify: message => notices.push(message) });
  const classifier = { modelID: 'judge', calibrationVersion: 'test-v1' };
  assert.equal(await worker.run([publicPacket], classifier), 'saved'); assert.equal(calls, 1); assert.equal(notices.length, 1); assert.match(notices[0], /unavailable/);
  assert.equal(await worker.run([publicPacket], classifier), 'unchanged'); assert.equal(calls, 1);
});

test('worker does not dispatch when controls are off, budget exhausted or identity is unsafe', async () => {
  const { AssessmentWorker } = await import('../dist/evidence/worker.js');
  const { ControlStore } = await import('../dist/controls/index.js');
  let mode = 'off', allowed = true, calls = 0;
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode, profile: 'balanced' } }));
  const usage = { dispatchesInWindow: 0, limit: 4, nextEligibleAt: null, tokenUsage: null, cost: null };
  const worker = new AssessmentWorker({ controls, reserve: async () => ({ allowed, usage }), cached: async () => false, save: async () => {}, generate: async () => { calls++; return '{}'; }, notify: () => {} });
  const classifier = { modelID: 'judge', calibrationVersion: 'test' };
  const safe = { modelID: 'model-a', sources: [{ id: 'openai-model-index', url: 'https://developers.openai.com/api/docs/models.md', text: 'Some public facts.' }] };
  assert.equal(await worker.run([safe], classifier), 'disabled'); mode = 'auto'; allowed = false;
  assert.equal(await worker.run([safe], classifier), 'limited'); allowed = true;
  assert.equal(await worker.run([{ ...safe, modelID: '../secret' }], classifier), 'invalid'); assert.equal(calls, 0);
});

test('worker invalidates a pending dispatch when off is accepted before issuance', async () => {
  const { AssessmentWorker } = await import('../dist/evidence/worker.js');
  const { ControlStore } = await import('../dist/controls/index.js');
  let mode = 'auto', finish; let calls = 0;
  const pendingReservation = new Promise(resolve => { finish = resolve; });
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode, profile: 'balanced' } }));
  const worker = new AssessmentWorker({ controls, reserve: () => pendingReservation, cached: async () => false, save: async () => {}, generate: async () => { calls++; return '{}'; }, notify: () => {} });
  const task = worker.run([{ modelID: 'model-a', sources: [] }], { modelID: 'judge', calibrationVersion: 'v1' });
  await new Promise(resolve => setImmediate(resolve));
  mode = 'off'; await controls.refresh();
  finish({ allowed: true, usage: { dispatchesInWindow: 1, limit: 4, nextEligibleAt: null, tokenUsage: null, cost: null } });
  assert.equal(await task, 'disabled'); assert.equal(calls, 0);
});

test('worker discards malformed output and late responses after unload', async () => {
  const { AssessmentWorker } = await import('../dist/evidence/worker.js');
  const { ControlStore } = await import('../dist/controls/index.js');
  let finish, saves = 0; const result = new Promise(resolve => { finish = resolve; });
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const worker = new AssessmentWorker({ controls, reserve: async () => ({ allowed: true, usage: { dispatchesInWindow: 1, limit: 4, nextEligibleAt: null, tokenUsage: null, cost: null } }), cached: async () => false, save: async () => { saves++; }, generate: () => result, notify: () => {} });
  const promise = worker.run([{ modelID: 'model-a', sources: [] }], { modelID: 'judge', calibrationVersion: 'v1' });
  await new Promise(resolve => setImmediate(resolve)); worker.dispose(); finish('{invalid');
  assert.equal(await promise, 'invalid'); assert.equal(saves, 0);
});
