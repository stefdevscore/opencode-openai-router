import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { EvidenceStore } from '../dist/evidence/store.js';
import { EvidenceScheduler } from '../dist/evidence/scheduler.js';
import { ControlStore } from '../dist/controls/index.js';

const records = ids => ids.map(modelID => ({ hostID: modelID, packet: { modelID, sources: [] }, classifier: { modelID: 'judge', calibrationVersion: 'cal-v1', promptVersion: 'prompt-v1' }, retrievedAt: 100, assessment: { modelID, basis: 'provisional', suitability: 'unknown', references: [] } }));

async function fixture(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'router-scheduler-'));
  const store = new EvidenceStore(path.join(dir, 'state.sqlite'));
  try { await run(store); } finally { store.close(); await rm(dir, { recursive: true, force: true }); }
}

test('baseline and refreshes are free, new IDs batch, and direct evidence needs no inference', async () => fixture(async store => {
  const calls = [], notices = [];
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const scheduler = new EvidenceScheduler({ store, controls, isCurrent: () => true, resolve: async id => id === 'direct' ? 'direct' : 'needs-inference', dispatch: async ids => { calls.push(ids); return records(ids); }, notify: notice => notices.push(notice), now: () => 1000, limit: 4 });
  assert.equal(await scheduler.observe({ complete: false, modelIDs: ['base'] }), 'unavailable');
  assert.equal(await scheduler.observe({ complete: true, modelIDs: ['base'] }), 'baseline');
  assert.equal(await scheduler.observe({ complete: true, modelIDs: ['base'] }), 'idle');
  assert.equal(await scheduler.observe({ complete: true, modelIDs: ['base', 'direct'] }), 'idle');
  assert.deepEqual(calls, []);
  assert.equal(await scheduler.observe({ complete: true, modelIDs: ['base', 'direct', 'new-a', 'new-b'] }), 'issued');
  assert.deepEqual(calls, [['new-a', 'new-b']]);
  assert.equal(notices.length, 1);
  assert.equal(await scheduler.observe({ complete: true, modelIDs: ['base'] }), 'idle');
  assert.equal(await scheduler.observe({ complete: true, modelIDs: ['base', 'direct', 'new-a', 'new-b'] }), 'idle');
  assert.equal(calls.length, 1);
}));

test('failed dispatched work is unknown and not retried on refresh or restart', async () => fixture(async store => {
  let calls = 0;
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const deps = { store, controls, isCurrent: () => true, resolve: async () => 'needs-inference', dispatch: async () => { calls++; throw Error('timeout'); }, notify: () => {}, now: () => 1000, limit: 4 };
  const scheduler = new EvidenceScheduler(deps);
  await scheduler.observe({ complete: true, modelIDs: ['base'] });
  assert.equal(await scheduler.observe({ complete: true, modelIDs: ['base', 'new'] }), 'unknown');
  const restarted = new EvidenceScheduler(deps);
  assert.equal(await restarted.observe({ complete: true, modelIDs: ['base', 'new'] }), 'idle');
  assert.equal(calls, 1);
}));

test('disable before issuance returns reserved work to pending without a notice', async () => fixture(async store => {
  let mode = 'auto', calls = 0, notices = 0;
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode, profile: 'balanced' } }));
  const scheduler = new EvidenceScheduler({ store, controls, isCurrent: () => true, resolve: async () => { mode = 'off'; await controls.refresh(); return 'needs-inference'; }, dispatch: async ids => { calls++; return records(ids); }, notify: () => { notices++; }, now: () => 1000, limit: 4 });
  await scheduler.observe({ complete: true, modelIDs: ['base'] });
  assert.equal(await scheduler.observe({ complete: true, modelIDs: ['base', 'new'] }), 'disabled');
  assert.equal(calls, 0); assert.equal(notices, 0);
  assert.deepEqual(Object.values(store.snapshot().work), ['pending']);
}));

test('a newly added model observed during a dispatch remains queued for the next batch', async () => fixture(async store => {
  let release; const gate = new Promise(resolve => { release = resolve; }); const calls = [];
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const scheduler = new EvidenceScheduler({ store, controls, isCurrent: () => true, resolve: async () => 'needs-inference', dispatch: async ids => { calls.push(ids); if (calls.length === 1) await gate; return records(ids); }, notify: () => {}, now: () => 1000, limit: 4 });
  await scheduler.observe({ complete: true, modelIDs: ['base'] });
  const first = scheduler.observe({ complete: true, modelIDs: ['base', 'new-a'] });
  await new Promise(resolve => setImmediate(resolve));
  const second = scheduler.observe({ complete: true, modelIDs: ['base', 'new-a', 'new-b'] });
  release();
  assert.deepEqual(await Promise.all([first, second]), ['issued', 'issued']);
  assert.deepEqual(calls, [['new-a'], ['new-b']]);
}));

test('a result arriving after disable is not persisted', async () => fixture(async store => {
  let mode = 'auto', release; const gate = new Promise(resolve => { release = resolve; });
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode, profile: 'balanced' } }));
  const scheduler = new EvidenceScheduler({ store, controls, isCurrent: () => true, resolve: async () => 'needs-inference', dispatch: async ids => { await gate; return records(ids); }, notify: () => {}, now: () => 1000, limit: 4 });
  await scheduler.observe({ complete: true, modelIDs: ['base'] });
  const result = scheduler.observe({ complete: true, modelIDs: ['base', 'new'] });
  await new Promise(resolve => setImmediate(resolve));
  mode = 'off'; await controls.refresh(); release();
  assert.equal(await result, 'unknown');
  const state = store.snapshot(); const key = Object.keys(state.work)[0];
  assert.equal(state.work[key], 'unknown'); assert.equal(store.assessment(key), null);
}));

test('stale catalog or connection prevents dispatch before reservation', async () => fixture(async store => {
  let calls = 0, current = true;
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const scheduler = new EvidenceScheduler({ store, controls, isCurrent: () => current, resolve: async () => { current = false; return 'needs-inference'; }, dispatch: async ids => { calls++; return records(ids); }, notify: () => {}, now: () => 1000, limit: 4 });
  await scheduler.observe({ complete: true, modelIDs: ['base'] });
  assert.equal(await scheduler.observe({ complete: true, modelIDs: ['base', 'new'] }), 'unavailable');
  assert.equal(calls, 0); assert.deepEqual(Object.values(store.snapshot().work), ['pending']);
}));

test('a stale inventory cannot establish a baseline or record new models', async () => fixture(async store => {
  let current = false;
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const scheduler = new EvidenceScheduler({ store, controls, isCurrent: () => current, resolve: async () => 'needs-inference', dispatch: async ids => records(ids), notify: () => {}, now: () => 1000, limit: 4 });
  assert.equal(await scheduler.observe({ complete: true, modelIDs: ['stale'] }), 'unavailable');
  assert.equal(store.snapshot().baselined, false);
  current = true; assert.equal(await scheduler.observe({ complete: true, modelIDs: ['base'] }), 'baseline');
  current = false; assert.equal(await scheduler.observe({ complete: true, modelIDs: ['base', 'stale-new'] }), 'unavailable');
  assert.deepEqual(store.snapshot().work, {});
}));

test('stale catalog or connection after dispatch prevents committing the result', async () => fixture(async store => {
  let current = true, release; const gate = new Promise(resolve => { release = resolve; });
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const scheduler = new EvidenceScheduler({ store, controls, isCurrent: () => current, resolve: async () => 'needs-inference', dispatch: async ids => { await gate; return records(ids); }, notify: () => {}, now: () => 1000, limit: 4 });
  await scheduler.observe({ complete: true, modelIDs: ['base'] });
  const result = scheduler.observe({ complete: true, modelIDs: ['base', 'new'] });
  await new Promise(resolve => setImmediate(resolve)); current = false; release();
  assert.equal(await result, 'unknown');
  const state = store.snapshot(); const key = Object.keys(state.work)[0];
  assert.equal(state.work[key], 'unknown'); assert.equal(store.assessment(key), null);
}));

test('unavailable early models do not starve later models and large batches continue automatically', async () => fixture(async store => {
  const calls = [];
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const scheduler = new EvidenceScheduler({ store, controls, isCurrent: () => true, resolve: async id => id.startsWith('unavailable-') ? 'unavailable' : 'needs-inference', dispatch: async ids => { calls.push(ids); return records(ids); }, notify: () => {}, now: () => 1000, limit: 4 });
  const unavailable = Array.from({ length: 16 }, (_, i) => `unavailable-${i}`);
  const eligible = Array.from({ length: 17 }, (_, i) => `model-${i}`);
  await scheduler.observe({ complete: true, modelIDs: ['base'] });
  const inventory = { complete: true, modelIDs: ['base', ...unavailable, ...eligible] };
  assert.equal(await scheduler.observe(inventory), 'deferred');
  assert.ok(['issued', 'deferred'].includes(await scheduler.observe(inventory)));
  assert.deepEqual(calls.map(batch => batch.length), [16, 1]);
  assert.deepEqual(calls.flat(), eligible);
}));

test('a run bounds lookups and a later scan resumes past unavailable models', async () => fixture(async store => {
  let lookups = 0; const calls = [];
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const scheduler = new EvidenceScheduler({ store, controls, isCurrent: () => true, resolve: async id => { lookups++; return id === 'last' ? 'needs-inference' : 'unavailable'; }, dispatch: async ids => { calls.push(ids); return records(ids); }, notify: () => {}, now: () => 1000, limit: 4 });
  await scheduler.observe({ complete: true, modelIDs: ['base'] });
  const inventory = { complete: true, modelIDs: ['base', ...Array.from({ length: 70 }, (_, i) => `unavailable-${i}`), 'last'] };
  assert.equal(await scheduler.observe(inventory), 'deferred'); assert.equal(lookups, 32);
  assert.equal(await scheduler.observe(inventory), 'deferred'); assert.equal(lookups, 64);
  const final = await scheduler.observe(inventory);
  assert.ok(final === 'issued' || final === 'deferred');
  assert.deepEqual(calls, [['last']]);
  assert.ok(lookups <= 96);
}));

test('hung lookup is skipped and a hung dispatch becomes unknown without blocking later observations', async () => fixture(async store => {
  let calls = 0;
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const scheduler = new EvidenceScheduler({ store, controls, isCurrent: () => true, resolveTimeoutMs: 10, dispatchTimeoutMs: 10, resolve: id => id === 'hang-lookup' ? new Promise(() => {}) : Promise.resolve('needs-inference'), dispatch: async ids => { calls++; if (ids.includes('hang-dispatch')) return new Promise(() => {}); return records(ids); }, notify: () => {}, now: () => 1000, limit: 4 });
  await scheduler.observe({ complete: true, modelIDs: ['base'] });
  assert.equal(await scheduler.observe({ complete: true, modelIDs: ['base', 'hang-lookup', 'hang-dispatch'] }), 'unknown');
  assert.equal(await scheduler.observe({ complete: true, modelIDs: ['base', 'hang-lookup', 'hang-dispatch', 'next'] }), 'issued');
  assert.equal(calls, 2);
  assert.equal(Object.values(store.snapshot().work).filter(status => status === 'unknown').length, 1);
}));

test('disposing a scheduler stops waiting for an issued request and preserves an unknown outcome', async () => fixture(async store => {
  let start; const started = new Promise(resolve => { start = resolve; });
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const scheduler = new EvidenceScheduler({ store, controls, isCurrent: () => true, resolve: async () => 'needs-inference', dispatch: () => { start(); return new Promise(() => {}); }, notify: () => {}, now: () => 1000, limit: 4 });
  await scheduler.observe({ complete: true, modelIDs: ['base'] });
  const result = scheduler.observe({ complete: true, modelIDs: ['base', 'new'] });
  await started; scheduler.dispose();
  assert.equal(await result, 'unknown');
  assert.deepEqual(Object.values(store.snapshot().work), ['unknown']);
}));

test('failed preflight cannot reserve usage or emit a dispatch notice', async () => fixture(async store => {
  let calls = 0, notices = 0;
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const scheduler = new EvidenceScheduler({ store, controls, isCurrent: () => true, resolve: async () => 'needs-inference', prepareDispatch: () => { throw Error('preflight failed'); }, dispatch: async ids => { calls++; return records(ids); }, notify: () => { notices++; }, now: () => 1000, limit: 4 });
  await scheduler.observe({ complete: true, modelIDs: ['base'] });
  assert.equal(await scheduler.observe({ complete: true, modelIDs: ['base', 'new'] }), 'unavailable');
  assert.equal(calls, 0); assert.equal(notices, 0); assert.deepEqual(store.notices(), []);
  assert.deepEqual(Object.values(store.snapshot().work), ['pending']);
}));

test('a synchronous host error produces an unknown notice rather than claiming a dispatch succeeded', async () => fixture(async store => {
  const notices = [];
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } }));
  const scheduler = new EvidenceScheduler({ store, controls, isCurrent: () => true, resolve: async () => 'needs-inference', dispatch: () => { throw Error('uncertain'); }, notify: (_usage, status) => notices.push(status), now: () => 1000, limit: 4 });
  await scheduler.observe({ complete: true, modelIDs: ['base'] });
  assert.equal(await scheduler.observe({ complete: true, modelIDs: ['base', 'new'] }), 'unknown');
  assert.deepEqual(notices, ['unknown']);
  assert.equal(store.notices()[0].status, 'unknown');
}));
