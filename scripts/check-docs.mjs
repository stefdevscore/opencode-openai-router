import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

async function markdownFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await markdownFiles(name));
    else if (entry.isFile() && name.endsWith(".md")) result.push(name);
  }
  return result;
}
const files = ["README.md", ...await markdownFiles("docs"), ...await markdownFiles("research")];
const failures = [];
// Active compatibility evidence is v2; historical v1 results are not an acceptance gate.
for (const name of await readdir("docs/evidence")) {
  if (!name.endsWith(".json")) continue;
  try { JSON.parse(await readFile(path.join("docs/evidence", name), "utf8")); }
  catch { failures.push(`docs/evidence/${name}: invalid JSON evidence`); }
}
try {
  const report = JSON.parse(await readFile("docs/evidence/host-2.1.4.json", "utf8"));
  if (report.version !== "opencode v2.1.4" || !report.events?.some(event => event.type === "catalog" && event.localModels?.includes("probe-a")) || !report.requests?.some(request => request.model === "probe-a")) {
    failures.push("docs/evidence/host-2.1.4.json: incomplete v2 loader/catalog evidence");
  }
} catch { failures.push("docs/evidence/host-2.1.4.json: missing or invalid evidence"); }
for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const [index, line] of source.split("\n").entries()) {
    if (line.trimEnd() !== line) failures.push(`${file}:${index + 1}: trailing whitespace`);
  }
  for (const [, raw] of source.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^[a-z][a-z\d+.-]*:/i.test(raw)) continue;
    const [target, fragment] = raw.split("#");
    const destination = target ? path.resolve(path.dirname(file), decodeURIComponent(target)) : path.resolve(file);
    try {
      if (!(await stat(destination)).isFile()) throw new Error("not a file");
      if (fragment && destination.endsWith(".md")) {
        const headings = (await readFile(destination, "utf8")).matchAll(/^#{1,6}\s+(.+)$/gm);
        const slugs = [...headings].map(([, h]) => h.toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, "").replaceAll(" ", "-"));
        if (!slugs.includes(decodeURIComponent(fragment))) failures.push(`${file}: missing anchor ${raw}`);
      }
    } catch {
      failures.push(`${file}: missing local target ${raw}`);
    }
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else console.log(`Checked ${files.length} Markdown files: local links, anchors and whitespace OK`);
