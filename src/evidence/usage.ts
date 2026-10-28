/** A plugin invocation is not a token, monetary or provider-attempt count. */
export interface UsageLedger { readonly dispatches: readonly number[] }
export interface UsageSnapshot { readonly dispatchesInWindow: number; readonly limit: number; readonly nextEligibleAt: number | null; readonly tokenUsage: null; readonly cost: null }
export type Reservation = { readonly allowed: false; readonly ledger: UsageLedger; readonly usage: UsageSnapshot } | { readonly allowed: true; readonly ledger: UsageLedger; readonly usage: UsageSnapshot };
export const WINDOW_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_DISPATCH_LIMIT = 4;

/** Intended for a user-visible notice only after a background dispatch actually starts. */
export function formatDispatchNotice(usage: UsageSnapshot): string {
  return `OpenAI router used 1 background model dispatch (${usage.dispatchesInWindow} of ${usage.limit} in the rolling 24-hour window). Token usage and subscription allowance are unavailable; the host may retry.`;
}

/** Reserve before starting an operation. Persist atomically before issuing a real request. */
export function reserveDispatch(ledger: UsageLedger, now: number, limit = DEFAULT_DISPATCH_LIMIT): Reservation {
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(limit) || limit < 0 || limit > 100 || !Array.isArray(ledger.dispatches) || ledger.dispatches.length > 100 || ledger.dispatches.some(t => !Number.isSafeInteger(t) || t < 0 || t > now)) {
    return { allowed: false, ledger, usage: { dispatchesInWindow: 0, limit: 0, nextEligibleAt: null, tokenUsage: null, cost: null } };
  }
  const recent = ledger.dispatches.filter(time => now - time < WINDOW_MS).sort((a, b) => a - b);
  const allowed = recent.length < limit;
  const updated = allowed ? [...recent, now] : recent;
  const nextEligibleAt = updated.length >= limit && limit > 0 ? updated[0] + WINDOW_MS : null;
  return { allowed, ledger: { dispatches: updated }, usage: { dispatchesInWindow: updated.length, limit, nextEligibleAt, tokenUsage: null, cost: null } };
}
