import assert from "node:assert/strict";
import test from "node:test";
import { normalizeV2Catalog } from "../dist/catalog/index.js";
import { parseConfig } from "../dist/config/index.js";
import { decideEffort } from "../dist/routing/index.js";

const v2Model = (variants) => ({ id: "example", providerID: "openai", enabled: true, status: "active", limit: { context: 32000 }, capabilities: { tools: true }, variants });
const catalogWith = (variants) => normalizeV2Catalog({ data: [v2Model(variants)] });
const variant = (id, options = {}) => ({ id, settings: { reasoningEffort: id, ...options } });
const ordinaryVariants = [variant("low"), variant("high"), variant("xhigh")];

test("v2 model list uses enabled OpenAI models and preserves variant safety", () => {
  const v2Model = { id: "example", providerID: "openai", enabled: true, status: "active", limit: { context: 32000 }, capabilities: { tools: true }, variants: [
    { id: "low", settings: { reasoningEffort: "low" } },
    { id: "high", settings: { reasoningEffort: "high" } },
    { id: "custom", settings: { reasoningEffort: "xhigh" }, headers: { "x-custom": "value" } },
  ] };
  const catalog = normalizeV2Catalog({ data: [v2Model, { ...v2Model, id: "off", enabled: false }, { ...v2Model, id: "other", providerID: "local" }] });
  assert.equal(catalog.status, "available");
  assert.deepEqual(catalog.models.map(item => item.id), ["example"]);
  assert.equal(catalog.models[0].variants.find(item => item.name === "custom").effortOnly, false);
  assert.equal(normalizeV2Catalog({ data: [{ ...v2Model }, { ...v2Model }] }).reason, "invalid_response");
  assert.equal(normalizeV2Catalog({ data: [] }).reason, "missing_provider");
});

test("config defaults to automatic balanced mode and rejects unsupported values", () => {
  assert.deepEqual(parseConfig(), { ok: true, config: { mode: "auto", profile: "balanced" } });
  assert.deepEqual(parseConfig({ mode: "off", profile: "quality" }), { ok: true, config: { mode: "off", profile: "quality" } });
  for (const value of [{ mode: "recommend" }, { profile: "fast" }, { roles: {} }, { unknown: true }, { mode: null }, { profile: null }, { mode: undefined }, { profile: undefined }, null]) {
    assert.deepEqual(parseConfig(value), { ok: false, reason: "invalid_config" });
  }
});

test("automatic effort decisions are upward-only and abstain when disabled or demand is unknown", () => {
  const base = { catalog: catalogWith(ordinaryVariants), config: parseConfig().config, providerID: "openai", providerAvailable: true, modelID: "example", currentVariant: "low", demand: "complex", configGeneration: 7 };
  assert.deepEqual(decideEffort(base), { action: "select", original: { providerID: "openai", modelID: "example", variant: "low" }, proposed: { providerID: "openai", modelID: "example", variant: "high" }, reasons: ["proposed"], policyVersion: "provisional-effort-v1", configGeneration: 7 });
  assert.equal(decideEffort({ ...base, config: parseConfig({ profile: "quality" }).config }).proposed.variant, "xhigh");
  assert.equal(decideEffort({ ...base, config: parseConfig({ mode: "off" }).config }).reasons[0], "disabled");
  assert.equal(decideEffort({ ...base, demand: "unknown" }).reasons[0], "task_unknown");
  assert.equal(decideEffort({ ...base, providerAvailable: null }).reasons[0], "catalog_unavailable");
  assert.equal(decideEffort({ ...base, providerAvailable: false }).reasons[0], "catalog_unavailable");
  assert.equal(decideEffort({ ...base, catalog: { ...base.catalog, complete: false } }).reasons[0], "catalog_unavailable");
  assert.equal(decideEffort({ ...base, currentVariant: "xhigh" }).reasons[0], "unchanged");
  const kept = decideEffort({ ...base, currentVariant: undefined });
  assert.deepEqual(kept.original, { providerID: "openai", modelID: "example" });
  assert.equal(kept.configGeneration, 7);
  assert.equal("proposed" in kept, false);
});

test("unknown, ambiguous, and unrelated variant settings abstain", () => {
  const base = { config: parseConfig().config, providerID: "openai", providerAvailable: true, modelID: "example", currentVariant: "low", demand: "complex", configGeneration: 0 };
  for (const variants of [
    [variant("low", { textVerbosity: "short" }), variant("high")],
    [variant("low"), variant("high", { textVerbosity: "short" })],
    [variant("low"), variant("high"), { id: "other", settings: { reasoningEffort: "high" } }],
    [variant("low")],
  ]) assert.equal(decideEffort({ ...base, catalog: catalogWith(variants) }).action, "keep");
});
