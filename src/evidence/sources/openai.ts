import type { EvidencePacket } from '../assessment.js';

export const OPENAI_MODEL_INDEX = 'https://developers.openai.com/api/docs/models.md';
const MAX_BYTES = 512 * 1024;

/** Exact index path match only; caller must separately establish the host ID is not a private alias. */
export function parseOpenAIIndex(markdown: string, publicModelIDs: readonly string[]): EvidencePacket[] {
  if (Buffer.byteLength(markdown, 'utf8') > MAX_BYTES || publicModelIDs.length > 4096) return [];
  const requested = new Set(publicModelIDs.filter(id => /^[a-z0-9][a-z0-9._-]{0,127}$/.test(id)));
  const found = new Map<string, string>(); const ambiguous = new Set<string>();
  for (const line of markdown.split(/\r?\n/)) {
    if (line.length > 2048) continue;
    const match = /^- \[[^\]\n]{1,256}\]\(\/api\/docs\/models\/([a-z0-9][a-z0-9._-]{0,127})\.md\): (.{1,1000})$/.exec(line);
    if (!match || !requested.has(match[1])) continue;
    if (found.has(match[1]) && found.get(match[1]) !== line) ambiguous.add(match[1]);
    else found.set(match[1], line);
  }
  return [...found].filter(([id]) => !ambiguous.has(id)).map(([modelID, text]) => ({ modelID, sources: [{ id: 'openai-model-index', url: OPENAI_MODEL_INDEX, text }] }));
}

/** Fetches one fixed public URL, with no model identifiers or credentials in the request. */
export async function fetchOpenAIIndex(signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<string> {
  const response = await fetcher(OPENAI_MODEL_INDEX, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000), redirect: 'error', headers: { accept: 'text/markdown' } });
  if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('text/markdown') || !response.body) throw new Error('OpenAI index unavailable');
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) throw new Error('OpenAI index too large');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const item = await reader.read(); if (item.done) break;
      total += item.value.byteLength;
      if (total > MAX_BYTES) { await reader.cancel(); throw new Error('OpenAI index too large'); }
      chunks.push(item.value);
    }
  } finally { reader.releaseLock(); }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}
