import type { Model } from '../catalog/index.js';
import type { EvidencePacket } from './assessment.js';
import { fetchOpenAIIndex, listPublicModelIDs, matchPublicModels } from './sources/openai.js';

export type PublicMatch = { readonly hostID: string; readonly publicID: string; readonly packet: EvidencePacket; readonly retrievedAt: number };

/** Unregistered lookup component; it never sends model IDs in a network request. */
export class PublicEvidenceResolver {
  private cached: { text: string; retrievedAt: number } | undefined;
  private failedAt: number | undefined;
  private flight: Promise<{ text: string; retrievedAt: number }> | undefined;
  private readonly abort = new AbortController();
  private stopped = false;
  constructor(private readonly options: {
    readonly fetchIndex?: (signal: AbortSignal) => Promise<string>;
    readonly now?: () => number;
    readonly cacheMs?: number;
    readonly failureBackoffMs?: number;
  } = {}) {
    for (const value of [options.cacheMs ?? 3600_000, options.failureBackoffMs ?? 60_000]) {
      if (!Number.isSafeInteger(value) || value < 1 || value > 86_400_000) throw new Error('invalid cache duration');
    }
  }
  dispose(): void { this.stopped = true; this.abort.abort(); this.cached = undefined; }
  async resolve(models: readonly Model[]): Promise<readonly PublicMatch[]> {
    if (this.stopped || !models.length || models.length > 4096) return [];
    const entry = await this.index();
    if (!entry || this.stopped) return [];
    return matchPublicModels(entry.text, models).map(item => ({ ...item, retrievedAt: entry.retrievedAt }));
  }
  /** A source baseline is a public-index snapshot, not proof that all existing models are listed. */
  async publicIDs(): Promise<readonly string[]> {
    const entry = await this.index();
    return entry ? listPublicModelIDs(entry.text) : [];
  }
  private async index(): Promise<{ text: string; retrievedAt: number } | undefined> {
    if (this.stopped) return undefined;
    const time = (this.options.now ?? Date.now)();
    if (!Number.isSafeInteger(time) || time < 0) return undefined;
    let entry = this.cached;
    if (entry && (time < entry.retrievedAt || time - entry.retrievedAt >= (this.options.cacheMs ?? 3600_000))) entry = undefined;
    if (!entry) {
      if (this.failedAt !== undefined && (time < this.failedAt || time - this.failedAt < (this.options.failureBackoffMs ?? 60_000))) return undefined;
      try { entry = await this.load(); } catch { return undefined; }
    }
    return this.stopped ? undefined : entry;
  }
  private load(): Promise<{ text: string; retrievedAt: number }> {
    if (this.flight) return this.flight;
    const work = (async () => {
      try {
        const signal = AbortSignal.any([this.abort.signal, AbortSignal.timeout(5000)]);
        const text = await new Promise<string>((resolve, reject) => {
          if (signal.aborted) { reject(new Error('lookup aborted')); return; }
          const onAbort = () => { signal.removeEventListener('abort', onAbort); reject(new Error('lookup aborted')); };
          signal.addEventListener('abort', onAbort, { once: true });
          Promise.resolve().then(() => (this.options.fetchIndex ?? fetchOpenAIIndex)(signal)).then(value => { signal.removeEventListener('abort', onAbort); resolve(value); }, error => { signal.removeEventListener('abort', onAbort); reject(error); });
        });
        const retrievedAt = (this.options.now ?? Date.now)();
        if (this.stopped || !Number.isSafeInteger(retrievedAt) || retrievedAt < 0 || typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 512 * 1024) throw new Error('invalid index');
        const entry = { text, retrievedAt }; this.cached = entry; this.failedAt = undefined; return entry;
      } catch (error) {
        const time = (this.options.now ?? Date.now)();
        if (!this.stopped && Number.isSafeInteger(time) && time >= 0) this.failedAt = time;
        throw error;
      }
    })();
    this.flight = work;
    void work.then(() => { if (this.flight === work) this.flight = undefined; }, () => { if (this.flight === work) this.flight = undefined; });
    return work;
  }
}
