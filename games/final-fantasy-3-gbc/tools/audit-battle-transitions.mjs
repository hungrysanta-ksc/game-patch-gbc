import fs from 'node:fs/promises';
import {ROOT,input,hash} from './source.mjs';
import {entryTransition,statusPriorityAudit,statusTransition,itemEffectRoutes,itemPresentation} from './battle-transition-source.mjs';
const {data,profile}=await input();
const entries=[entryTransition(data),entryTransition(data,{back:true}),entryTransition(data,{formation:79})];
const priority=statusPriorityAudit(data),status=[];
// Cover each job's CHR source, then each coordinate/flip/row consumer. This
// is a factored diagnostic matrix, not the full legal combat state space.
for(let job=0;job<22;job++)status.push(statusTransition(data,{job}));
for(let slot=0;slot<4;slot++)for(const back of [false,true])for(const row of [0,1])
 if(slot||back||row)status.push(statusTransition(data,{slot,job:0,back,row}));
const items=itemEffectRoutes(data),presentations=[];
for(let item=0xa6;item<=0xaf;item++)presentations.push(itemPresentation(data,items.routes.find(r=>r.item===item&&!r.miniForbidden)));
const potion=items.routes.find(r=>r.item===0xa6&&!r.miniForbidden);
for(let actor=0;actor<4;actor++)for(let target=0;target<4;target++)for(const back of [false,true])
 if(actor||target!==2||back)presentations.push(itemPresentation(data,potion,{actor,target,back}));
const summary={entries:entries.map(e=>({formation:e.formation,back:e.back,...e.summary})),statusPairs:priority.pairs,statusProfiles:status.length,statusTransitions:status.reduce((n,r)=>n+r.states.length,0),items:items.summary,itemPresentations:presentations.length,maxItemWaits:Math.max(...presentations.map(p=>p.summary.nmiWaits)),integratedGbcProof:false};
const report={sourceSha256:profile.sha256,summary,entries,priority,status,items,presentations,scope:'Host execution of original presentation consumers; waits/raster/music request intercepted. Not normal combat, rendered NES frames, GBC budget, or audio continuity evidence.'};
const out=ROOT+'/evidence/battle-transitions';await fs.mkdir(out,{recursive:true});const bytes=JSON.stringify(report,null,2)+'\n';await fs.writeFile(out+'/audit.json',bytes);
console.log(JSON.stringify({...summary,sha256:hash(Buffer.from(bytes)),scope:report.scope},null,2));
