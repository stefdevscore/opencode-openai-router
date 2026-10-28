import { normalizeV2Catalog, type Catalog } from './index.js';

export type CatalogSnapshot = Readonly<{
  status: 'ready' | 'disconnected' | 'unavailable' | 'invalidated';
  hostAvailable: boolean | null;
  connected: boolean | null;
  catalog: Catalog | null;
  retrievedAt: number | null;
  generation: number;
}>;
export interface CatalogSource {
  providers(): Promise<unknown>;
  models(): Promise<unknown>;
  /** Only connection presence is retained; never resolve or persist credentials. */
  connected(integrationID: string): Promise<boolean>;
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** In-memory only. An invalidation prevents in-flight old responses from becoming current. */
export class CatalogStore {
  private generation = 0;
  private disposed = false;
  private monitoring = true;
  private flight: Promise<CatalogSnapshot> | undefined;
  private state: CatalogSnapshot = { status: 'invalidated', hostAvailable: null, connected: null, catalog: null, retrievedAt: null, generation: 0 };
  constructor(private readonly source: CatalogSource, private readonly now: () => number = Date.now) {}
  snapshot(): CatalogSnapshot { return structuredClone(this.state); }
  invalidate(): void {
    if (this.disposed) return;
    this.generation++;
    this.state = { ...this.state, status: 'invalidated', generation: this.generation };
    this.flight = undefined;
  }
  dispose(): void { this.invalidate(); this.disposed = true; }
  monitoringLost(): void { this.monitoring = false; this.invalidate(); }
  fresh(maxAge = 60_000): boolean {
    const age = this.state.retrievedAt === null ? NaN : this.now() - this.state.retrievedAt;
    return !this.disposed && this.monitoring && this.state.status === 'ready' && this.state.catalog?.status === 'available' && this.state.catalog.complete && Number.isFinite(age) && age >= 0 && age <= maxAge;
  }
  refresh(): Promise<CatalogSnapshot> {
    if (this.disposed) return Promise.resolve(this.snapshot());
    if (this.flight) return this.flight;
    const generation = this.generation;
    const work = (async () => {
      let next: CatalogSnapshot;
      try {
        const [providers, models] = await Promise.all([this.source.providers(), this.source.models()]);
        if (!record(providers) || !Array.isArray(providers.data) || providers.data.length > 4096 || providers.data.some(p => !record(p) || typeof p.id !== 'string')) throw new Error('invalid provider response');
        const openai = providers.data.filter(p => p.id === 'openai');
        if (openai.length > 1) throw new Error('duplicate provider');
        const provider = openai[0];
        const normalized = normalizeV2Catalog(models);
        if (normalized.status === 'unavailable' && normalized.reason !== 'missing_provider') throw new Error('invalid model response');
        if (!provider) {
          next = { status: 'unavailable', hostAvailable: false, connected: null, catalog: null, retrievedAt: this.now(), generation };
        } else {
          if (provider.integrationID !== undefined && (typeof provider.integrationID !== 'string' || !provider.integrationID)) throw new Error('invalid integration');
          const connected = await this.source.connected(typeof provider.integrationID === 'string' ? provider.integrationID : 'openai');
          if (typeof connected !== 'boolean') throw new Error('invalid connection');
          const catalog = normalized.status === 'unavailable' ? { status: 'available' as const, complete: true, models: [] } : normalized;
          next = { status: connected ? 'ready' : 'disconnected', hostAvailable: true, connected, catalog, retrievedAt: this.now(), generation };
        }
      } catch {
        next = { ...this.state, status: 'unavailable', hostAvailable: null, connected: null, generation };
      }
      if (!this.disposed && generation === this.generation) this.state = next;
      return this.snapshot();
    })();
    this.flight = work;
    void work.finally(() => { if (this.flight === work) this.flight = undefined; });
    return work;
  }
}
