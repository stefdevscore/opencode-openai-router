import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeV2Catalog } from '../dist/catalog/index.js';
import { CatalogStore } from '../dist/catalog/store.js';
const model = (id = 'a', extra = {}) => ({ providerID: 'openai', id, enabled: true, status: 'active', limit: { context: 1000, input: 900, output: 100 }, capabilities: { tools: true, input: ['text', 'image'], output: ['text'] }, variants: [{ id: 'deep', settings: { reasoningEffort: 'high' } }, { id: 'custom', settings: { reasoningEffort: 'low', temperature: 1 } }], ...extra });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('normalizes limits, capabilities, exact variants and ignores disabled or other providers', () => {
  const result = normalizeV2Catalog({ data: [model(), model('off', { enabled: false }), model('other', { providerID: 'local' }), model('retired', { status: 'deprecated' })] });
  assert.equal(result.status, 'available'); assert.equal(result.complete, true); assert.equal(result.models.length, 1);
  assert.deepEqual(result.models[0], { id: 'a', providerID: 'openai', contextLimit: 1000, inputLimit: 900, outputLimit: 100, toolCalls: true, inputModalities: ['text', 'image'], outputModalities: ['text'], variants: [{ name: 'deep', reasoningEffort: 'high', settings: { reasoningEffort: 'high' }, effortOnly: true }, { name: 'custom', reasoningEffort: 'low', settings: { reasoningEffort: 'low', temperature: 1 }, effortOnly: false }] });
  const unknown = normalizeV2Catalog({ data: [model('unknown', { limit: { context: -1, output: 'bad' }, capabilities: { tools: 'yes', input: null }, variants: [{ id: 'x', settings: { reasoningEffort: 4 } }] })] });
  assert.equal(unknown.models[0].contextLimit, null); assert.equal(unknown.models[0].toolCalls, null); assert.equal(unknown.models[0].inputModalities, null); assert.equal(unknown.models[0].variants, null);
  assert.equal(normalizeV2Catalog({ data: [model(), model()] }).reason, 'invalid_response');
  assert.equal(normalizeV2Catalog({ data: [null] }).reason, 'invalid_response');
  assert.equal(normalizeV2Catalog({ data: [model('x', { status: 'unknown' })] }).complete, false);
});

test('tracks host availability and connection separately and never treats errors as an empty complete result', async () => {
  let provider = [{ id: 'openai', integrationID: 'custom-openai' }], models = [model()], connected = true, fail = false, queried;
  const store = new CatalogStore({ providers: async () => ({ data: provider }), models: async () => { if (fail) throw Error('private'); return { data: models }; }, connected: async id => { queried = id; return connected; } });
  let result = await store.refresh(); assert.equal(queried, 'custom-openai'); assert.equal(result.status, 'ready'); assert.equal(store.fresh(), true);
  connected = false; result = await store.refresh(); assert.equal(result.status, 'disconnected'); assert.equal(result.hostAvailable, true); assert.equal(result.connected, false); assert.equal(store.fresh(), false);
  connected = true; models = []; result = await store.refresh(); assert.deepEqual(result.catalog, { status: 'available', complete: true, models: [] });
  models = [model('new')]; result = await store.refresh(); assert.equal(result.catalog.models[0].id, 'new');
  fail = true; result = await store.refresh(); assert.equal(result.status, 'unavailable'); assert.equal(result.catalog.models[0].id, 'new'); assert.equal(store.fresh(), false);
  fail = false; provider = []; result = await store.refresh(); assert.equal(result.hostAvailable, false); assert.equal(result.connected, null); assert.equal(result.catalog, null);
});

test('refresh is single-flight, invalidation discards late results, and freshness expires', async () => {
  let clock = 100; const slow = deferred(); let calls = 0;
  const store = new CatalogStore({ providers: async () => ({ data: [{ id: 'openai' }] }), models: () => { calls++; return calls === 1 ? slow.promise : Promise.resolve({ data: [model('new')] }); }, connected: async () => true }, () => clock);
  const first = store.refresh(), shared = store.refresh(); assert.equal(first, shared); assert.equal(calls, 1);
  store.invalidate(); const current = await store.refresh(); assert.equal(current.catalog.models[0].id, 'new');
  slow.resolve({ data: [model('old')] }); await first; assert.equal(store.snapshot().catalog.models[0].id, 'new');
  assert.equal(store.fresh(), true); clock += 60_001; assert.equal(store.fresh(), false); store.dispose(); assert.equal(store.fresh(), false);
});

test('a lost change-event stream prevents a later refresh from being treated as fresh', async () => {
  const store = new CatalogStore({ providers: async () => ({ data: [{ id: 'openai' }] }), models: async () => ({ data: [model()] }), connected: async () => true });
  await store.refresh(); assert.equal(store.fresh(), true);
  store.monitoringLost(); assert.equal(store.fresh(), false);
  const refreshed = await store.refresh(); assert.equal(refreshed.status, 'ready'); assert.equal(store.fresh(), false);
});
