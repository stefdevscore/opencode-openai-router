import type { Model } from '../catalog/index.js';
import type { CalibrationCase } from './calibration.js';
import type { EvaluatedClassifier } from './pipeline.js';
import { createHash } from 'node:crypto';

export function calibrationKey(model: Model): string {
  return createHash('sha256').update(JSON.stringify([CALIBRATION_VERSION, 'assessment-with-calibration-v1', model])).digest('hex');
}

export const CALIBRATION_VERSION = 'extraction-calibration-v1';
export const CALIBRATION_CASES: readonly CalibrationCase[] = [
  { packet: { modelID: 'router-calibration-supported', sources: [{ id: 'openai-model-index', url: 'https://developers.openai.com/api/docs/models.md', text: 'Synthetic calibration fixture: the supplied comparison explicitly assigns this model higher suitability. This is a test statement, not a real model benchmark.' }] }, expected: { basis: 'sourced', suitability: 'higher' } },
  { packet: { modelID: 'router-calibration-unknown', sources: [] }, expected: { basis: 'provisional', suitability: 'unknown' } },
];

/** Selection is deterministic; suitability is established by the response checks, never the name. */
export function calibrationCandidate(models: readonly Model[], rejected: ReadonlySet<string>): EvaluatedClassifier | null {
  const candidates = models.filter(model => model.providerID === 'openai' && /^[a-z0-9][a-z0-9._-]{0,127}$/.test(model.id) && !rejected.has(model.id) && model.inputModalities?.includes('text') === true && model.outputModalities?.includes('text') === true);
  candidates.sort((a, b) => a.id.localeCompare(b.id));
  return candidates[0] ? { modelID: candidates[0].id, calibrationVersion: CALIBRATION_VERSION, promptVersion: 'assessment-with-calibration-v1' } : null;
}

/** A complete response was received and rejected; this is distinct from an unknown dispatch outcome. */
export class RejectedCalibration extends Error {}
