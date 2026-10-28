// Evaluate exploratory fixed heuristics against externally annotated human completion times.
// Input is a local JSON array {id,difficulty,prompt}; only aggregate data is emitted.
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
const filename = process.argv[2];
if (!filename) throw new Error('Provide a local SWE-bench Verified extraction');
const cases = JSON.parse(await readFile(filename, 'utf8'));
const assessors = {
  keep: () => 'unknown',
  keyword: text => /\b(rename|typo|format|sort)\b/i.test(text) ? 'simple' : /\b(transactional|data loss|authentication|concurrent|migration|billing)\b/i.test(text) ? 'complex' : 'unknown',
  guarded: text => {
    if (/\b(do not|don't|quoted|wrote|discussed|previous|attached|whether|first inspect)\b/i.test(text)) return 'unknown';
    if (/\b(security|authorization|public api|migration|billing|payment|ledger|concurrent|transactional|data loss|authentication|services|persisted|fleet)\b/i.test(text)) return 'complex';
    if (/^(rename the internal variable|fix the typo in this readme heading|sort these four existing import statements|add a one-line comment)\b/i.test(text)) return 'simple';
    return 'unknown';
  },
};
const labels = ['<15 min fix','15 min - 1 hour','1-4 hours','>4 hours'];
const result = {source:'SWE-bench/SWE-bench_Verified', fixtureCount:cases.length, labelMeaning:'human completion-time estimate, not a model-routing quality label', results:{}};
for(const [name,assess] of Object.entries(assessors)) {
 const start=performance.now(); const matrix=Object.fromEntries(labels.map(label=>[label,{simple:0,complex:0,unknown:0}])); let over16k=0;
 for(const c of cases){if(!matrix[c.difficulty]) throw new Error(`Unexpected label ${c.difficulty}`); if(c.prompt.length>16000)over16k++; matrix[c.difficulty][assess(c.prompt.slice(0,16000))]++;}
 result.results[name]={matrix,longInputTruncated:over16k,millisecondsForBatch:performance.now()-start};
}
console.log(JSON.stringify(result,null,2));
