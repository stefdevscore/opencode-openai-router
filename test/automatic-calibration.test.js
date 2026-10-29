import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CatalogStore } from '../dist/catalog/store.js';
import { ControlStore } from '../dist/controls/index.js';
import { EvidenceStore } from '../dist/evidence/store.js';
import { EvidencePipeline } from '../dist/evidence/pipeline.js';
import { PublicEvidenceResolver } from '../dist/evidence/resolver.js';

for (const rejection of ['malformed', 'provider', 'labels']) {
test(`automatic calibration replaces ${rejection} rejection, persists the pass and replaces a retired classifier`, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'router-auto-cal-')); const store = new EvidenceStore(path.join(root, 'evidence.sqlite'));
  const model = id => ({ providerID: 'openai', id, modelID: id, enabled: true, status: 'active', capabilities: { input: ['text'], output: ['text'] }, variants: [] });
  let models = [model('a-judge'), model('b-judge')], clock = 100, index = '- [Judge](/api/docs/models/b-judge.md): Existing model.\n';
  const calls = []; const notices = [];
  const catalog = new CatalogStore({ providers: async () => ({ data: [{ id: 'openai' }] }), models: async () => ({ data: models }), connected: async () => true });
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const resolver = new PublicEvidenceResolver({ now: () => clock, cacheMs: 1, fetchIndex: async () => index });
  const deps = { catalog, controls, resolver, store, now: () => clock, limit: 4, notify: (usage, status) => notices.push({ usage, status }), generate: (classifier, prompt) => {
    const packets = JSON.parse(prompt.slice(prompt.indexOf('\n') + 1)); calls.push({ model: classifier.modelID, ids: packets.map(p => p.modelID) });
    if (classifier.modelID === 'a-judge') {
      if (rejection === 'provider') return Promise.reject({ _tag: 'Generate.ProviderRequestError', reason: 'invalid_request' });
      if (rejection === 'labels') return Promise.resolve(JSON.stringify({ assessments: packets.map(p => ({ modelID: p.modelID, basis: 'provisional', suitability: 'unknown', references: [] })) }));
      return Promise.resolve('{}');
    }
    return Promise.resolve(JSON.stringify({ assessments: packets.map(p => p.modelID === 'router-calibration-supported' ? { modelID: p.modelID, basis: 'sourced', suitability: 'higher', references: [{ sourceID: 'openai-model-index', quote: 'higher suitability' }] } : { modelID: p.modelID, basis: 'provisional', suitability: 'unknown', references: [] }) }));
  } };
  let pipeline = new EvidencePipeline(deps);
  try {
    await catalog.refresh(); assert.equal(await pipeline.observe(), 'baseline'); assert.equal(calls.length, 0);
    models.push(model('target')); index += '- [Target](/api/docs/models/target.md): New target.\n'; clock++; catalog.invalidate(); await catalog.refresh();
    assert.equal(await pipeline.observe(), 'unavailable'); assert.equal(store.notices().length, 1); assert.deepEqual(Object.values(store.snapshot().work), ['pending']);
    assert.equal(await pipeline.observe(), 'issued'); assert.deepEqual(calls.map(c => c.model), ['a-judge', 'b-judge']); assert.ok(calls[1].ids.includes('router-calibration-supported'));
    pipeline.dispose(); pipeline = new EvidencePipeline(deps);
    models.push(model('target-two')); index += '- [Target two](/api/docs/models/target-two.md): New target.\n'; clock++; catalog.invalidate(); await catalog.refresh();
    assert.equal(await pipeline.observe(), 'issued'); assert.equal(calls[2].model, 'b-judge'); assert.deepEqual(calls[2].ids, ['target-two']);
    assert.equal(notices.length, 3); assert.equal(notices[2].usage.dispatchesInWindow, 3);
    models = models.filter(item => item.id !== 'b-judge'); models.push(model('c-judge'), model('target-three'));
    index += '- [Third target](/api/docs/models/target-three.md): New target.\n'; clock++; catalog.invalidate(); await catalog.refresh();
    assert.equal(await pipeline.observe(), 'issued'); assert.equal(calls[3].model, 'c-judge'); assert.ok(calls[3].ids.includes('router-calibration-supported'));
    assert.equal(notices[3].usage.dispatchesInWindow, 4);
  } finally { pipeline.dispose(); resolver.dispose(); controls.dispose(); catalog.dispose(); store.close(); await rm(root, { recursive: true, force: true }); }
});

}
