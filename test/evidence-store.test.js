import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { EvidenceStore } from '../dist/evidence/store.js';
import { WINDOW_MS } from '../dist/evidence/usage.js';
import { evidenceFingerprint } from '../dist/evidence/assessment.js';

async function directory(run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'router-store-'));
  try { await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('atomic reservations survive restarts and enforce a shared cross-process limit', async () => directory(async dir => {
  const file = path.join(dir, 'state.sqlite');
  const store = new EvidenceStore(file);
  store.observe({ complete: true, modelIDs: ['baseline'] });
  const keys = store.observe({ complete: true, modelIDs: ['baseline', ...Array.from({ length: 10 }, (_, i) => `model-${i}`)] });
  store.close();
  const moduleURL = new URL('../dist/evidence/store.js', import.meta.url).href;
  const code = `import { EvidenceStore } from ${JSON.stringify(moduleURL)}; const s = new EvidenceStore(process.argv[1]); try { console.log(JSON.stringify(s.reserve([process.argv[2]], 100000000, 4))); } finally { s.close(); }`;
  const results = await Promise.all(keys.map(key => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code, file, key], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', error = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve(JSON.parse(output)) : reject(new Error(error)));
  })));
  assert.equal(results.filter(item => item.allowed).length, 4);
  const reopened = new EvidenceStore(file);
  const state = reopened.snapshot();
  assert.equal(Object.values(state.work).filter(value => value === 'issued').length, 4);
  assert.equal(Object.values(state.work).filter(value => value === 'pending').length, 6);
  assert.equal(reopened.reserve(keys.filter(key => state.work[key] === 'pending').slice(0, 1), 1, 4).allowed, false);
  reopened.close();
}));

test('corrupt or missing state is not silently replaced by a new baseline', async () => directory(async dir => {
  const file = path.join(dir, 'state.sqlite');
  const store = new EvidenceStore(file); store.observe({ complete: true, modelIDs: ['a'] }); store.close();
  const db = new DatabaseSync(file);
  db.prepare('UPDATE router_state SET value = ? WHERE id = 1').run('{bad json'); db.close();
  const reopened = new EvidenceStore(file); assert.throws(() => reopened.snapshot()); reopened.close();
  const db2 = new DatabaseSync(file); db2.exec('DELETE FROM router_state'); db2.close();
  const empty = new EvidenceStore(file); assert.throws(() => empty.snapshot(), /missing state/); empty.close();
}));

test('failed transactions do not consume a reservation and the limit renews', async () => directory(async dir => {
  const store = new EvidenceStore(path.join(dir, 'state.sqlite'));
  store.observe({ complete: true, modelIDs: ['a'] });
  const [first, second] = store.observe({ complete: true, modelIDs: ['a', 'b', 'c'] });
  assert.throws(() => store.reserve([first, first], 100, 1));
  assert.equal(store.reserve([first], 100, 1).allowed, true);
  assert.equal(store.reserve([second], 101, 1).allowed, false);
  assert.equal(store.reserve([second], 100 + WINDOW_MS, 1).allowed, true);
  assert.throws(() => store.reserve([first], 100 + 2 * WINDOW_MS, 1));
  store.close();
}));

test('another instance cannot raise the shared dispatch limit', async () => directory(async dir => {
  const file = path.join(dir, 'state.sqlite');
  const first = new EvidenceStore(file); const second = new EvidenceStore(file);
  first.observe({ complete: true, modelIDs: ['base'] });
  const [a, b] = first.observe({ complete: true, modelIDs: ['base', 'a', 'b'] });
  assert.equal(first.reserve([a], 100, 1).allowed, true);
  assert.throws(() => second.reserve([b], 101, 4), /limit mismatch/);
  assert.equal(second.reserve([b], 101, 1).allowed, false);
  first.close(); second.close();
}));

test('old state with reservations but without a recorded shared limit is rejected', async () => directory(async dir => {
  const file = path.join(dir, 'state.sqlite'); const store = new EvidenceStore(file);
  store.observe({ complete: true, modelIDs: ['base'] });
  const [key] = store.observe({ complete: true, modelIDs: ['base', 'new'] });
  store.reserve([key], 100, 1); store.close();
  const db = new DatabaseSync(file);
  const state = JSON.parse(db.prepare('SELECT value FROM router_state WHERE id = 1').get().value);
  delete state.dispatchLimit;
  db.prepare('UPDATE router_state SET value = ? WHERE id = 1').run(JSON.stringify(state)); db.close();
  const reopened = new EvidenceStore(file); assert.throws(() => reopened.snapshot(), /dispatch limit/); reopened.close();
}));

test('only the reservation owner can settle the complete claimed batch across restarts', async () => directory(async dir => {
  const file = path.join(dir, 'state.sqlite'); let store = new EvidenceStore(file);
  store.observe({ complete: true, modelIDs: ['base'] });
  const keys = store.observe({ complete: true, modelIDs: ['base', 'a', 'b'] });
  const claim = store.reserve(keys, 100, 1); store.close();
  store = new EvidenceStore(file);
  assert.throws(() => store.settleClaim('wrong', keys, 'issued', 'pending'), /ownership/);
  assert.throws(() => store.settleClaim(claim.claimID, [keys[0]], 'issued', 'complete'), /ownership/);
  store.settleClaim(claim.claimID, keys, 'issued', 'unknown');
  assert.throws(() => store.settleClaim(claim.claimID, keys, 'unknown', 'pending'), /started dispatch/);
  store.completeAssessments(claim.claimID, ['a', 'b'].map(modelID => ({ hostID: modelID, packet: { modelID, sources: [] }, classifier: { modelID: 'judge', calibrationVersion: 'cal-v1', promptVersion: 'prompt-v1' }, retrievedAt: 100, assessment: { modelID, basis: 'provisional', suitability: 'unknown', references: [] } })));
  assert.equal(store.assessment(keys[0]).assessment.modelID, 'a');
  assert.throws(() => store.settleClaim(claim.claimID, keys, 'issued', 'pending'), /ownership/);
  store.close();
}));

test('invalid or partial assessment batches leave the claim and all results unchanged', async () => directory(async dir => {
  const file = path.join(dir, 'state.sqlite'); const store = new EvidenceStore(file);
  store.observe({ complete: true, modelIDs: ['base'] });
  const keys = store.observe({ complete: true, modelIDs: ['base', 'a', 'b'] });
  const { claimID } = store.reserve(keys, 100, 1);
  store.markStarted(claimID);
  const row = modelID => ({ hostID: modelID, packet: { modelID, sources: [] }, classifier: { modelID: 'judge', calibrationVersion: 'cal-v1', promptVersion: 'prompt-v1' }, retrievedAt: 100, assessment: { modelID, basis: 'provisional', suitability: 'unknown', references: [] } });
  assert.throws(() => store.completeAssessments(claimID, [row('a')]), /ownership/);
  assert.throws(() => store.completeAssessments(claimID, [row('a'), { ...row('b'), classifier: { modelID: '../private', calibrationVersion: 'cal-v1', promptVersion: 'prompt-v1' } }]), /invalid assessments/);
  assert.equal(store.assessment(keys[0]), null);
  assert.deepEqual(keys.map(key => store.snapshot().work[key]), ['issued', 'issued']);
  store.completeAssessments(claimID, [row('a'), row('b')]); store.close();
  const reopened = new EvidenceStore(file);
  assert.deepEqual(keys.map(key => reopened.snapshot().work[key]), ['complete', 'complete']);
  assert.deepEqual(keys.map(key => reopened.assessment(key).assessment.modelID), ['a', 'b']);
  reopened.close();
}));

test('notice history distinguishes reservations, starts, unknown outcomes and cancellations', async () => directory(async dir => {
  const file = path.join(dir, 'state.sqlite'); let store = new EvidenceStore(file);
  store.observe({ complete: true, modelIDs: ['base'] });
  const keys = store.observe({ complete: true, modelIDs: ['base', 'a', 'b'] });
  const first = store.reserve([keys[0]], 100, 4);
  assert.equal(store.notices()[0].status, 'reserved');
  store.settleClaim(first.claimID, [keys[0]], 'issued', 'pending');
  const second = store.reserve([keys[1]], 101, 4); store.markStarted(second.claimID);
  assert.throws(() => store.settleClaim(second.claimID, [keys[1]], 'issued', 'pending'), /started dispatch/);
  store.settleClaim(second.claimID, [keys[1]], 'issued', 'unknown'); store.close();
  store = new EvidenceStore(file);
  assert.deepEqual(store.notices().map(n => n.status), ['cancelled', 'unknown']);
  assert.deepEqual(store.notices().map(n => n.id), [first.claimID, second.claimID]);
  store.close();
}));

test('stored assessments retain source and classifier provenance without storing whole source text', async () => directory(async dir => {
  const file = path.join(dir, 'state.sqlite'); let store = new EvidenceStore(file);
  store.observe({ complete: true, modelIDs: ['base'] });
  const [key] = store.observe({ complete: true, modelIDs: ['base', 'model-a'] });
  const { claimID } = store.reserve([key], 100, 1); store.markStarted(claimID);
  const classifier = { modelID: 'judge', variant: 'low', calibrationVersion: 'cal-v1', promptVersion: 'prompt-v1' };
  const source = { id: 'openai-model-index', url: 'https://developers.openai.com/api/docs/models.md', text: 'This model supports coding. Extra source text not needed in the stored citation.' };
  const packet = { modelID: 'model-a', sources: [source] };
  const assessment = { modelID: 'model-a', basis: 'sourced', suitability: 'middle', references: [{ sourceID: source.id, quote: 'supports coding' }] };
  assert.throws(() => store.completeAssessments(claimID, [{ hostID: 'model-a', packet: { ...packet, sources: [{ ...source, url: 'https://other.invalid/' }] }, classifier, retrievedAt: 100, assessment }]), /invalid assessments/);
  store.completeAssessments(claimID, [{ hostID: 'model-a', packet, classifier, retrievedAt: 100, assessment }]); store.close();
  store = new EvidenceStore(file); const saved = store.assessment(key);
  assert.equal(saved.fingerprint, evidenceFingerprint(packet, classifier, 'prompt-v1:cal-v1'));
  assert.deepEqual(saved.classifier, classifier); assert.equal(saved.retrievedAt, 100);
  assert.equal(saved.sources[0].url, source.url); assert.match(saved.sources[0].contentHash, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(saved).includes('Extra source text'));
  store.close();
}));

test('a host alias is mapped to public model evidence without persisting the alias', async () => directory(async dir => {
  const file = path.join(dir, 'state.sqlite'); const store = new EvidenceStore(file);
  store.observe({ complete: true, modelIDs: ['base'] });
  const [key] = store.observe({ complete: true, modelIDs: ['base', 'private-alias'] });
  const { claimID } = store.reserve([key], 100, 1); store.markStarted(claimID);
  const classifier = { modelID: 'judge', calibrationVersion: 'cal-v1', promptVersion: 'prompt-v1' };
  store.completeAssessments(claimID, [{ hostID: 'private-alias', packet: { modelID: 'public-a', sources: [] }, classifier, retrievedAt: 100, assessment: { modelID: 'public-a', basis: 'provisional', suitability: 'unknown', references: [] } }]);
  assert.equal(store.assessment(key).assessment.modelID, 'public-a'); store.close();
  const db = new DatabaseSync(file); const raw = db.prepare('SELECT value FROM router_state WHERE id = 1').get().value;
  assert.ok(!raw.includes('private-alias')); db.close();
}));

test('read-only evidence inspection reports reservations without changing the stored state', async () => directory(async dir => {
  const file = path.join(dir, 'state.sqlite'); const store = new EvidenceStore(file);
  store.observe({ complete: true, modelIDs: ['base'] });
  const keys = store.observe({ complete: true, modelIDs: ['base', 'new'] }); store.reserve(keys, 100, 1); store.close();
  const db = new DatabaseSync(file); const before = db.prepare('SELECT value FROM router_state WHERE id = 1').get().value;
  const inspected = EvidenceStore.inspect(file); assert.equal(inspected.unknown, 1); assert.equal(inspected.notices[0].status, 'reserved');
  assert.equal(db.prepare('SELECT value FROM router_state WHERE id = 1').get().value, before); db.close();
  assert.throws(() => EvidenceStore.inspect(path.join(dir, 'missing.sqlite')));
}));

test('classifier passes persist and rejected candidates become eligible only on demand after backoff', async () => directory(async dir => {
  const file = path.join(dir, 'state.sqlite'); let store = new EvidenceStore(file); const key = 'a'.repeat(64);
  assert.equal(store.classifierCheck(key, 100), null); store.saveClassifierCheck(key, false, 100);
  assert.equal(store.classifierCheck(key, 101), false); store.close(); store = new EvidenceStore(file);
  assert.equal(store.classifierCheck(key, 100 + WINDOW_MS), null);
  store.saveClassifierCheck(key, true, 100 + WINDOW_MS); store.close(); store = new EvidenceStore(file);
  assert.equal(store.classifierCheck(key, 100 + 2 * WINDOW_MS), true); assert.deepEqual(store.notices(), []);
  assert.throws(() => store.classifierCheck(key, 0), /calibration time/); store.close();
}));
