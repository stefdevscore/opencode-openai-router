import test from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceDriver } from '../dist/evidence/driver.js';

const flush = () => new Promise(resolve => setImmediate(resolve));

test('driver resumes deferred work, backs off pending failures and stops when work is done', async () => {
  const timers = []; const results = ['deferred', 'unavailable', 'issued']; let calls = 0, pending = true;
  const driver = new EvidenceDriver({ run: async () => { calls++; const next = results.shift(); if (next === 'issued') pending = false; return next; }, hasPending: () => pending, setTimer: (callback, delay) => { const timer = { callback, delay, cancelled: false }; timers.push(timer); return timer; }, clearTimer: timer => { timer.cancelled = true; } });
  driver.wake(); await flush(); assert.equal(calls, 1); assert.equal(timers[0].delay, 1000);
  timers[0].callback(); await flush(); assert.equal(calls, 2); assert.ok(timers[1].delay >= 60_000);
  timers[1].callback(); await flush(); assert.equal(calls, 3); assert.equal(timers.length, 2);
  driver.dispose();
});

test('driver coalesces changes during a run and never schedules after disable or disposal', async () => {
  let release, calls = 0; const gate = new Promise(resolve => { release = resolve; }); const timers = [];
  const driver = new EvidenceDriver({ run: async () => { calls++; if (calls === 1) await gate; return 'disabled'; }, hasPending: () => true, setTimer: (callback, delay) => { timers.push({ callback, delay }); return timers.at(-1); }, clearTimer: () => {} });
  driver.wake(); driver.wake(); driver.wake(); release(); await flush();
  assert.equal(calls, 2); assert.equal(timers.length, 0);
  driver.dispose(); driver.wake(); await flush(); assert.equal(calls, 2);
});
