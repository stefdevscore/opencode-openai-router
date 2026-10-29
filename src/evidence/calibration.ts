import type { Model } from '../catalog/index.js';
import { validateAssessments, type Assessment, type EvidencePacket } from './assessment.js';
import type { EvaluatedClassifier } from './pipeline.js';

export interface CalibrationCase {
  readonly packet: EvidencePacket;
  /** Independently prepared expected labels, frozen before assessing candidates. */
  readonly expected: Pick<Assessment, 'basis' | 'suitability'>;
}
export interface CalibrationMeasurement extends EvaluatedClassifier {
  readonly passed: boolean;
  readonly calibratedAt: number;
  readonly expiresAt: number;
  readonly latencyMs: number;
}

/** Structural and expected-label checks; a pass is not proof of coding quality. */
export function scoreCalibration(raw: unknown, cases: readonly CalibrationCase[]): { passed: boolean; matched: number; total: number } {
  if (!cases.length || cases.length > 16) return { passed: false, matched: 0, total: cases.length };
  const assessments = validateAssessments(raw, cases.map(item => item.packet));
  if (!assessments) return { passed: false, matched: 0, total: cases.length };
  const byID = new Map(assessments.map(item => [item.modelID, item]));
  const matched = cases.filter(item => {
    const result = byID.get(item.packet.modelID);
    return result?.basis === item.expected.basis && result.suitability === item.expected.suitability;
  }).length;
  return { passed: matched === cases.length, matched, total: cases.length };
}

/** Choose from observed passing candidates only; metadata and names do not imply quality. */
export function selectCalibratedClassifier(models: readonly Model[], measurements: readonly CalibrationMeasurement[], now: number, versions: { calibrationVersion: string; promptVersion: string }): EvaluatedClassifier | null {
  if (!Number.isSafeInteger(now) || now < 0 || models.length > 4096 || measurements.length > 4096) return null;
  const candidates = measurements.filter(item => {
    if (!item.passed || item.calibrationVersion !== versions.calibrationVersion || item.promptVersion !== versions.promptVersion || !Number.isSafeInteger(item.calibratedAt) || !Number.isSafeInteger(item.expiresAt) || item.calibratedAt < 0 || item.calibratedAt > now || item.expiresAt <= now || !Number.isFinite(item.latencyMs) || item.latencyMs < 0) return false;
    const model = models.find(model => model.providerID === 'openai' && model.id === item.modelID);
    if (!model || model.inputModalities?.includes('text') !== true || model.outputModalities?.includes('text') !== true) return false;
    return item.variant === undefined || !!model.variants?.some(variant => variant.name === item.variant);
  });
  candidates.sort((a, b) => a.latencyMs - b.latencyMs || a.modelID.localeCompare(b.modelID) || (a.variant ?? '').localeCompare(b.variant ?? ''));
  const selected = candidates[0];
  return selected ? { modelID: selected.modelID, ...(selected.variant === undefined ? {} : { variant: selected.variant }), calibrationVersion: selected.calibrationVersion, promptVersion: selected.promptVersion } : null;
}
