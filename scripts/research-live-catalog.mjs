// Read-only summary of the active local OpenAI catalog; no credentials or model IDs are printed.
// Usage: node scripts/research-live-catalog.mjs /absolute/path/to/opencode-2.1.4
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const binary = process.argv[2];
assert.ok(binary && path.isAbsolute(binary));
const root = mkdtempSync(path.join(os.tmpdir(), "router-live-catalog-"));
try {
  mkdirSync(path.join(root, "plugin"));
  mkdirSync(path.join(root, "config"));
  writeFileSync(path.join(root, "plugin", "package.json"), JSON.stringify({ name: "router-catalog-audit", type: "module", exports: "./index.js" }));
  const summary = path.join(root, "summary.json");
  writeFileSync(path.join(root, "plugin", "index.js"), `import { writeFile } from 'node:fs/promises';
export default { id: 'router.catalog.audit', async setup(ctx) {
  const r = await ctx.model.list(); const ms = r.data.filter(m => m.providerID === 'openai');
  const out = { count: ms.length, enabled: ms.filter(m => m.enabled).length, withContext: ms.filter(m => m.limit?.context > 0).length, withTools: ms.filter(m => m.capabilities?.tools).length, withVariants: ms.filter(m => m.variants?.length).length, variantsWithReasoning: ms.reduce((n,m) => n + m.variants.filter(v => typeof v.settings?.reasoningEffort === 'string').length, 0), statuses: [...new Set(ms.map(m => m.status))].sort() };
  await writeFile(${JSON.stringify(summary)}, JSON.stringify(out));
} };`);
  writeFileSync(path.join(root, "opencode.json"), JSON.stringify({ plugins: ["./plugin"] }));
  const env = Object.fromEntries(["PATH", "HOME", "TMPDIR"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  Object.assign(env, { XDG_CONFIG_HOME: path.join(root, "config"), OPENCODE_DISABLE_AUTOUPDATE: "true" });
  const result = spawnSync(binary, ["models", "--standalone"], { cwd: root, env, encoding: "utf8", timeout: 60000 });
  assert.equal(result.status, 0, "Catalog command failed; raw output withheld");
  assert.ok(existsSync(summary), "Plugin setup did not produce summary");
  console.log(readFileSync(summary, "utf8"));
} finally { rmSync(root, { recursive: true, force: true }); }
