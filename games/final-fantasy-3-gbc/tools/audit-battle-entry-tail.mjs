import fs from 'node:fs/promises';import {ROOT,input,check} from './source.mjs';
import {tailReference,tailAssets,bossFormations} from './battle-entry-tail-source.mjs';
const {data,profile}=await input(),assets=tailAssets(data),registry=bossFormations(data),profiles=[];
for(const back of [false,true])for(const graphic of [0,8,12,16]){
 const match=registry.find(r=>r.graphic===graphic);check(match,'Registered boss representative');
 const r=tailReference(data,{formation:match.formation,expectedBoss:graphic,back,normalized:[0,1,64,128]});
 const phaseCounts={},bytes={boss:0,party:0,map:0};for(const f of r.frames){const phase=f.state[67];phaseCounts[phase]=(phaseCounts[phase]||0)+1;if(f.work)bytes[['','boss','party','map'][f.work[0]]]+=f.work[4];}
 check(phaseCounts[1]===assets.bosses[graphic].chunks*8&&r.sounds.length===0,'Original boss entry cadence and sound requests');
 profiles.push({formation:match.formation,graphic,back,instructions:r.instructions,waits:r.frames.length,phaseCounts,bytes,soundRequests:r.sounds,boundaries:r.frames.map(f=>({state:f.state.toString('hex'),waitReturn:f.ret,work:f.work?[...f.work]:null,sourceWrites:f.ranges}))});
}
const report={sourceSha256:profile.sha256,bossFormations:registry,unboundGraphics:assets.bosses.filter(b=>!registry.some(r=>r.graphic===b.id)).map(b=>b.id),tables:assets.tables.map(({bytes,...t})=>t),bosses:assets.bosses,profiles,
 phases:{1:'BE97: four resident boss tiles, eight shifts per block; no entry SFX',2:'B489/AEE8/F8BC: canonical row positions; allow back-attack mirror in OAM',3:'AAEF: hide only this actor OAM before replacing its pattern',4:'AB0D/F970: cached-kind miss only; 64-byte blocks, then 32-byte remainder',5:'B3D9/BE9A: all-party motion plus original 9F11 status/target OAM refresh',6:'B58F: inner confused-motion pose and stone/clear map publication',7:'B5C3: outer status pose and stone/clear map publication, even after identical inner write',8:'B909: count types 0..3 and total, return to caller'},
 scope:'Original logical state, required resource updates and byte outputs. OAM composition, GBC encoding/VRAM mapping, source raster timing and live audio integration still belong to the adapter.'};
await fs.mkdir(ROOT+'/evidence/battle-entry-tail',{recursive:true});await fs.writeFile(ROOT+'/evidence/battle-entry-tail/resources.json',JSON.stringify(report,null,2));console.log(JSON.stringify({actualBossGraphics:registry.length,unboundGraphics:report.unboundGraphics,profiles:profiles.map(({boundaries,...p})=>p)}));
