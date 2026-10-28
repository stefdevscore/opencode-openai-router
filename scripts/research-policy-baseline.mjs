// Exploratory toy heuristics; neither is a production router or independent quality evaluation.
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
const input = process.argv[2] ?? "policy-fixture-v1.json";
if (!["policy-fixture-v1.json", "policy-holdout-v1.json"].includes(input)) throw new Error("Unknown fixture");
const fixtures = JSON.parse(await readFile(new URL(`../research/${input}`, import.meta.url), "utf8"));
const strategies = {
  keep: () => "unknown",
  keyword: text => /\b(rename|typo|format|sort)\b/i.test(text) ? "simple" : /\b(transactional|data loss|authentication|concurrent|migration|billing)\b/i.test(text) ? "complex" : "unknown",
  guarded: text => {
    if (/\b(do not|don't|quoted|wrote|discussed|previous|attached|whether|first inspect)\b/i.test(text)) return "unknown";
    if (/\b(security|authorization|public api|migration|billing|payment|ledger|concurrent|transactional|data loss|authentication|services|persisted|fleet)\b/i.test(text)) return "complex";
    if (/^(rename the internal variable|fix the typo in this readme heading|sort these four existing import statements|add a one-line comment)\b/i.test(text)) return "simple";
    return "unknown";
  },
};
const results = {};
for (const [name, assess] of Object.entries(strategies)) {
  const start = performance.now();
  const rows = fixtures.map(({ id, label, prompt }) => ({ id, label, prediction: assess(prompt) }));
  const elapsed = performance.now() - start;
  const matrix = Object.fromEntries(["simple", "complex", "ambiguous"].map(label => [label, Object.fromEntries(["simple", "complex", "unknown"].map(prediction => [prediction, rows.filter(r => r.label === label && r.prediction === prediction).length]))]));
  results[name] = { matrix, falseDownshiftIds: rows.filter(r => r.label !== "simple" && r.prediction === "simple").map(r => r.id), millisecondsForBatch: elapsed, rows };
}
console.log(JSON.stringify({ fixtureCount: fixtures.length, results }, null, 2));
