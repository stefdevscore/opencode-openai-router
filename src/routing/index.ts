import type { Catalog } from "../catalog/index.js";
import type { Config } from "../config/index.js";

export interface EffortInput {
  catalog: Catalog;
  config: Config;
  providerID: string;
  modelID: string;
  currentVariant?: string;
  /** A caller-supplied assessment; deriving it from a prompt is future work. */
  demand: "complex" | "unknown";
  explicitSelection: boolean;
  agentPinned: boolean;
}

export type EffortRecommendation =
  | { action: "keep"; reason: string }
  | { action: "recommend"; modelID: string; variant: string; reason: "complex_task" };

const effortOrder = ["none", "minimal", "low", "medium", "high", "xhigh"] as const;

/** Recommendation only: this function does not inspect prompts or change a host request. */
export function recommendEffort(input: EffortInput): EffortRecommendation {
  if (input.config.mode === "off") return { action: "keep", reason: "disabled" };
  if (input.explicitSelection !== false || input.agentPinned !== false) return { action: "keep", reason: "manual_selection" };
  if (input.providerID !== "openai" || input.catalog.status !== "available") return { action: "keep", reason: "catalog_unavailable" };
  if (input.demand !== "complex") return { action: "keep", reason: "task_unknown" };
  const model = input.catalog.models.find(candidate => candidate.id === input.modelID);
  if (!model?.variants || !input.currentVariant) return { action: "keep", reason: "variant_unknown" };
  const current = model.variants.find(variant => variant.name === input.currentVariant);
  if (!current?.effortOnly || !current.reasoningEffort) return { action: "keep", reason: "variant_unknown" };
  const currentRank = effortOrder.findIndex(effort => effort === current.reasoningEffort);
  if (currentRank < 0) return { action: "keep", reason: "variant_unknown" };
  const targets = input.config.profile === "quality" ? ["xhigh", "high"] : ["high"];
  for (const effort of targets) {
    const rank = effortOrder.findIndex(item => item === effort);
    if (rank <= currentRank) continue;
    const matches = model.variants.filter(variant => variant.effortOnly && variant.reasoningEffort === effort);
    if (matches.length > 1) return { action: "keep", reason: "variant_ambiguous" };
    if (matches.length === 1) return { action: "recommend", modelID: input.modelID, variant: matches[0].name, reason: "complex_task" };
  }
  return { action: "keep", reason: "unchanged" };
}
