import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreCalibration, selectCalibratedClassifier } from '../dist/evidence/calibration.js';

test('calibration compares grounded outputs to frozen expected labels', () => {
  const packet = { modelID: 'model-a', sources: [{ id: 'source', url: 'https://example.test', text: 'The fixture says this model supports coding.' }] };
  const cases = [{ packet, expected: { basis: 'sourced', suitability: 'middle' } }];
  const item = { modelID: 'model-a', basis: 'sourced', suitability: 'middle', references: [{ sourceID: 'source', quote: 'supports coding' }] };
  assert.deepEqual(scoreCalibration({ assessments: [item] }, cases), { passed: true, matched: 1, total: 1 });
  assert.equal(scoreCalibration({ assessments: [{ ...item, suitability: 'higher' }] }, cases).passed, false);
  assert.equal(scoreCalibration({ assessments: [{ ...item, references: [{ sourceID: 'source', quote: 'fabricated quote' }] }] }, cases).passed, false);
  assert.equal(scoreCalibration({ assessments: [] }, cases).passed, false);
  assert.equal(scoreCalibration({ assessments: [] }, []).passed, false);
});

test('classifier selection uses only available, current, independently measured candidates', () => {
  const models = ['a', 'b'].map(id => ({ id, providerID: 'openai', inputModalities: ['text'], outputModalities: ['text'], variants: [{ name: 'low' }] }));
  const measurement = (modelID, latencyMs, extra = {}) => ({ modelID, variant: 'low', calibrationVersion: 'c1', promptVersion: 'p1', passed: true, calibratedAt: 10, expiresAt: 200, latencyMs, ...extra });
  const versions = { calibrationVersion: 'c1', promptVersion: 'p1' };
  assert.equal(selectCalibratedClassifier(models, [measurement('a', 100), measurement('b', 20)], 100, versions).modelID, 'b');
  assert.equal(selectCalibratedClassifier(models.slice(0, 1), [measurement('a', 100), measurement('b', 20)], 100, versions).modelID, 'a');
  assert.equal(selectCalibratedClassifier(models, [measurement('a', 1, { passed: false }), measurement('b', 1, { expiresAt: 100 })], 100, versions), null);
  assert.equal(selectCalibratedClassifier([{ ...models[0], inputModalities: null }], [measurement('a', 1)], 100, versions), null);
  assert.equal(selectCalibratedClassifier(models, [measurement('a', 1, { variant: 'removed' })], 100, versions), null);
});
