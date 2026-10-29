import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogStore } from '../dist/catalog/store.js';
import { EvidenceCatalog } from '../dist/evidence/catalog.js';

const model = id => ({ providerID: 'openai', id, enabled: true, status: 'active', limit: {}, capabilities: {}, variants: [] });

test('evidence catalog requires proven completeness and rejects changed or invalidated inventory', async () => {
  let models = [model('a')], connected = true, clock = 100;
  const store = new CatalogStore({ providers: async () => ({ data: [{ id: 'openai' }] }), models: async () => ({ data: models }), connected: async () => connected }, () => clock);
  const unproven = new EvidenceCatalog(store, false); const adapter = new EvidenceCatalog(store, true);
  await store.refresh(); assert.equal(unproven.capture(), null);
  const first = adapter.capture(); assert.deepEqual(first.modelIDs, ['a']); assert.equal(adapter.isCurrent(first), true);
  assert.equal(adapter.isCurrent({ ...first, modelIDs: ['other'] }), false);
  store.invalidate(); assert.equal(adapter.isCurrent(first), false);
  await store.refresh(); const second = adapter.capture(); assert.equal(adapter.isCurrent(second), true);
  models = [model('b')]; clock++; await store.refresh(); assert.equal(adapter.isCurrent(second), false);
  const third = adapter.capture(); connected = false; await store.refresh(); assert.equal(adapter.isCurrent(third), false); assert.equal(adapter.capture(), null);
});

test('lost event monitoring and expired catalogs cannot authorize evidence work', async () => {
  let clock = 100; const store = new CatalogStore({ providers: async () => ({ data: [{ id: 'openai' }] }), models: async () => ({ data: [model('a')] }), connected: async () => true }, () => clock);
  const adapter = new EvidenceCatalog(store, true); await store.refresh(); const first = adapter.capture();
  clock += 60_001; assert.equal(adapter.isCurrent(first), false);
  await store.refresh(); const second = adapter.capture(); store.monitoringLost(); assert.equal(adapter.isCurrent(second), false);
});
