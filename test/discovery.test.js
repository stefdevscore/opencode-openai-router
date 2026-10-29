import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryKey, emptyDiscovery, observeInventory, parseDiscovery, recoverDiscovery, transitionWork } from '../dist/evidence/discovery.js';

test('only identities added after a complete baseline create pending work', () => {
  let state = emptyDiscovery();
  state = observeInventory(state, { complete: false, modelIDs: ['a'] }).state;
  assert.equal(state.baselined, false);
  let result = observeInventory(state, { complete: true, modelIDs: ['a', 'b'] });
  assert.deepEqual(result.added, []);
  state = result.state;
  assert.deepEqual(observeInventory(state, { complete: false, modelIDs: ['a', 'b', 'c'] }).added, []);
  result = observeInventory(state, { complete: true, modelIDs: ['a', 'b', 'c'] });
  const key = discoveryKey('openai', 'c');
  assert.deepEqual(result.added, [key]);
  assert.equal(result.state.work[key], 'pending');
  state = JSON.parse(JSON.stringify(result.state));
  state = observeInventory(state, { complete: true, modelIDs: ['a'] }).state;
  assert.deepEqual(observeInventory(state, { complete: true, modelIDs: ['a', 'b', 'c'] }).added, []);
  assert.ok(!JSON.stringify(state).includes('"c"'));
});

test('issued work becomes unknown on restart and cannot be sent again blindly', () => {
  const baseline = observeInventory(emptyDiscovery(), { complete: true, modelIDs: [] }).state;
  const discovered = observeInventory(baseline, { complete: true, modelIDs: ['new'] });
  const issued = transitionWork(discovered.state, discovered.added, 'pending', 'issued');
  const recovered = recoverDiscovery(issued);
  assert.equal(recovered.work[discovered.added[0]], 'unknown');
  assert.throws(() => transitionWork(recovered, discovered.added, 'unknown', 'pending'));
  assert.equal(transitionWork(recovered, discovered.added, 'unknown', 'complete').work[discovered.added[0]], 'complete');
});

test('invalid inventories and corrupt state do not reset the discovery baseline', () => {
  const initial = emptyDiscovery();
  assert.throws(() => observeInventory(initial, { complete: true, modelIDs: ['a', 'a'] }));
  assert.equal(parseDiscovery({ ...initial, baselined: false, seen: [discoveryKey('openai', 'a')] }), null);
  assert.equal(parseDiscovery({ ...initial, work: { not_a_key: 'pending' } }), null);
});

test('public models known at first baseline do not trigger classification when host catches up', () => {
  let state = observeInventory(emptyDiscovery(), { complete: true, modelIDs: ['base'], sourceBaseline: ['existing-public'] }).state;
  const result = observeInventory(state, { complete: true, modelIDs: ['base', 'new-host-alias'], publicIDs: { 'new-host-alias': 'existing-public' } });
  assert.deepEqual(result.added, []); assert.deepEqual(result.state.work, {});
  state = JSON.parse(JSON.stringify(result.state));
  const next = observeInventory(state, { complete: true, modelIDs: ['base', 'new-host-alias', 'later'], publicIDs: { 'new-host-alias': 'existing-public', later: 'new-public' } });
  assert.equal(next.added.length, 1); assert.equal(next.state.work[discoveryKey('openai', 'later')], 'pending');
});

test('a pending alias is resolved without inference if it later maps to baseline evidence', () => {
  const baseline = observeInventory(emptyDiscovery(), { complete: true, modelIDs: ['base'], sourceBaseline: ['existing-public'] }).state;
  const pending = observeInventory(baseline, { complete: true, modelIDs: ['base', 'alias'] }).state;
  assert.equal(pending.work[discoveryKey('openai', 'alias')], 'pending');
  const mapped = observeInventory(pending, { complete: true, modelIDs: ['base', 'alias'], publicIDs: { alias: 'existing-public' } }).state;
  assert.deepEqual(mapped.work, {});
});
