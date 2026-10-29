/** A bounded, credential-free view of the host's OpenAI inventory. */
export interface Variant {
  name: string;
  reasoningEffort: string | null;
  /** Host settings retained only in memory; never exposed by the inspection RPC. */
  settings: Readonly<Record<string, unknown>>;
  /** False when selecting the variant could change settings besides effort. */
  effortOnly: boolean;
}

export interface Model {
  id: string;
  providerID?: string;
  /** Provider-facing identity; retained locally and never exposed by inspection RPC. */
  providerModelID?: string;
  contextLimit: number | null;
  inputLimit?: number | null;
  outputLimit?: number | null;
  toolCalls: boolean | null;
  inputModalities?: readonly string[] | null;
  outputModalities?: readonly string[] | null;
  variants: readonly Variant[] | null;
}

export type Catalog =
  | { status: "unavailable"; reason: "invalid_response" | "disconnected" | "missing_provider" }
  | { status: "available"; complete: boolean; models: readonly Model[] };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalize the v2 model-list response; it exposes models, not account entitlement. */
export function normalizeV2Catalog(value: unknown): Catalog {
  if (!record(value) || !Array.isArray(value.data) || value.data.length > 4096) {
    return { status: "unavailable", reason: "invalid_response" };
  }
  let complete = true;
  let sawOpenAI = false;
  const models: Model[] = [];
  const seen = new Set<string>();
  for (const raw of value.data) {
    if (!record(raw) || typeof raw.providerID !== "string") { complete = false; continue; }
    if (raw.providerID !== "openai") continue;
    sawOpenAI = true;
    if (typeof raw.id !== "string" || !raw.id || raw.id.length > 128 || typeof raw.enabled !== "boolean" || typeof raw.status !== "string" || !["active", "alpha", "beta", "deprecated"].includes(raw.status)) {
      complete = false;
      continue;
    }
    if (seen.has(raw.id)) return { status: "unavailable", reason: "invalid_response" };
    seen.add(raw.id);
    if (!raw.enabled || raw.status === "deprecated") continue;
    const number = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
    const limit = record(raw.limit) ? raw.limit : {};
    const modalities = (value: unknown): string[] | null => Array.isArray(value) && value.length <= 32 && value.every(x => typeof x === "string" && x.length > 0 && x.length <= 64) ? [...new Set(value)] : null;
    const caps = record(raw.capabilities) ? raw.capabilities : null;
    const tools = caps && typeof caps.tools === "boolean" ? caps.tools : null;
    let normalized: Variant[] | null = [];
    if (!Array.isArray(raw.variants) || raw.variants.length > 128) normalized = null;
    else {
      const variantIds = new Set<string>();
      for (const variant of raw.variants) {
        if (!record(variant) || typeof variant.id !== "string" || !variant.id || variant.id.length > 128 || variantIds.has(variant.id) || (variant.settings !== undefined && !record(variant.settings))) { normalized = null; break; }
        variantIds.add(variant.id);
        const settings = record(variant.settings) ? variant.settings : {};
        let settingsCopy: Record<string, unknown>;
        try {
          const encoded = JSON.stringify(settings);
          if (!encoded || encoded.length > 8192) { normalized = null; break; }
          settingsCopy = JSON.parse(encoded) as Record<string, unknown>;
        } catch { normalized = null; break; }
        const effort = settings.reasoningEffort;
        if (effort !== undefined && (typeof effort !== "string" || !effort || effort.length > 64)) { normalized = null; break; }
        normalized.push({
          name: variant.id,
          reasoningEffort: typeof effort === "string" ? effort : null,
          settings: settingsCopy,
          effortOnly: typeof effort === "string" && Object.keys(settings).every(key => key === "reasoningEffort") && variant.headers === undefined && variant.body === undefined,
        });
      }
    }
    const providerModelID = typeof raw.modelID === 'string' && raw.modelID.length > 0 && raw.modelID.length <= 128 ? raw.modelID : undefined;
    models.push({ id: raw.id, providerID: "openai", ...(providerModelID === undefined ? {} : { providerModelID }), contextLimit: number(limit.context), inputLimit: number(limit.input), outputLimit: number(limit.output), toolCalls: tools, inputModalities: modalities(caps?.input), outputModalities: modalities(caps?.output), variants: normalized });
  }
  if (!sawOpenAI) return { status: "unavailable", reason: complete ? "missing_provider" : "invalid_response" };
  return { status: "available", complete, models };
}
