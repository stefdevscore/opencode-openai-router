import { createHash } from 'node:crypto';
import type { CatalogStore, CatalogSnapshot } from '../catalog/store.js';
import type { Inventory } from './discovery.js';

function fingerprint(snapshot: CatalogSnapshot): string {
  return createHash('sha256').update(JSON.stringify([snapshot.generation, snapshot.retrievedAt, snapshot.connected, snapshot.catalog])).digest('hex');
}

/** A fresh parsed snapshot of the current host view; it does not prove global release time. */
export class EvidenceCatalog {
  constructor(private readonly store: CatalogStore, private readonly authoritative = true) {}
  capture(): Inventory | null {
    if (!this.authoritative || !this.store.fresh()) return null;
    const state = this.store.snapshot();
    if (state.status !== 'ready' || state.connected !== true || state.catalog?.status !== 'available' || !state.catalog.complete) return null;
    return { complete: true, modelIDs: state.catalog.models.map(model => model.id), revision: fingerprint(state) };
  }
  isCurrent(inventory: Inventory): boolean {
    const current = this.capture();
    return current !== null && inventory.complete && inventory.revision === current.revision && inventory.modelIDs.length === current.modelIDs.length && inventory.modelIDs.every((id, index) => id === current.modelIDs[index]);
  }
}
