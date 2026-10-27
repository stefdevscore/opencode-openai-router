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
const files = ["README.md", ...await markdownFiles("docs")];
const failures = [];
const evidence = "docs/evidence/host-1.19.4.json";
try {
  const report = JSON.parse(await readFile(evidence, "utf8"));
  if (report.hostVersion !== "1.19.4" || report.results?.length !== 5 || report.providerRequests?.length !== 5) {
    failures.push(`${evidence}: incomplete pinned-host evidence`);
  }
} catch {
  failures.push(`${evidence}: missing or invalid JSON evidence`);
}
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
