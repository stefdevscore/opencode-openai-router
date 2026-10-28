/** Exact host selection. An omitted variant is the host's default. */
export interface Selection {
  providerID: string;
  modelID: string;
  variant?: string;
}

/** A bounded assessment supplied to the policy; unknown never implies low demand. */
export type TaskDemand = "complex" | "unknown";

/** Evidence is explicit about missing data; a snapshot does not prove entitlement. */
export type EvidenceSnapshot =
  | { status: "unknown" }
  | { status: "available"; generation: number; retrievedAt: number; modelIDs: readonly string[] };

/** Stable codes shared by policy and its consumers; ordered as in the routing spec. */
export type RoutingReason =
  | "disabled" | "unsupported_origin" | "config_changed" | "invalid_config"
  | "catalog_unavailable" | "catalog_stale" | "disconnected" | "candidate_unavailable"
  | "model_evidence_unknown" | "task_unknown" | "context_unknown" | "context_exceeded"
  | "variant_unknown" | "cooldown" | "unchanged" | "proposed" | "deadline"
  | "host_error" | "dispatch_mismatch" | "dispatch_unknown";

interface DecisionContext {
  readonly original: Readonly<Selection>;
  readonly reasons: readonly RoutingReason[];
  readonly policyVersion: string;
  readonly configGeneration: number;
}

/** Pure decisions are proposals, not proof of a host switch. */
export type RoutingDecision =
  | (DecisionContext & { readonly action: "keep" })
  | (DecisionContext & { readonly action: "select"; readonly proposed: Readonly<Selection> });

/** Observed dispatch is distinct from successful task completion. */
export type RoutingOutcome = "kept" | "proposed" | "observed" | "mismatch" | "unknown";
