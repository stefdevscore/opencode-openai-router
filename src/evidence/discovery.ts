import { createHash } from 'node:crypto';

/** A local, one-way identifier; raw host model IDs need not be persisted. */
export function discoveryKey(providerID: string, modelID: string): string {
  if (!providerID || !modelID || providerID.length > 128 || modelID.length > 128) throw new Error('invalid identity');
  return createHash('sha256').update(JSON.stringify([providerID, modelID])).digest('hex');
}

export type WorkStatus = 'pending' | 'issued' | 'unknown' | 'complete';
export interface DiscoveryState {
  readonly version: 1;
  readonly baselined: boolean;
  readonly seen: readonly string[];
  readonly work: Readonly<Record<string, WorkStatus>>;
  readonly sourceBaseline?: readonly string[];
}
export interface Inventory { readonly complete: boolean; readonly modelIDs: readonly string[]; readonly revision?: string; readonly sourceBaseline?: readonly string[]; readonly publicIDs?: Readonly<Record<string, string>> }
export const emptyDiscovery = (): DiscoveryState => ({ version: 1, baselined: false, seen: [], work: {} });
const keyPattern = /^[a-f0-9]{64}$/;
const statuses = new Set<WorkStatus>(['pending', 'issued', 'unknown', 'complete']);

/** Validate data read from a durable store; corrupt state must not become a fresh baseline. */
export function parseDiscovery(value: unknown): DiscoveryState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || typeof v.baselined !== 'boolean' || !Array.isArray(v.seen) || v.seen.length > 4096 || !v.seen.every(k => typeof k === 'string' && keyPattern.test(k)) || new Set(v.seen).size !== v.seen.length || !v.work || typeof v.work !== 'object' || Array.isArray(v.work)) return null;
  const seen = new Set(v.seen as string[]);
  if (v.sourceBaseline !== undefined && (!Array.isArray(v.sourceBaseline) || v.sourceBaseline.length > 4096 || !v.sourceBaseline.every(k => typeof k === 'string' && keyPattern.test(k)) || new Set(v.sourceBaseline).size !== v.sourceBaseline.length)) return null;
  const work = v.work as Record<string, unknown>;
  if ((!v.baselined && (seen.size > 0 || Object.keys(work).length > 0)) || Object.entries(work).some(([key, status]) => !seen.has(key) || !statuses.has(status as WorkStatus))) return null;
  return { version: 1, baselined: v.baselined, seen: [...seen], work: { ...work } as Record<string, WorkStatus>, ...(v.sourceBaseline === undefined ? {} : { sourceBaseline: [...v.sourceBaseline] as string[] }) };
}

/** Must be committed atomically with the caller's shared store transaction. */
export function observeInventory(state: DiscoveryState, inventory: Inventory): { state: DiscoveryState; added: readonly string[] } {
  if (!parseDiscovery(state)) throw new Error('invalid discovery state');
  if (!inventory.complete) return { state, added: [] };
  if (!Array.isArray(inventory.modelIDs) || inventory.modelIDs.length > 4096 || inventory.modelIDs.some(id => typeof id !== 'string' || !id || id.length > 128) || new Set(inventory.modelIDs).size !== inventory.modelIDs.length) throw new Error('invalid inventory');
  const keys = inventory.modelIDs.map(id => discoveryKey('openai', id));
  if (!state.baselined) {
    if (inventory.sourceBaseline !== undefined && (!Array.isArray(inventory.sourceBaseline) || !inventory.sourceBaseline.length || inventory.sourceBaseline.length > 4096 || inventory.sourceBaseline.some(id => typeof id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(id)) || new Set(inventory.sourceBaseline).size !== inventory.sourceBaseline.length)) throw new Error('invalid source baseline');
    const sourceBaseline = inventory.sourceBaseline?.map(id => discoveryKey('openai-public', id));
    return { state: { version: 1, baselined: true, seen: keys, work: {}, ...(sourceBaseline === undefined ? {} : { sourceBaseline }) }, added: [] };
  }
  const seen = new Set(state.seen);
  const added = keys.filter(key => !seen.has(key));
  if (seen.size + added.length > 4096) throw new Error('discovery capacity exceeded');
  const work = { ...state.work };
  const pending: string[] = [];
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    const publicID = inventory.publicIDs?.[inventory.modelIDs[index]];
    if (publicID !== undefined && (typeof publicID !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(publicID))) throw new Error('invalid public identity');
    if (seen.has(key)) {
      if (work[key] === 'pending' && publicID && state.sourceBaseline?.includes(discoveryKey('openai-public', publicID))) delete work[key];
      continue;
    }
    seen.add(key);
    if (publicID && state.sourceBaseline?.includes(discoveryKey('openai-public', publicID))) continue;
    work[key] = 'pending'; pending.push(key);
  }
  return { state: { ...state, seen: [...seen], work }, added: pending };
}

/** Issued work survives crashes as unknown; it must not be blindly dispatched again. */
export function recoverDiscovery(state: DiscoveryState): DiscoveryState {
  if (!parseDiscovery(state)) throw new Error('invalid discovery state');
  return { ...state, work: Object.fromEntries(Object.entries(state.work).map(([key, value]) => [key, value === 'issued' ? 'unknown' : value])) };
}

export function transitionWork(state: DiscoveryState, keys: readonly string[], from: WorkStatus, to: WorkStatus): DiscoveryState {
  if (!parseDiscovery(state) || !keys.length || new Set(keys).size !== keys.length || keys.some(key => state.work[key] !== from)) throw new Error('invalid work transition');
  const allowed = (from === 'pending' && (to === 'issued' || to === 'complete')) || (from === 'issued' && (to === 'unknown' || to === 'complete' || to === 'pending')) || (from === 'unknown' && to === 'complete');
  if (!allowed) throw new Error('invalid work transition');
  const work = { ...state.work };
  for (const key of keys) work[key] = to;
  return { ...state, work };
}
