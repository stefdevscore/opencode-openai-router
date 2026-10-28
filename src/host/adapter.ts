import type { Selection } from "../contracts/index.js";
import type { ControlStore } from "../controls/index.js";

/** This adapter is not registered by the production plugin. Its host evidence must be proven first. */
export type Admission = Readonly<{ sessionID: string; messageID: string; delivery: "steer" | "queue"; deadline: number; signal: AbortSignal }>;
export type Proposal = Readonly<{ current: Selection; target: Selection; evidence: string }>;
export type AdapterResult = "kept" | "issued" | "unknown";
export interface AdapterDependencies {
  controls: ControlStore;
  decide(admission: Admission): Promise<Proposal | null>;
  /** Must synchronously check fresh, host-proven identity, activity, selection and inventory evidence. */
  valid(admission: Admission, proposal: Proposal): boolean;
  /** Must start the native operation synchronously; a resolved operation does not prove dispatch. */
  switchModel(sessionID: string, target: Selection): Promise<void>;
  now?(): number;
}

const same = (a: Selection, b: Selection) => a.providerID === b.providerID && a.modelID === b.modelID && a.variant === b.variant;
const validSelection = (s: Selection) => typeof s.providerID === "string" && s.providerID.length > 0 && typeof s.modelID === "string" && s.modelID.length > 0 && (s.variant === undefined || (typeof s.variant === "string" && s.variant.length > 0));

/** Fail closed on overlapping admissions; never queue a stale decision behind another turn. */
export class HostAdapter {
  private disposed = false;
  private readonly lifetime = new AbortController();
  private readonly sessions = new Map<string, { busy: boolean; seen: Set<string> }>();
  private readonly now: () => number;
  constructor(private readonly deps: AdapterDependencies) { this.now = deps.now ?? Date.now; }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.lifetime.abort();
    this.sessions.clear();
  }

  async admit(event: Admission): Promise<AdapterResult> {
    if (this.disposed || !event.sessionID || !event.messageID) return "kept";
    let state = this.sessions.get(event.sessionID);
    // Bound memory without evicting an identity and accidentally accepting its duplicate.
    if (!state) {
      if (this.sessions.size >= 1024) return "kept";
      state = { busy: false, seen: new Set() };
      this.sessions.set(event.sessionID, state);
    }
    if (state.seen.has(event.messageID) || state.seen.size >= 1024) return "kept";
    state.seen.add(event.messageID);
    // Record even ineligible admissions: a later retry must not turn a queued,
    // cancelled or expired identity into a switch.
    const remaining = event.deadline - this.now();
    // Invalid or oversized timeouts can be clamped by the runtime to 1 ms,
    // while leaving the issuance check alive indefinitely.
    if (state.busy || event.delivery !== "steer" || event.signal.aborted || !Number.isFinite(remaining) || remaining <= 0 || remaining > 60_000) return "kept";
    state.busy = true;
    let issued = false;
    const signal = AbortSignal.any([event.signal, this.lifetime.signal]);
    const alive = () => !signal.aborted && this.now() < event.deadline;
    const bounded = async <T>(work: Promise<T>): Promise<T | null> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let abort: (() => void) | undefined;
      const expired = new Promise<null>(resolve => {
        timer = setTimeout(() => resolve(null), Math.max(0, event.deadline - this.now()));
        abort = () => resolve(null);
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) resolve(null);
      });
      try { return await Promise.race([work, expired]); }
      finally { if (timer) clearTimeout(timer); if (abort) signal.removeEventListener("abort", abort); }
    };
    try {
      const control = await bounded(this.deps.controls.refresh());
      if (!alive() || !control || control.status !== "ready" || control.config?.mode !== "auto") return "kept";
      const proposal = await bounded(this.deps.decide(event));
      if (!alive() || !proposal || !validSelection(proposal.current) || !validSelection(proposal.target) || same(proposal.current, proposal.target)) return "kept";
      const result = await bounded(this.deps.controls.issue(control.generation, () => {
        if (!alive() || !this.deps.valid(event, proposal)) return Promise.resolve(false);
        issued = true;
        // A synchronous throw can occur after host-side effects; retain the lock in that case.
        const operation = this.deps.switchModel(event.sessionID, proposal.target);
        // An error may be reported after the host has acted; only a settled success
        // releases the session. Unknown outcomes remain fail-closed until unload.
        const completion = operation.then(() => { state.busy = false; return true; });
        // The caller may stop waiting on cancellation before issuance is returned.
        void completion.catch(() => {});
        return completion;
      }));
      if (!result) return issued ? "unknown" : "kept";
      if (!result.issued) return "kept";
      // A timed-out issued operation keeps the session locked until it actually settles.
      const completion = result.completion;
      const remaining = Math.max(0, event.deadline - this.now());
      let timer: ReturnType<typeof setTimeout> | undefined;
      let abort: (() => void) | undefined;
      const expired = new Promise<null>(resolve => {
        timer = setTimeout(() => resolve(null), remaining);
        abort = () => resolve(null);
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) resolve(null);
      });
      try {
        const completed = await Promise.race([completion, expired]);
        return completed === null ? (issued ? "unknown" : "kept") : completed ? "issued" : "kept";
      } finally {
        if (timer) clearTimeout(timer);
        if (abort) signal.removeEventListener("abort", abort);
      }
    } catch {
      return issued ? "unknown" : "kept";
    } finally {
      if (!issued) state.busy = false;
    }
  }
}
