import type { ControlStore } from '../controls/index.js';
import { discoveryKey, type Inventory } from './discovery.js';
import type { AssessmentRecord, EvidenceStore } from './store.js';
import type { UsageSnapshot } from './usage.js';
import { RejectedCalibration } from './automatic-calibration.js';

export type Resolution = 'direct' | 'needs-inference' | 'unavailable';
export type ScheduleResult = 'baseline' | 'idle' | 'deferred' | 'disabled' | 'unavailable' | 'limited' | 'issued' | 'unknown';
export interface SchedulerDependencies {
  readonly store: EvidenceStore;
  readonly controls: ControlStore;
  /** Check that the complete catalog and connection used by this observation are still current. */
  readonly isCurrent: (inventory: Inventory) => boolean;
  /** Identity mapping and source lookup use verified public information; 'direct' means it has already been persisted. */
  readonly resolve: (modelID: string) => Promise<Resolution>;
  /** Return the evidence and response for store validation. Throw or reject for an unknown outcome. */
  readonly dispatch: (modelIDs: readonly string[]) => Promise<readonly AssessmentRecord[]>;
  /** Optional pure preflight: errors occur before reservation and must not issue inference. */
  readonly prepareDispatch?: (modelIDs: readonly string[]) => { readonly valid: () => boolean; readonly start: () => Promise<readonly AssessmentRecord[]> };
  readonly notify: (usage: UsageSnapshot, status: 'started' | 'unknown') => void;
  readonly now: () => number;
  readonly limit: number;
  readonly resolveTimeoutMs?: number;
  readonly dispatchTimeoutMs?: number;
  readonly batchSize?: number;
}

function timeout<T>(promise: Promise<T>, duration: number, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('disposed')); return; }
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
    const abort = () => { finish(); reject(new Error('disposed')); };
    const timer = setTimeout(() => { finish(); reject(new Error('deadline exceeded')); }, duration);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { finish(); resolve(value); }, error => { finish(); reject(error); });
  });
}

/** Experimental, dependency-injected lifecycle. Not registered in the plugin. */
export class EvidenceScheduler {
  private stopped = false;
  private readonly abort = new AbortController();
  private tail: Promise<void> = Promise.resolve();
  private queued = 0;
  private scanOffset = 0;
  constructor(private readonly deps: SchedulerDependencies) {
    if (!Number.isSafeInteger(deps.batchSize ?? 16) || (deps.batchSize ?? 16) < 1 || (deps.batchSize ?? 16) > 16) throw new Error('invalid batch size');
    for (const duration of [deps.resolveTimeoutMs ?? 1000, deps.dispatchTimeoutMs ?? 60000]) {
      if (!Number.isSafeInteger(duration) || duration < 1 || duration > 300_000) throw new Error('invalid deadline');
    }
  }
  dispose(): void { this.stopped = true; this.abort.abort(); }
  observe(inventory: Inventory): Promise<ScheduleResult> {
    if (this.stopped) return Promise.resolve('disabled');
    if (this.queued >= 16 || !Array.isArray(inventory.modelIDs) || inventory.modelIDs.length > 4096) return Promise.resolve('unavailable');
    const snapshot = { complete: inventory.complete, modelIDs: [...inventory.modelIDs], revision: inventory.revision, ...(inventory.sourceBaseline === undefined ? {} : { sourceBaseline: [...inventory.sourceBaseline] }), ...(inventory.publicIDs === undefined ? {} : { publicIDs: { ...inventory.publicIDs } }) };
    this.queued++;
    // Retain every observation, so an update arriving during a call is not lost.
    const work = this.tail.then(async () => {
      let dispatched = false;
      const budget = { remaining: 32 };
      // Continue full batches without requiring another model update event.
      for (let batch = 0; batch < 256; batch++) {
        const result = await this.process(snapshot, budget);
        if (result === 'issued') { dispatched = true; continue; }
        return dispatched && result === 'idle' ? 'issued' : result;
      }
      return dispatched ? 'issued' : 'idle';
    }).catch((): ScheduleResult => 'unavailable');
    this.tail = work.then(() => { this.queued--; }, () => { this.queued--; });
    return work;
  }
  private async process(inventory: Inventory, budget: { remaining: number }): Promise<ScheduleResult> {
    if (this.stopped) return 'disabled';
    if (!inventory.complete || !this.deps.isCurrent(inventory)) return 'unavailable';
    const wasBaselined = this.deps.store.snapshot().baselined;
    this.deps.store.observe(inventory);
    if (!wasBaselined) return 'baseline';
    const controls = await this.deps.controls.refresh();
    if (this.stopped || controls.status !== 'ready' || controls.config?.mode !== 'auto') return 'disabled';
    const state = this.deps.store.snapshot();
    const pending = inventory.modelIDs.filter(id => state.work[discoveryKey('openai', id)] === 'pending');
    if (!pending.length) return 'idle';
    if (!budget.remaining) return 'deferred';
    const candidates: string[] = [];
    const start = this.scanOffset % pending.length;
    let scanned = 0;
    while (scanned < pending.length && budget.remaining > 0) {
      const id = pending[(start + scanned) % pending.length];
      scanned++; budget.remaining--;
      if (this.stopped) return 'disabled';
      let resolution: Resolution;
      try { resolution = await timeout(Promise.resolve().then(() => this.deps.resolve(id)), this.deps.resolveTimeoutMs ?? 1000, this.abort.signal); }
      catch { continue; }
      if (resolution === 'direct') {
        const latest = await this.deps.controls.refresh();
        if (this.stopped || latest.status !== 'ready' || latest.config?.mode !== 'auto' || latest.generation !== controls.generation || !this.deps.isCurrent(inventory)) return 'unavailable';
        this.deps.store.completeDirect([discoveryKey('openai', id)]);
      }
      if (resolution === 'needs-inference') candidates.push(id);
      if (candidates.length === (this.deps.batchSize ?? 16)) break;
    }
    this.scanOffset = (start + scanned) % pending.length;
    if (!candidates.length) return scanned < pending.length ? 'deferred' : 'idle';
    if (this.stopped || !this.deps.isCurrent(inventory)) return 'unavailable';
    let prepared: { readonly valid: () => boolean; readonly start: () => Promise<readonly AssessmentRecord[]> };
    try { prepared = this.deps.prepareDispatch?.(candidates) ?? { valid: () => true, start: () => this.deps.dispatch(candidates) }; }
    catch { return 'unavailable'; }
    if (!prepared.valid()) return 'unavailable';
    const keys = candidates.map(id => discoveryKey('openai', id));
    const reservation = this.deps.store.reserve(keys, this.deps.now(), this.deps.limit);
    if (!reservation.allowed) return 'limited';
    const claimID = reservation.claimID;
    if (!claimID) return 'unavailable';
    if (this.stopped) { this.deps.store.settleClaim(claimID, keys, 'issued', 'pending'); return 'disabled'; }
    let started = false;
    try {
      const issued = await this.deps.controls.issue(controls.generation, () => {
        if (this.stopped || !this.deps.isCurrent(inventory) || !prepared.valid()) return Promise.resolve(null);
        started = true;
        let confirmed = false;
        try {
          const operation = prepared.start();
          this.deps.store.markStarted(claimID);
          confirmed = true;
          return operation;
        }
        finally { try { this.deps.notify(reservation.usage, confirmed ? 'started' : 'unknown'); } catch { /* Never repeat inference for a failed notice. */ } }
      });
      if (!issued.issued || !started) { this.deps.store.settleClaim(claimID, keys, 'issued', 'pending'); return 'disabled'; }
      const records = await timeout(issued.completion, this.deps.dispatchTimeoutMs ?? 60000, this.abort.signal);
      if (!records) throw new Error('missing assessment');
      const current = await this.deps.controls.refresh();
      if (this.stopped || current.status !== 'ready' || current.config?.mode !== 'auto' || current.generation !== controls.generation || !this.deps.isCurrent(inventory)) throw new Error('stale context');
      this.deps.store.completeAssessments(claimID, records);
      return 'issued';
    } catch (error) {
      if (started && error instanceof RejectedCalibration) {
        this.deps.store.rejectCalibration(claimID, keys);
        return 'unavailable';
      }
      // Even a synchronous throw can follow an issued request; do not retry it blindly.
      if (started) { try { this.deps.store.settleClaim(claimID, keys, 'issued', 'unknown'); } catch { /* Preserve existing durable state. */ } }
      else { try { this.deps.store.settleClaim(claimID, keys, 'issued', 'pending'); } catch { /* Preserve existing durable state. */ } }
      return started ? 'unknown' : 'unavailable';
    }
  }
}
