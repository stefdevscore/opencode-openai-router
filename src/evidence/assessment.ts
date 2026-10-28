import { createHash } from 'node:crypto';

/** Only verified public identities and bounded public excerpts belong in a packet. */
export interface EvidenceSource { readonly id: string; readonly url: string; readonly text: string }
export interface EvidencePacket { readonly modelID: string; readonly sources: readonly EvidenceSource[] }
export interface ClaimReference { readonly sourceID: string; readonly quote: string }
export interface Assessment { readonly modelID: string; readonly basis: 'sourced' | 'provisional'; readonly suitability: 'higher' | 'middle' | 'lower' | 'unknown'; readonly references: readonly ClaimReference[] }
const record = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Verify exact source passage membership; this alone does not prove a claim's meaning. */
export function validateAssessments(raw: unknown, packets: readonly EvidencePacket[]): readonly Assessment[] | null {
  if (!record(raw) || Object.keys(raw).length !== 1 || !Array.isArray(raw.assessments) || raw.assessments.length !== packets.length || packets.length > 16) return null;
  const expected = new Map(packets.map(packet => [packet.modelID, packet]));
  if (expected.size !== packets.length) return null;
  const found = new Set<string>(); const results: Assessment[] = [];
  for (const item of raw.assessments) {
    if (!record(item) || Object.keys(item).some(k => !['modelID', 'basis', 'suitability', 'references'].includes(k)) || typeof item.modelID !== 'string' || !expected.has(item.modelID) || found.has(item.modelID) || (item.basis !== 'sourced' && item.basis !== 'provisional') || !['higher', 'middle', 'lower', 'unknown'].includes(String(item.suitability)) || !Array.isArray(item.references) || item.references.length > 8) return null;
    const packet = expected.get(item.modelID)!; const references: ClaimReference[] = [];
    for (const ref of item.references) {
      if (!record(ref) || Object.keys(ref).length !== 2 || typeof ref.sourceID !== 'string' || typeof ref.quote !== 'string' || ref.quote.length < 8 || ref.quote.length > 512) return null;
      const source = packet.sources.find(s => s.id === ref.sourceID);
      if (!source || !source.text.includes(ref.quote)) return null;
      references.push({ sourceID: ref.sourceID, quote: ref.quote });
    }
    if (item.basis === 'sourced' && references.length === 0) return null;
    found.add(item.modelID);
    results.push({ modelID: item.modelID, basis: item.basis, suitability: item.suitability as Assessment['suitability'], references });
  }
  return results;
}

/** Fingerprint the precise evidence and classifier version; no private prompt or path is accepted. */
export function evidenceFingerprint(packet: EvidencePacket, classifier: { modelID: string; variant?: string }, version: string): string {
  const payload = { modelID: packet.modelID, sources: [...packet.sources].sort((a, b) => a.id.localeCompare(b.id)).map(s => ({ id: s.id, url: s.url, text: s.text })), classifier: { modelID: classifier.modelID, variant: classifier.variant ?? null }, version };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
