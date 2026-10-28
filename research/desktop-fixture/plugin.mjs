import { appendFile } from 'node:fs/promises';
const log='/tmp/router-desktop-research/events.jsonl';
export default { id:'router.desktop.research', async setup(ctx) {
 const reg=await ctx.session.hook('prompt',async event=>{
  const marker=event.prompt.text;
  if (!['desktop-default','desktop-explicit-a','desktop-route','desktop-followup'].includes(marker)) return;
  const selection=event.metadata?.model;
  const info={type:'prompt',marker,metadataKeys:Object.keys(event.metadata??{}).sort(),selection:selection&&selection.providerID==='local'?{providerID:selection.providerID,modelID:selection.modelID,variant:selection.variant??null}:null};
  await appendFile(log,JSON.stringify(info)+'\n');
  if(marker==='desktop-route') { await ctx.session.switchModel({sessionID:event.sessionID,model:{providerID:'local',id:'probe-b'}}); await appendFile(log,JSON.stringify({type:'session-switch',to:'probe-b'})+'\n'); }
 });
 return ()=>reg.dispose();
}};
