/** A bounded, credential-free view of the host's OpenAI inventory. */
export interface Variant {
  name: string;
  reasoningEffort: string | null;
  /** False when selecting the variant could change settings besides effort. */
  effortOnly: boolean;
}

export interface Model {
  id: string;
  contextLimit: number | null;
  toolCalls: boolean | null;
  variants: readonly Variant[] | null;
}

export type Catalog =
  | { status: "unavailable"; reason: "invalid_response" | "disconnected" | "missing_provider" }
  | { status: "available"; complete: boolean; models: readonly Model[] };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function variants(value: unknown): readonly Variant[] | null {
  if (!record(value) || Object.keys(value).length > 128) return null;
  const result: Variant[] = [];
  for (const [name, options] of Object.entries(value)) {
    if (!name || name.length > 128 || !record(options)) return null;
    if (options.disabled === true) continue;
    if (options.disabled !== undefined && options.disabled !== false) return null;
    const effort = options.reasoningEffort;
    if (effort !== undefined && (typeof effort !== "string" || !effort || effort.length > 64)) return null;
    result.push({
      name,
      reasoningEffort: typeof effort === "string" ? effort : null,
      effortOnly: typeof effort === "string" && Object.keys(options).every(key => key === "reasoningEffort" || key === "disabled"),
    });
  }
  return result;
}

/** Normalize a provider-list response without retaining provider options or secrets. */
export function normalizeCatalog(value: unknown): Catalog {
  if (!record(value) || !Array.isArray(value.all) || value.all.length > 1024 || !Array.isArray(value.connected) || value.connected.length > 1024 || !value.connected.every(id => typeof id === "string" && id.length <= 128)) {
    return { status: "unavailable", reason: "invalid_response" };
  }
  if (!value.connected.includes("openai")) return { status: "unavailable", reason: "disconnected" };
  const providers = value.all.filter(provider => record(provider) && provider.id === "openai");
  if (providers.length !== 1 || !record(providers[0]) || !record(providers[0].models) || Object.keys(providers[0].models).length > 1024) {
    return { status: "unavailable", reason: "missing_provider" };
  }
  let complete = true;
  const models: Model[] = [];
  for (const [id, raw] of Object.entries(providers[0].models)) {
    if (!id || id.length > 128 || !record(raw) || (raw.id !== undefined && raw.id !== id) || (raw.providerID !== undefined && raw.providerID !== "openai") || (raw.status !== undefined && (typeof raw.status !== "string" || !["active", "alpha", "beta", "deprecated"].includes(raw.status)))) {
      complete = false;
      continue;
    }
    if (raw.disabled === true || raw.status === "deprecated") continue;
    if (raw.disabled !== undefined && raw.disabled !== false) { complete = false; continue; }
    const limit = record(raw.limit) && typeof raw.limit.context === "number" && Number.isSafeInteger(raw.limit.context) && raw.limit.context > 0 ? raw.limit.context : null;
    const caps = record(raw.capabilities) ? raw.capabilities : null;
    const tools = caps && typeof caps.toolcall === "boolean" ? caps.toolcall : null;
    models.push({ id, contextLimit: limit, toolCalls: tools, variants: variants(raw.variants) });
  }
  return { status: "available", complete, models };
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
    const limit = record(raw.limit) && typeof raw.limit.context === "number" && Number.isSafeInteger(raw.limit.context) && raw.limit.context > 0 ? raw.limit.context : null;
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
        const effort = settings.reasoningEffort;
        if (effort !== undefined && (typeof effort !== "string" || !effort || effort.length > 64)) { normalized = null; break; }
        normalized.push({
          name: variant.id,
          reasoningEffort: typeof effort === "string" ? effort : null,
          effortOnly: typeof effort === "string" && Object.keys(settings).every(key => key === "reasoningEffort") && variant.headers === undefined && variant.body === undefined,
        });
      }
    }
    models.push({ id: raw.id, contextLimit: limit, toolCalls: tools, variants: normalized });
  }
  if (!sawOpenAI) return { status: "unavailable", reason: "missing_provider" };
  return { status: "available", complete, models };
}
