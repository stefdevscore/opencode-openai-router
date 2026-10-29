import test from 'node:test';
import assert from 'node:assert/strict';
import { PublicEvidenceResolver } from '../dist/evidence/resolver.js';

const publicIndex = '- [Public A](/api/docs/models/public-a.md): Public model supports coding.\n- [Public B](/api/docs/models/public-b.md): Other model.\n';
const model = (id, providerModelID) => ({ id, providerID: 'openai', providerModelID, contextLimit: null, toolCalls: null, variants: null });

test('concurrent public matches share a bounded index fetch and never send aliases', async () => {
  let clock = 100, calls = 0, release; const gate = new Promise(resolve => { release = resolve; });
  const resolver = new PublicEvidenceResolver({ now: () => clock, cacheMs: 100, fetchIndex: async signal => { assert.equal(signal instanceof AbortSignal, true); calls++; await gate; return publicIndex; } });
  const first = resolver.resolve([model('private-alias', 'public-a')]);
  const second = resolver.resolve([model('other-private-alias', 'public-b')]);
  release(); const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1); assert.equal(a[0].publicID, 'public-a'); assert.equal(b[0].publicID, 'public-b');
  assert.ok(!JSON.stringify(a[0].packet).includes('private-alias'));
  await resolver.resolve([model('unknown', 'missing')]); assert.equal(calls, 1);
  clock += 100; await resolver.resolve([model('private-alias', 'public-a')]); assert.equal(calls, 2);
  resolver.dispose();
} );

test('failed lookup uses backoff and recovers automatically without a model call', async () => {
  let clock = 100, calls = 0, available = false;
  const resolver = new PublicEvidenceResolver({ now: () => clock, failureBackoffMs: 50, fetchIndex: async () => { calls++; if (!available) throw Error('offline'); return publicIndex; } });
  assert.deepEqual(await resolver.resolve([model('a', 'public-a')]), []);
  available = true; assert.deepEqual(await resolver.resolve([model('a', 'public-a')]), []); assert.equal(calls, 1);
  clock += 50; assert.equal((await resolver.resolve([model('a', 'public-a')])).length, 1); assert.equal(calls, 2);
  resolver.dispose();
});

test('dispose promptly stops a hung lookup and discards its late result', async () => {
  let release, start; const started = new Promise(resolve => { start = resolve; }); const gate = new Promise(resolve => { release = resolve; });
  const resolver = new PublicEvidenceResolver({ fetchIndex: async () => { start(); await gate; return publicIndex; } });
  const pending = resolver.resolve([model('a', 'public-a')]); await started; resolver.dispose();
  assert.deepEqual(await pending, []); release();
  assert.deepEqual(await resolver.resolve([model('a', 'public-a')]), []);
});
