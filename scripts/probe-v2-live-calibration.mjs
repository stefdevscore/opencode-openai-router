// Explicitly live: at most one plugin dispatch; host retries and allowance are not capped.
// Uses the existing background OpenCode service and a disposable project plugin.
// Usage: node scripts/probe-v2-live-calibration.mjs /absolute/path/to/opencode --run
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const binary = process.argv[2]; assert.ok(binary && path.isAbsolute(binary));
const run = process.argv.includes('--run');
const root = await mkdtemp(path.join(os.tmpdir(), 'router-live-calibration-'));
const api = (args, timeout = 30000) => { try { return JSON.parse(execFileSync(binary, ['api', ...args], { cwd: root, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] })); } catch { throw new Error('OpenCode probe request failed; raw account response withheld'); } };
const url = sub => pathToFileURL(path.resolve('dist', sub)).href;
try {
  const info = api(['server.info']); assert.equal(info.version, '2.2.0');
  const fixture = path.join(root, 'fixture'); await mkdir(fixture);
  await writeFile(path.join(fixture, 'package.json'), JSON.stringify({ name: 'router-live-calibration', type: 'module' }));
  await writeFile(path.join(root, 'opencode.json'), JSON.stringify({ plugins: ['./fixture'] }));
  const contract = { id: 'router-live-calibration', methods: { calibrate: { input: { type: 'object', properties: { run: { type: 'boolean' } }, required: ['run'], additionalProperties: false }, output: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } } }, events: {} };
  await writeFile(path.join(fixture, 'server.js'), `
    import { CatalogStore } from ${JSON.stringify(url('catalog/store.js'))};
    import { ControlStore } from ${JSON.stringify(url('controls/index.js'))};
    import { EvidenceStore } from ${JSON.stringify(url('evidence/store.js'))};
    import { EvidencePipeline } from ${JSON.stringify(url('evidence/pipeline.js'))};
    import { PublicEvidenceResolver } from ${JSON.stringify(url('evidence/resolver.js'))};
    export default { id:'router-live-calibration', async setup(ctx) { const registration=await ctx.rpc.register(${JSON.stringify(contract)},{calibrate:async input=>{
      const connection=await ctx.integration.connection.active('openai'); const connected=connection!==undefined&&connection.status===undefined;
      const all=await ctx.model.list(); const eligible=all.data.filter(m=>m.providerID==='openai'&&m.enabled&&m.status!=='deprecated'&&m.capabilities?.input?.includes('text')&&m.capabilities?.output?.includes('text'));
      if(!input.run||!connected||!eligible.length)return {text:JSON.stringify({connected,eligible:eligible.length,dispatched:0})};
      let stage=0,clock=100,dispatched=0,errorKind=null,errorReason=null; const target={providerID:'openai',id:'zz-router-live-target',modelID:'zz-router-live-target',enabled:true,status:'active',capabilities:{input:['text'],output:['text']},variants:[]};
      const catalog=new CatalogStore({providers:()=>ctx.provider.list(),models:async()=>({data:stage?[...eligible,target]:eligible}),connected:async()=>connected});
      const controls=new ControlStore(async()=>({status:'ready',config:{mode:'auto',profile:'balanced'}}));
      const resolver=new PublicEvidenceResolver({now:()=>clock,cacheMs:1,fetchIndex:async()=>'- [Baseline](/api/docs/models/router-public-baseline.md): Synthetic baseline.\\n'+(stage?'- [Target](/api/docs/models/zz-router-live-target.md): Synthetic model with no comparative benchmark evidence.\\n':'')});
      const store=new EvidenceStore(${JSON.stringify(path.join(root, 'evidence.sqlite'))});
      const pipeline=new EvidencePipeline({catalog,controls,resolver,store,now:()=>clock,limit:1,notify:()=>{},generate:(classifier,prompt)=>{dispatched++;return ctx.experimental.generate.text({model:{providerID:'openai',id:classifier.modelID},prompt}).then(result=>result.text).catch(error=>{const tag=error?._tag??error?.name;errorKind=typeof tag==='string'&&/^[A-Za-z0-9._-]{1,100}$/.test(tag)?tag:'unrecognized';const reason=error?.reason;errorReason=['authentication','rate_limit','content_filter','invalid_request','overloaded','provider'].includes(reason)?reason:null;throw error})}});
      try{await catalog.refresh();const baseline=await pipeline.observe();stage=1;clock++;catalog.invalidate();await catalog.refresh();const result=await pipeline.observe();return{text:JSON.stringify({connected,eligible:eligible.length,baseline,result,dispatched,errorKind,errorReason,noticeStatuses:store.notices().map(n=>n.status),assessmentCount:Object.values(store.snapshot().work).filter(s=>s==='complete').length,tokenUsage:null,allowanceUsage:null})}}finally{pipeline.dispose();resolver.dispose();controls.dispose();catalog.dispose();store.close()}
    }});return()=>registration.dispose()}};`);
  const location = `location[directory]=${root}`;
  let plugins;
  for (let attempt=0; attempt<40; attempt++) {
    plugins=api(['plugin.list','--param',location]);
    if(plugins.data.some(p=>p.id==='router-live-calibration'&&p.state.status==='active'))break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(plugins.data.some(p => p.id === 'router-live-calibration' && p.state.status === 'active'), 'Probe plugin did not activate');
  const reply = api(['rpc.call', '--param', 'rpcID=router-live-calibration', '--param', 'method=calibrate', '--param', location, '--data', JSON.stringify({ input: { run } })], 90000);
  console.log(JSON.stringify(JSON.parse(reply.output.text), null, 2));
} finally { await rm(root, { recursive: true, force: true }); }
