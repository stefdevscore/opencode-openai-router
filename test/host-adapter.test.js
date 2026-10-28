import assert from 'node:assert/strict';
import test from 'node:test';
import { ControlStore } from '../dist/controls/index.js';
import { HostAdapter } from '../dist/host/adapter.js';

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const current = { providerID: 'local', modelID: 'a' };
const target = { providerID: 'local', modelID: 'b', variant: 'high' };
const event = (messageID, sessionID = 's', extra = {}) => ({ sessionID, messageID, delivery: 'steer', deadline: Date.now() + 1000, signal: new AbortController().signal, ...extra });
function fixture(overrides = {}) {
  let mode = 'auto';
  let valid = true;
  const calls = [];
  const controls = new ControlStore(async () => ({ status: 'ready', config: { mode, profile: 'balanced' } }));
  const adapter = new HostAdapter({ controls, decide: async () => ({ current, target, evidence: 'fixture' }), valid: () => valid, switchModel: async (session, selection) => { calls.push({ session, selection }); }, ...overrides });
  return { adapter, controls, calls, mode: value => { mode = value; }, valid: value => { valid = value; } };
}

test('switches once per admission, skips duplicates, queued input and unchanged pairs', async () => {
  const f = fixture();
  assert.equal(await f.adapter.admit(event('1')), 'issued');
  assert.deepEqual(f.calls, [{ session: 's', selection: target }]);
  assert.equal(await f.adapter.admit(event('1')), 'kept');
  assert.equal(await f.adapter.admit(event('2', 's', { delivery: 'queue' })), 'kept');
  const same = fixture({ decide: async () => ({ current, target: current, evidence: 'fixture' }) });
  assert.equal(await same.adapter.admit(event('1')), 'kept');
  assert.equal(f.calls.length, 1);
});

test('off, stale controls, missing evidence, cancellation and disposal prevent issuance', async () => {
  const f = fixture(); f.mode('off');
  assert.equal(await f.adapter.admit(event('1')), 'kept');
  f.mode('auto'); f.valid(false);
  assert.equal(await f.adapter.admit(event('2')), 'kept');
  f.valid(true);
  const decision = deferred();
  const g = fixture({ decide: () => decision.promise });
  const pending = g.adapter.admit(event('3'));
  await new Promise(resolve => setImmediate(resolve));
  g.mode('off'); await g.controls.refresh();
  decision.resolve({ current, target, evidence: 'fixture' });
  assert.equal(await pending, 'kept');
  const controller = new AbortController(); controller.abort();
  assert.equal(await f.adapter.admit(event('4', 's', { signal: controller.signal })), 'kept');
  f.adapter.dispose();
  assert.equal(await f.adapter.admit(event('5')), 'kept');
  assert.deepEqual(f.calls, []); assert.deepEqual(g.calls, []);
});

test('deadline abandons late decisions, and sessions work independently', async () => {
  const decision = deferred();
  const f = fixture({ decide: e => e.sessionID === 'slow' ? decision.promise : Promise.resolve({ current, target, evidence: 'fixture' }) });
  const slow = f.adapter.admit(event('1', 'slow', { deadline: Date.now() + 30 }));
  assert.equal(await f.adapter.admit(event('2', 'fast')), 'issued');
  assert.equal(await slow, 'kept');
  decision.resolve({ current, target, evidence: 'fixture' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.calls.map(call => call.session), ['fast']);
});

test('an issued but delayed switch blocks later same-session decisions until settled', async () => {
  const operation = deferred(); let calls = 0;
  const f = fixture({ switchModel: () => { calls++; return operation.promise; } });
  assert.equal(await f.adapter.admit(event('1', 's', { deadline: Date.now() + 30 })), 'unknown');
  assert.equal(await f.adapter.admit(event('2')), 'kept');
  assert.equal(calls, 1);
  operation.resolve(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(await f.adapter.admit(event('3')), 'issued');
  assert.equal(calls, 2);
});

test('effort-only changes are eligible, while host errors do not trigger retries', async () => {
  let calls = 0;
  const f = fixture({ decide: async () => ({ current, target: { ...current, variant: 'high' }, evidence: 'fixture' }), switchModel: async () => { calls++; throw new Error('failure'); } });
  assert.equal(await f.adapter.admit(event('1')), 'unknown');
  assert.equal(calls, 1);
});

test('unload and cancellation while a decision is pending cannot issue later', async () => {
  for (const action of ['dispose', 'abort']) {
    const waiting = deferred(); const controller = new AbortController();
    const f = fixture({ decide: () => waiting.promise });
    const pending = f.adapter.admit(event(action, 's', { signal: controller.signal }));
    await new Promise(resolve => setImmediate(resolve));
    if (action === 'dispose') f.adapter.dispose(); else controller.abort();
    waiting.resolve({ current, target, evidence: 'fixture' });
    assert.equal(await pending, 'kept');
    assert.deepEqual(f.calls, []);
  }
});

test('a disable accepted after issuance does not pretend to cancel the host operation', async () => {
  const operation = deferred(); let calls = 0;
  const f = fixture({ switchModel: () => { calls++; return operation.promise; } });
  const pending = f.adapter.admit(event('1'));
  await new Promise(resolve => setImmediate(resolve));
  f.mode('off'); await f.controls.refresh(); operation.resolve();
  assert.equal(await pending, 'issued');
  assert.equal(await f.adapter.admit(event('2')), 'kept');
  assert.equal(calls, 1);
});

test('concurrent admissions in the same session fail closed rather than queue a stale decision', async () => {
  const decision = deferred();
  const f = fixture({ decide: () => decision.promise });
  const first = f.adapter.admit(event('first'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(await f.adapter.admit(event('second')), 'kept');
  decision.resolve({ current, target, evidence: 'fixture' });
  assert.equal(await first, 'issued');
  assert.equal(await f.adapter.admit(event('second')), 'kept');
  assert.equal(f.calls.length, 1);
});

test('a synchronous host error leaves the session blocked because issuance is uncertain', async () => {
  let calls = 0;
  const f = fixture({ switchModel: () => { calls++; throw new Error('unknown side effect'); } });
  assert.equal(await f.adapter.admit(event('first')), 'unknown');
  assert.equal(await f.adapter.admit(event('second')), 'kept');
  assert.equal(calls, 1);
});

test('an expired control read cannot later issue a switch', async () => {
  const read = deferred(); let calls = 0;
  const controls = new ControlStore(() => read.promise);
  const f = fixture({ controls, switchModel: async () => { calls++; } });
  const pending = f.adapter.admit(event('first', 's', { deadline: Date.now() + 30 }));
  assert.equal(await pending, 'kept');
  read.resolve({ status: 'ready', config: { mode: 'auto', profile: 'balanced' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 0);
});

test('a rejected switch blocks subsequent admissions because its side effects are unknown', async () => {
  let calls = 0;
  const f = fixture({ switchModel: async () => { calls++; throw new Error('uncertain'); } });
  assert.equal(await f.adapter.admit(event('first')), 'unknown');
  assert.equal(await f.adapter.admit(event('second')), 'kept');
  assert.equal(calls, 1);
});

test('disposing promptly stops waiting for a decision that never completes', async () => {
  const f = fixture({ decide: () => new Promise(() => {}) });
  const pending = f.adapter.admit(event('first'));
  await new Promise(resolve => setImmediate(resolve));
  f.adapter.dispose();
  assert.equal(await Promise.race([pending, new Promise(resolve => setTimeout(() => resolve('not stopped'), 100))]), 'kept');
});

test('ineligible admission identities cannot switch when retried with changed delivery or timing', async () => {
  const f = fixture();
  assert.equal(await f.adapter.admit(event('queued', 's', { delivery: 'queue' })), 'kept');
  assert.equal(await f.adapter.admit(event('queued')), 'kept');
  assert.equal(await f.adapter.admit(event('expired', 's', { deadline: Date.now() - 1 })), 'kept');
  assert.equal(await f.adapter.admit(event('expired')), 'kept');
  const controller = new AbortController(); controller.abort();
  assert.equal(await f.adapter.admit(event('cancelled', 's', { signal: controller.signal })), 'kept');
  assert.equal(await f.adapter.admit(event('cancelled')), 'kept');
  assert.deepEqual(f.calls, []);
});

test('invalid and oversized deadlines cannot cause a delayed switch after the caller returns', async () => {
  for (const deadline of [Infinity, NaN, Date.now() + 120_000]) {
    const decision = deferred();
    const f = fixture({ decide: () => decision.promise });
    assert.equal(await f.adapter.admit(event('deadline', 's', { deadline })), 'kept');
    decision.resolve({ current, target, evidence: 'fixture' });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.calls, []);
  }
});
