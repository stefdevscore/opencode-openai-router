import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CatalogStore } from '../dist/catalog/store.js';
import { ControlStore } from '../dist/controls/index.js';
import { discoveryKey } from '../dist/evidence/discovery.js';
import { EvidenceStore } from '../dist/evidence/store.js';
import { EvidencePipeline } from '../dist/evidence/pipeline.js';
import { PublicEvidenceResolver } from '../dist/evidence/resolver.js';

const model = (id, modelID) => ({ providerID: 'openai', id, modelID, enabled: true, status: 'active', variants: [] });

test('pipeline joins complete catalog, cached public evidence and one isolated batch', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'router-pipeline-'));
  const store = new EvidenceStore(path.join(dir, 'state.sqlite'));
  let models = [model('base', 'public-base')], fetches = 0, clock = 100, index = '- [Base](/api/docs/models/public-base.md): Existing model.\n'; const prompts = [], notices = [];
  const catalog = new CatalogStore({ providers: async () => ({ data: [{ id: 'openai' }] }), models: async () => ({ data: models }), connected: async () => true });
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const resolver = new PublicEvidenceResolver({ now: () => clock, cacheMs: 1, fetchIndex: async () => { fetches++; return index; } });
  const classifier = { modelID: 'judge', calibrationVersion: 'fake-eval', promptVersion: 'test-v1' };
  const pipeline = new EvidencePipeline({ catalog, authoritativeCatalog: true, controls, resolver, store, classifier: () => classifier, now: () => 100, limit: 4, notify: usage => notices.push(usage), generate: (_classifier, prompt) => { prompts.push(prompt); return Promise.resolve(JSON.stringify({ assessments: ['public-a', 'public-b'].map(modelID => ({ modelID, basis: 'provisional', suitability: 'unknown', references: [] })) })); } });
  try {
    await catalog.refresh(); assert.equal(await pipeline.observe(), 'baseline'); assert.equal(fetches, 1); assert.equal(prompts.length, 0);
    clock++; index += '- [A](/api/docs/models/public-a.md): Model A supports coding.\n- [B](/api/docs/models/public-b.md): Model B supports coding.\n';
    models = [...models, model('private-alias-a', 'public-a'), model('private-alias-b', 'public-b')]; catalog.invalidate(); await catalog.refresh();
    assert.equal(await pipeline.observe(), 'issued'); assert.equal(fetches, 2); assert.equal(prompts.length, 1); assert.equal(notices.length, 1);
    assert.ok(!prompts[0].includes('private-alias')); assert.ok(prompts[0].includes('public-a'));
    assert.equal(store.assessment(discoveryKey('openai', 'private-alias-a')).assessment.modelID, 'public-a');
    assert.equal(await pipeline.observe(), 'idle'); assert.equal(prompts.length, 1);
  } finally { pipeline.dispose(); resolver.dispose(); controls.dispose(); catalog.dispose(); store.close(); await rm(dir, { recursive: true, force: true }); }
});

test('pipeline does not establish a baseline without a proven host readiness signal', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'router-pipeline-')); const store = new EvidenceStore(path.join(dir, 'state.sqlite'));
  const catalog = new CatalogStore({ providers: async () => ({ data: [{ id: 'openai' }] }), models: async () => ({ data: [model('base', 'public-base')] }), connected: async () => true });
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const resolver = new PublicEvidenceResolver({ fetchIndex: async () => { throw Error('must not fetch'); } });
  const pipeline = new EvidencePipeline({ catalog, authoritativeCatalog: false, controls, resolver, store, classifier: () => null, now: () => 100, limit: 4, notify: () => {}, generate: async () => { throw Error('must not run'); } });
  try { await catalog.refresh(); assert.equal(await pipeline.observe(), 'unavailable'); assert.equal(store.snapshot().baselined, false); }
  finally { pipeline.dispose(); resolver.dispose(); controls.dispose(); catalog.dispose(); store.close(); await rm(dir, { recursive: true, force: true }); }
});

test('host startup refresh does not classify a model already in the public baseline', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'router-pipeline-')); const store = new EvidenceStore(path.join(dir, 'state.sqlite'));
  let models = [model('base', 'public-base')], calls = 0;
  const catalog = new CatalogStore({ providers: async () => ({ data: [{ id: 'openai' }] }), models: async () => ({ data: models }), connected: async () => true });
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const resolver = new PublicEvidenceResolver({ fetchIndex: async () => '- [Base](/api/docs/models/public-base.md): Existing.\n- [Old](/api/docs/models/public-old.md): Existing.\n' });
  const pipeline = new EvidencePipeline({ catalog, authoritativeCatalog: true, controls, resolver, store, classifier: () => ({ modelID: 'judge', calibrationVersion: 'test', promptVersion: 'test' }), now: () => 100, limit: 4, notify: () => {}, generate: async () => { calls++; return '{}'; } });
  try {
    await catalog.refresh(); assert.equal(await pipeline.observe(), 'baseline');
    models = [...models, model('old-host-alias', 'public-old')]; catalog.invalidate(); await catalog.refresh();
    assert.equal(await pipeline.observe(), 'idle'); assert.equal(calls, 0); assert.deepEqual(store.snapshot().work, {});
  } finally { pipeline.dispose(); resolver.dispose(); controls.dispose(); catalog.dispose(); store.close(); await rm(dir, { recursive: true, force: true }); }
});

test('offline or malformed public source cannot initialize or reset a baseline', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'router-pipeline-')); const store = new EvidenceStore(path.join(dir, 'state.sqlite'));
  const catalog = new CatalogStore({ providers: async () => ({ data: [{ id: 'openai' }] }), models: async () => ({ data: [model('base', 'public-base')] }), connected: async () => true });
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const resolver = new PublicEvidenceResolver({ fetchIndex: async () => 'unsupported source format' }); let calls = 0;
  const pipeline = new EvidencePipeline({ catalog, authoritativeCatalog: true, controls, resolver, store, classifier: () => ({ modelID: 'judge', calibrationVersion: 'test', promptVersion: 'test' }), now: () => 100, limit: 4, notify: () => {}, generate: async () => { calls++; return '{}'; } });
  try { await catalog.refresh(); assert.equal(await pipeline.observe(), 'unavailable'); assert.equal(store.snapshot().baselined, false); assert.equal(calls, 0); }
  finally { pipeline.dispose(); resolver.dispose(); controls.dispose(); catalog.dispose(); store.close(); await rm(dir, { recursive: true, force: true }); }
});
