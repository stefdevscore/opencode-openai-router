import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { discoveryKey, emptyDiscovery, observeInventory, parseDiscovery, transitionWork, type DiscoveryState, type Inventory, type WorkStatus } from './discovery.js';
import { reserveDispatch, type UsageSnapshot } from './usage.js';
import { evidenceFingerprint, validateAssessments, type Assessment, type EvidencePacket, type EvidenceSource } from './assessment.js';
import { OPENAI_MODEL_INDEX } from './sources/openai.js';

interface ClassifierProvenance { readonly modelID: string; readonly variant?: string; readonly calibrationVersion: string; readonly promptVersion: string }
export interface AssessmentRecord { readonly hostID: string; readonly packet: EvidencePacket; readonly assessment: Assessment; readonly classifier: ClassifierProvenance; readonly retrievedAt: number }
interface SavedAssessment { fingerprint: string; assessment: Assessment; classifier: ClassifierProvenance; retrievedAt: number; sources: readonly { id: string; url: string; contentHash: string }[] }
export interface DispatchNotice { readonly id: string; readonly createdAt: number; readonly status: 'reserved' | 'started' | 'unknown' | 'completed' | 'cancelled' }
interface State { version: 1; discovery: DiscoveryState; dispatches: number[]; dispatchLimit: number | null; claims: Record<string, string>; assessments: Record<string, SavedAssessment>; notices: DispatchNotice[] }
const initial = (): State => ({ version: 1, discovery: emptyDiscovery(), dispatches: [], dispatchLimit: null, claims: {}, assessments: {}, notices: [] });

function parseState(text: unknown): State {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 1_000_000) throw new Error('invalid state');
  const raw: unknown = JSON.parse(text);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid state');
  const value = raw as Record<string, unknown>;
  const discovery = parseDiscovery(value.discovery);
  if (value.version !== 1 || !discovery || !Array.isArray(value.dispatches) || value.dispatches.length > 100 || value.dispatches.some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('invalid state');
  // Older experimental state can be migrated only when it has no outstanding reservations.
  const limit = value.dispatchLimit === undefined && value.dispatches.length === 0 ? null : value.dispatchLimit;
  if (limit !== null && (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < 0 || limit > 100)) throw new Error('invalid shared dispatch limit');
  const claims = value.claims === undefined ? {} : value.claims;
  if (!claims || typeof claims !== 'object' || Array.isArray(claims) || Object.entries(claims).some(([key, id]) => (discovery.work[key] !== 'issued' && discovery.work[key] !== 'unknown') || typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id))) throw new Error('invalid claims');
  // An old claimed request cannot safely be assigned an owner after the fact.
  if (Object.entries(discovery.work).some(([key, status]) => (status === 'issued' || status === 'unknown') && !Object.hasOwn(claims, key))) throw new Error('missing claim ownership');
  const assessments = value.assessments === undefined ? {} : value.assessments;
  if (!assessments || typeof assessments !== 'object' || Array.isArray(assessments) || Object.keys(assessments).length > 4096) throw new Error('invalid assessments');
  for (const [key, raw] of Object.entries(assessments)) {
    if (discovery.work[key] !== 'complete' || !raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid assessment');
    const row = raw as Record<string, unknown>; const item = row.assessment;
    if (typeof row.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(row.fingerprint) || !item || typeof item !== 'object' || Array.isArray(item) || !validClassifier(row.classifier) || !Number.isSafeInteger(row.retrievedAt) || (row.retrievedAt as number) < 0 || !Array.isArray(row.sources) || row.sources.length > 8 || row.sources.some(source => !source || typeof source !== 'object' || Array.isArray(source) || source.id !== 'openai-model-index' || source.url !== OPENAI_MODEL_INDEX || typeof source.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(source.contentHash))) throw new Error('invalid assessment');
    const a = item as Record<string, unknown>;
    if (typeof a.modelID !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(a.modelID) || (a.basis !== 'sourced' && a.basis !== 'provisional') || !['higher', 'middle', 'lower', 'unknown'].includes(String(a.suitability)) || !Array.isArray(a.references) || a.references.length > 8 || a.references.some(ref => !ref || typeof ref !== 'object' || Array.isArray(ref) || typeof ref.sourceID !== 'string' || ref.sourceID.length > 128 || typeof ref.quote !== 'string' || ref.quote.length < 8 || ref.quote.length > 512)) throw new Error('invalid assessment');
  }
  const notices = value.notices === undefined && Object.keys(claims).length === 0 ? [] : value.notices;
  if (!Array.isArray(notices) || notices.length > 100 || notices.some(n => !n || typeof n !== 'object' || Array.isArray(n) || typeof n.id !== 'string' || !/^[0-9a-f-]{36}$/.test(n.id) || !Number.isSafeInteger(n.createdAt) || n.createdAt < 0 || !['reserved', 'started', 'unknown', 'completed', 'cancelled'].includes(n.status)) || new Set(notices.map(n => n.id)).size !== notices.length) throw new Error('invalid notices');
  if (Object.values(claims).some(id => !notices.some(n => n.id === id && ['reserved', 'started', 'unknown'].includes(n.status)))) throw new Error('missing claim notice');
  return { version: 1, discovery, dispatches: value.dispatches as number[], dispatchLimit: limit, claims: claims as Record<string, string>, assessments: assessments as Record<string, SavedAssessment>, notices: notices as DispatchNotice[] };
}

function validClassifier(value: unknown): value is ClassifierProvenance {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  return Object.keys(c).every(key => ['modelID', 'variant', 'calibrationVersion', 'promptVersion'].includes(key)) && typeof c.modelID === 'string' && /^[a-z0-9][a-z0-9._-]{0,127}$/.test(c.modelID) && (c.variant === undefined || (typeof c.variant === 'string' && /^[a-z0-9][a-z0-9._-]{0,63}$/.test(c.variant))) && typeof c.calibrationVersion === 'string' && /^[a-zA-Z0-9._-]{1,128}$/.test(c.calibrationVersion) && typeof c.promptVersion === 'string' && /^[a-zA-Z0-9._-]{1,128}$/.test(c.promptVersion);
}

/** Experimental transactional state. Not opened by the installed plugin. */
export class EvidenceStore {
  private readonly db: DatabaseSync;
  /** Inspection must never initialize, migrate or mutate operational state. */
  static inspect(file: string): { pending: number; completed: number; unknown: number; notices: readonly DispatchNotice[] } {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      db.exec('PRAGMA busy_timeout = 1000');
      const row = db.prepare('SELECT substr(value, 1, 1000001) AS value FROM router_state WHERE id = 1').get();
      if (!row) throw new Error('missing state');
      const state = parseState(row.value); const statuses = Object.values(state.discovery.work);
      return { pending: statuses.filter(s => s === 'pending').length, completed: statuses.filter(s => s === 'complete').length, unknown: statuses.filter(s => s === 'unknown' || s === 'issued').length, notices: state.notices };
    } finally { db.close(); }
  }
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    try {
      this.db.exec('PRAGMA busy_timeout = 1000; BEGIN IMMEDIATE');
      const existed = this.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'router_state'").get();
      if (!existed) {
        this.db.exec('CREATE TABLE router_state (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL)');
        this.db.prepare('INSERT INTO router_state (id, value) VALUES (1, ?)').run(JSON.stringify(initial()));
      }
      this.db.exec('CREATE TABLE IF NOT EXISTS classifier_checks (key TEXT PRIMARY KEY, passed INTEGER NOT NULL CHECK (passed IN (0, 1)), checked_at INTEGER NOT NULL DEFAULT 0)');
      if (!this.db.prepare('PRAGMA table_info(classifier_checks)').all().some(column => column.name === 'checked_at')) this.db.exec('ALTER TABLE classifier_checks ADD COLUMN checked_at INTEGER NOT NULL DEFAULT 0');
      this.db.exec('COMMIT');
    } catch (error) { this.db.close(); throw error; }
  }
  close(): void { this.db.close(); }
  classifierCheck(key: string, now = Date.now()): boolean | null {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('invalid classifier key');
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('invalid calibration time');
    const row = this.db.prepare('SELECT passed, checked_at FROM classifier_checks WHERE key = ?').get(key);
    if (!row) return null;
    if (row.passed !== 0 && row.passed !== 1) throw new Error('invalid classifier check');
    if (typeof row.checked_at !== 'number' || !Number.isSafeInteger(row.checked_at) || row.checked_at < 0 || row.checked_at > now) throw new Error('invalid calibration time');
    if (row.passed === 0 && now - row.checked_at >= 86_400_000) return null;
    return row.passed === 1;
  }
  saveClassifierCheck(key: string, passed: boolean, now = Date.now()): void {
    if (!/^[a-f0-9]{64}$/.test(key) || typeof passed !== 'boolean' || !Number.isSafeInteger(now) || now < 0) throw new Error('invalid classifier check');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const count = this.db.prepare('SELECT count(*) AS count FROM classifier_checks').get();
      if (Number(count?.count) >= 4096 && !this.db.prepare('SELECT key FROM classifier_checks WHERE key = ?').get(key)) throw new Error('classifier cache capacity exceeded');
      this.db.prepare('INSERT INTO classifier_checks (key, passed, checked_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET passed = excluded.passed, checked_at = excluded.checked_at').run(key, Number(passed), now);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private transaction<T>(update: (state: State) => { state: State; result: T }): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('SELECT value FROM router_state WHERE id = 1').get();
      if (!row) throw new Error('missing state');
      const { state, result } = update(parseState(row.value));
      const encoded = JSON.stringify(state);
      parseState(encoded);
      this.db.prepare('UPDATE router_state SET value = ? WHERE id = 1').run(encoded);
      this.db.exec('COMMIT');
      return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  snapshot(): DiscoveryState { return this.transaction(state => ({ state, result: state.discovery })); }
  observe(inventory: Inventory): readonly string[] {
    return this.transaction(state => {
      const result = observeInventory(state.discovery, inventory);
      return { state: { ...state, discovery: result.state }, result: result.added };
    });
  }
  /** Atomically mark this batch issued and reserve budget before the caller starts inference. */
  reserve(keys: readonly string[], now: number, limit: number): { allowed: boolean; usage: UsageSnapshot; claimID?: string } {
    return this.transaction<{ allowed: boolean; usage: UsageSnapshot; claimID?: string }>(state => {
      if (!Number.isSafeInteger(limit) || limit < 0 || limit > 100) throw new Error('invalid shared dispatch limit');
      if (state.dispatchLimit !== null && state.dispatchLimit !== limit) throw new Error('shared dispatch limit mismatch');
      const reservation = reserveDispatch({ dispatches: state.dispatches }, now, limit);
      if (!reservation.allowed) return { state: { ...state, dispatchLimit: limit }, result: { allowed: false, usage: reservation.usage } };
      const discovery = transitionWork(state.discovery, keys, 'pending', 'issued');
      const claimID = randomUUID();
      const claims = { ...state.claims };
      for (const key of keys) claims[key] = claimID;
      const notices = [...state.notices];
      if (notices.length === 100) {
        const removable = notices.findIndex(notice => notice.status === 'completed' || notice.status === 'cancelled');
        if (removable < 0) throw new Error('notice capacity exceeded');
        notices.splice(removable, 1);
      }
      notices.push({ id: claimID, createdAt: now, status: 'reserved' });
      return { state: { ...state, discovery, claims, notices, dispatchLimit: limit, dispatches: [...reservation.ledger.dispatches] }, result: { allowed: true, usage: reservation.usage, claimID } };
    });
  }
  /** Complete direct evidence only; inference transitions require the reservation's claim. */
  completeDirect(keys: readonly string[]): void {
    this.transaction(state => ({ state: { ...state, discovery: transitionWork(state.discovery, keys, 'pending', 'complete') }, result: undefined }));
  }
  /** Validate a complete owned batch and commit its results and status together. */
  completeAssessments(claimID: string, records: readonly AssessmentRecord[]): void {
    if (!Array.isArray(records) || records.length === 0 || records.length > 16 || Buffer.byteLength(JSON.stringify(records), 'utf8') > 65536) throw new Error('invalid assessments');
    const keys = records.map(row => discoveryKey('openai', row.hostID));
    if (new Set(keys).size !== keys.length || records.some(row => !validClassifier(row.classifier) || !Number.isSafeInteger(row.retrievedAt) || row.retrievedAt < 0 || !Array.isArray(row.packet.sources) || row.packet.sources.length > 8 || new Set(row.packet.sources.map((source: EvidenceSource) => source.id)).size !== row.packet.sources.length || row.packet.sources.some((source: EvidenceSource) => source.id !== 'openai-model-index' || source.url !== OPENAI_MODEL_INDEX || typeof source.text !== 'string' || source.text.length > 2048) || !validateAssessments({ assessments: [row.assessment] }, [row.packet]))) throw new Error('invalid assessments');
    this.transaction(state => {
      if (keys.some(key => state.claims[key] !== claimID) || Object.keys(state.claims).filter(key => state.claims[key] === claimID).length !== keys.length) throw new Error('invalid claim ownership');
      if (!state.notices.some(n => n.id === claimID && (n.status === 'started' || n.status === 'unknown'))) throw new Error('dispatch not started');
      const previous = state.discovery.work[keys[0]];
      if (previous !== 'issued' && previous !== 'unknown') throw new Error('invalid work transition');
      const discovery = transitionWork(state.discovery, keys, previous, 'complete');
      const claims = { ...state.claims }; const assessments = { ...state.assessments };
      for (let index = 0; index < keys.length; index++) {
        delete claims[keys[index]];
        const row = records[index];
        const fingerprint = evidenceFingerprint(row.packet, row.classifier, `${row.classifier.promptVersion}:${row.classifier.calibrationVersion}`);
        const sources = row.packet.sources.map((source: EvidenceSource) => ({ id: source.id, url: source.url, contentHash: createHash('sha256').update(source.text).digest('hex') }));
        assessments[keys[index]] = { fingerprint, assessment: row.assessment, classifier: row.classifier, retrievedAt: row.retrievedAt, sources };
      }
      const notices = state.notices.map(notice => notice.id === claimID ? { ...notice, status: 'completed' as const } : notice);
      return { state: { ...state, discovery, claims, assessments, notices }, result: undefined };
    });
  }
  assessment(key: string): SavedAssessment | null {
    return this.transaction(state => ({ state, result: state.assessments[key] ?? null }));
  }
  notices(): readonly DispatchNotice[] { return this.transaction(state => ({ state, result: state.notices })); }
  markStarted(claimID: string): void {
    this.transaction(state => {
      if (!Object.values(state.claims).includes(claimID) || !state.notices.some(n => n.id === claimID && n.status === 'reserved')) throw new Error('invalid dispatch notice');
      return { state: { ...state, notices: state.notices.map(n => n.id === claimID ? { ...n, status: 'started' as const } : n) }, result: undefined };
    });
  }
  /** A fully received response was rejected: keep its usage, release work for a later candidate. */
  rejectCalibration(claimID: string, keys: readonly string[]): void {
    this.transaction(state => {
      if (!keys.length || keys.some(key => state.claims[key] !== claimID || state.discovery.work[key] !== 'issued') || Object.values(state.claims).filter(id => id === claimID).length !== keys.length) throw new Error('invalid claim ownership');
      const claims = { ...state.claims };
      for (const key of keys) delete claims[key];
      return { state: { ...state, claims, discovery: transitionWork(state.discovery, keys, 'issued', 'pending'), notices: state.notices.map(n => n.id === claimID ? { ...n, status: 'completed' as const } : n) }, result: undefined };
    });
  }
  /** A pending transition is valid only when the caller has proven no dispatch occurred. */
  settleClaim(claimID: string, keys: readonly string[], from: WorkStatus, to: WorkStatus): void {
    this.transaction(state => {
      if (!keys.length || keys.some(key => state.claims[key] !== claimID) || Object.keys(state.claims).filter(key => state.claims[key] === claimID).length !== keys.length) throw new Error('invalid claim ownership');
      if (to === 'complete') throw new Error('completion requires assessments');
      if (to === 'pending' && !state.notices.some(n => n.id === claimID && n.status === 'reserved')) throw new Error('cannot cancel a started dispatch');
      const discovery = transitionWork(state.discovery, keys, from, to);
      const claims = { ...state.claims };
      if (to === 'pending') for (const key of keys) delete claims[key];
      const notices = state.notices.map(n => n.id === claimID ? { ...n, status: to === 'unknown' ? 'unknown' as const : 'cancelled' as const } : n);
      return { state: { ...state, discovery, claims, notices }, result: undefined };
    });
  }
}
