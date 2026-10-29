import type { ScheduleResult } from './scheduler.js';

export interface DriverDependencies {
  /** Must read a fresh catalog and recheck controls on every run. */
  readonly run: () => Promise<ScheduleResult>;
  /** Includes only work still pending, never issued or unknown work. */
  readonly hasPending: () => boolean;
  readonly setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  readonly clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

/** Unregistered wake-up driver. Retries pending work only, with bounded exponential backoff. */
export class EvidenceDriver {
  private stopped = false;
  private running = false;
  private requested = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private failures = 0;
  constructor(private readonly deps: DriverDependencies) {}
  wake(): void {
    if (this.stopped) return;
    this.cancelTimer();
    if (this.running) { this.requested = true; return; }
    this.running = true;
    void this.run();
  }
  dispose(): void { this.stopped = true; this.requested = false; this.cancelTimer(); }
  private cancelTimer(): void {
    if (this.timer !== undefined) (this.deps.clearTimer ?? clearTimeout)(this.timer);
    this.timer = undefined;
  }
  private async run(): Promise<void> {
    let result: ScheduleResult = 'unavailable';
    try { result = await this.deps.run(); } catch { /* Retry pending work with backoff. */ }
    this.running = false;
    if (this.stopped) return;
    if (this.requested) { this.requested = false; this.wake(); return; }
    if (result === 'disabled') return;
    let pending = false;
    try { pending = this.deps.hasPending(); } catch { return; }
    if (!pending) { this.failures = 0; return; }
    if (result === 'issued' || result === 'baseline') this.failures = 0;
    else this.failures = Math.min(this.failures + 1, 8);
    const delay = result === 'deferred' ? 1000 : Math.min(60_000 * 2 ** this.failures, 6 * 60 * 60_000);
    this.timer = (this.deps.setTimer ?? setTimeout)(() => { this.timer = undefined; this.wake(); }, delay);
  }
}
