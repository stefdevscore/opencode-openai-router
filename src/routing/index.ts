import type { RoutingDecision, RoutingReason, Selection, TaskDemand } from "../contracts/index.js";
import type { Catalog } from "../catalog/index.js";
import type { Config } from "../config/index.js";

export interface EffortInput {
  catalog: Catalog;
  config: Config;
  providerID: string;
  /** Host provider availability is separate from model-list membership. */
  providerAvailable: boolean | null;
  modelID: string;
  currentVariant?: string;
  /** Generation captured together with the validated configuration. */
  configGeneration: number;
  /** A caller-supplied assessment; deriving it from a prompt is future work. */
  demand: TaskDemand;
}

export type EffortDecision = RoutingDecision;

const effortOrder = ["none", "minimal", "low", "medium", "high", "xhigh"] as const;

/** Pure provisional decision; this function is not wired to host routing. */
export function decideEffort(input: EffortInput): EffortDecision {
  const original: Selection = { providerID: input.providerID, modelID: input.modelID, ...(input.currentVariant === undefined ? {} : { variant: input.currentVariant }) };
  const context = { original, policyVersion: "provisional-effort-v1", configGeneration: input.configGeneration };
  const keep = (reason: RoutingReason): EffortDecision => ({ ...context, action: "keep", reasons: [reason] });
  if (input.config.mode === "off") return keep("disabled");
  if (input.providerID !== "openai" || input.providerAvailable !== true || input.catalog.status !== "available" || !input.catalog.complete) return keep("catalog_unavailable");
  if (input.demand !== "complex") return keep("task_unknown");
  const model = input.catalog.models.find(candidate => candidate.id === input.modelID);
  if (!model?.variants || !input.currentVariant) return keep("variant_unknown");
  const current = model.variants.find(variant => variant.name === input.currentVariant);
  if (!current?.effortOnly || !current.reasoningEffort) return keep("variant_unknown");
  const currentRank = effortOrder.findIndex(effort => effort === current.reasoningEffort);
  if (currentRank < 0) return keep("variant_unknown");
  const targets = input.config.profile === "quality" ? ["xhigh", "high"] : ["high"];
  for (const effort of targets) {
    const rank = effortOrder.findIndex(item => item === effort);
    if (rank <= currentRank) continue;
    const matches = model.variants.filter(variant => variant.effortOnly && variant.reasoningEffort === effort);
    if (matches.length > 1) return keep("variant_unknown");
    if (matches.length === 1) return { ...context, action: "select", proposed: { providerID: "openai", modelID: input.modelID, variant: matches[0].name }, reasons: ["proposed"] };
  }
  return keep("unchanged");
}
