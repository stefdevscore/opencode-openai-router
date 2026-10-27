import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCatalog, normalizeV2Catalog } from "../dist/catalog/index.js";
import { parseConfig } from "../dist/config/index.js";
import { recommendEffort } from "../dist/routing/index.js";

const model = (variants) => ({ id: "example", providerID: "openai", status: "active", limit: { context: 32000 }, capabilities: { toolcall: true }, variants });
const response = (models) => ({ connected: ["openai"], all: [{ id: "openai", options: { secret: "do-not-retain" }, models }] });
const ordinaryVariants = { low: { reasoningEffort: "low" }, high: { reasoningEffort: "high" }, xhigh: { reasoningEffort: "xhigh" } };

test("catalog only includes connected OpenAI model facts and drops credentials", () => {
  const catalog = normalizeCatalog(response({ example: model(ordinaryVariants), retired: { id: "retired", status: "deprecated" }, broken: null }));
  assert.equal(catalog.status, "available");
  assert.equal(catalog.complete, false);
  assert.deepEqual(catalog.models.map(item => item.id), ["example"]);
  assert.equal(catalog.models[0].contextLimit, 32000);
  assert.ok(!JSON.stringify(catalog).includes("do-not-retain"));
  assert.deepEqual(normalizeCatalog({ all: [], connected: [] }), { status: "unavailable", reason: "disconnected" });
  assert.equal(normalizeCatalog({ all: [], connected: [null] }).reason, "invalid_response");
});

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

test("config defaults safely and rejects auto, malformed entries, and duplicate roles", () => {
  assert.equal(parseConfig().config.mode, "recommend");
  assert.equal(parseConfig().config.profile, "balanced");
  for (const value of [{ mode: "auto" }, { profile: "fast" }, { roles: { general: ["x", "x"] } }, { roles: { general: [1] } }, { unknown: true }]) {
    assert.deepEqual(parseConfig(value), { ok: false, reason: "invalid_config" });
  }
  const original = { roles: { general: ["example"] } };
  const parsed = parseConfig(original);
  original.roles.general.push("later");
  assert.deepEqual(parsed.config.roles.general, ["example"]);
});

test("complex-task effort recommendations are upward-only and respect explicit selection", () => {
  const catalog = normalizeCatalog(response({ example: model(ordinaryVariants) }));
  const base = { catalog, config: parseConfig().config, providerID: "openai", modelID: "example", currentVariant: "low", demand: "complex", explicitSelection: false, agentPinned: false };
  assert.deepEqual(recommendEffort(base), { action: "recommend", modelID: "example", variant: "high", reason: "complex_task" });
  assert.equal(recommendEffort({ ...base, config: parseConfig({ profile: "quality" }).config }).variant, "xhigh");
  assert.equal(recommendEffort({ ...base, explicitSelection: true }).reason, "manual_selection");
  assert.equal(recommendEffort({ ...base, agentPinned: true }).reason, "manual_selection");
  assert.equal(recommendEffort({ ...base, explicitSelection: undefined }).reason, "manual_selection");
  assert.equal(recommendEffort({ ...base, demand: "unknown" }).reason, "task_unknown");
  assert.equal(recommendEffort({ ...base, currentVariant: "xhigh" }).reason, "unchanged");
});

test("unknown, ambiguous, and unrelated variant settings abstain", () => {
  const base = { config: parseConfig().config, providerID: "openai", modelID: "example", currentVariant: "low", demand: "complex", explicitSelection: false, agentPinned: false };
  for (const variants of [
    { low: { reasoningEffort: "low", textVerbosity: "short" }, high: { reasoningEffort: "high" } },
    { low: { reasoningEffort: "low" }, high: { reasoningEffort: "high", textVerbosity: "short" } },
    { low: { reasoningEffort: "low" }, high: { reasoningEffort: "high" }, other: { reasoningEffort: "high" } },
    { low: { reasoningEffort: "low" }, high: { reasoningEffort: "high", disabled: true } },
  ]) {
    assert.equal(recommendEffort({ ...base, catalog: normalizeCatalog(response({ example: model(variants) })) }).action, "keep");
  }
});
