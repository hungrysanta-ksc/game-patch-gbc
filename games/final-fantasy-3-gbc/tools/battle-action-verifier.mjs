import fs from 'node:fs/promises';
import {check,hash} from './source.mjs';
import {nativeReference} from './native-reference.mjs';
import {screenshotRgb} from './map-pixels.mjs';
import {checkMemoryAudit} from './memory-audit.mjs';
import {checkNumberTimeline} from './battle-number-timeline-verifier.mjs';
export async function verifyAction({data,report,actual,cfg,dir,out,output,romSha256,coreSha256}){
 const table=await fs.readFile(dir+'/conversion.bin');check(hash(table)===report.audio.conversionSha256,'Conversion identity');
 const opening=report.battle.opening;const audioPlan=[...report.audio.plan,...(opening?actual.externalAudio.map(e=>[e.tick,e.op,e.arg]):[])].sort((a,b)=>a[0]-b[0]);
 const ref=nativeReference(data,table,{plan:audioPlan,ticks:report.audio.ticks});let end,first,last,clock=0,previous;
 for(const f of actual.frames){
  check(!f.error&&!f.cacheError&&!f.platformError&&!f.memoryFault&&!f.transferFault&&!f.maxLate&&!f.underruns,'Runtime/audio fault '+f.frame);
  check(f.mapIntact&&f.fieldIntact&&f.guard==='a7'.repeat(48)&&(f.svbk&7)===1&&(f.key1&128)&&(f.lcdc&128),'Memory/video contract');
  const b=Buffer.from(f.consumed,'hex'),events=b.readUInt32LE(4);if(events){end=ref.advanceToEvent(events);check(end.ticks===b.readUInt32LE(0)&&end.sourceHash===b.readUInt16LE(8)&&end.gbHash===b.readUInt16LE(10)&&end.done===f.done,'Original consumed audio '+events);}else check(b.equals(Buffer.alloc(12))&&!f.done,'Initial audio');
  if(previous!==undefined)clock+=(f.timer-previous+65536)&65535;previous=f.timer;if(events&&!f.done){first??={clock,master:f.master,rate:f.rate};last={clock,master:f.master,rate:f.rate};}
 }
 check(end?.done&&end.ticks===report.audio.ticks,'Complete native audio schedule');
 const drift=(last.clock-first.clock)/4096-(last.master-first.master)/last.rate;check(Math.abs(drift)<0.003,'Audio timer drift');
 const profiles=report.battle.action.profiles,stages=actual.pictures.filter(p=>p.kind==='stage'),shots=(await fs.readdir(cfg.home+'/Screenshots')).filter(n=>n.endsWith('.png')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 check(actual.pages.length>=8&&!actual.pages[7].audioDone,'Two complete caller cycles under audio');
 const expectedStages=profiles.flatMap((p,profile)=>p.entries.map((e,entry)=>({profile,entry,e})));
 check(stages.length===expectedStages.length*2,'Every action stage in two complete cycles');
 const log=await fs.readFile(output+'.lua.log','utf8');
 const publications=report.openingPipeline?[...new Set([...log.matchAll(/action-published:([\d,]+)/g)].map(m=>m[1]))].map(s=>s.split(',').map(Number)).sort((a,b)=>a[0]-b[0]):null;
 if(publications)check(publications.length===stages.length,'Every source hold has an exact publication observation');
 let maxObjects=0,maxLine=0,waits=0,returned=0;
 for(const [i,p]of stages.entries()){
  const s=p.data,{profile,entry,e}=expectedStages[i%expectedStages.length];
  check(s.profile===profile&&s.entry===entry&&s.live===e.live&&s.geometry===e.frame&&s.serial===i+1,'Original lowered flow order');
  if(publications){const p=publications[i];check(p[0]===s.serial&&p[1]===profile&&p[2]===entry&&p[4]<=s.master,'Exact publication paired with later screenshot observation');}
  check(p.capturePpuFrame===s.sourcePpuFrame+1,'Action screenshot frame pairing');
  const f=report.frames[e.frame],expected=Buffer.from(f.atlas.oam.data),oam=Buffer.from(s.oam,'hex');
  for(let n=0;n<f.stats.objects;n++)expected[n*4+2]+=((s.lcdc>>3)&1)*64;
  check(oam.equals(expected),'Complete action OAM '+profile+'/'+entry);
  const lines=Array(144).fill(0);let count=0;for(let n=0;n<40;n++){const y=oam[n*4]-16;if(y>=144||y+8<=0)continue;count++;for(let yy=Math.max(0,y);yy<Math.min(144,y+8);yy++)lines[yy]++;}
  check(count===f.stats.objects&&count<=40&&Math.max(...lines)<=10,'Action hardware OAM capacity');maxObjects=Math.max(maxObjects,count);maxLine=Math.max(maxLine,...lines);
  const next=stages[i+1]?.data;if(next&&next.profile===profile){
   const elapsed=publications?((publications[i+1][3]-publications[i][3])&65535)/4096:((next.timer-s.timer)&65535)/4096,min=e.hold*report.battle.numberTimeline.timing.sourceRateDenominator/report.battle.numberTimeline.timing.sourceRateNumerator;
   check(elapsed>=min-2/4096,'Original hold shortened '+profile+'/'+entry);if(e.command===10)waits++;
  }
  if(entry===profiles[profile].entries.length-1){if(!opening)check(e.phase==='next-selection'&&e.live===0&&e.sourceGate!==0,'Status gate restored at next selection');returned++;}
 }
 for(const [i,p]of actual.pages.entries())check(p.op===7&&p.page===profiles[i%4].entries.at(-1).frame&&!p.audioDone&&p.seconds<(opening?7200:1200)*report.audio.timing.sourceRateDenominator/report.audio.timing.sourceRateNumerator,'Complete autonomous caller return before audio end');
 check(returned===8&&(opening||waits>=8),'Wait/return coverage');
 if(opening){const expected=opening.flatMap((p,profile)=>p.requests.map((r,request)=>({profile,request,state:r.state})));check(actual.openingStates.length===expected.length*2,'Every opening boundary twice');for(const [i,s]of actual.openingStates.entries()){const e=expected[i%expected.length];check(s.profile===e.profile&&s.request===e.request&&s.state===e.state,'Live opening caller state '+i);}const sounds=opening.flatMap(p=>p.sounds.map(s=>[s.op,s.arg]));check(JSON.stringify(actual.externalAudio.map(s=>[s.op,s.arg]))===JSON.stringify([...sounds,...sounds]),'Original presentation sound requests exactly once');}

 check(shots.length===actual.pictures.length,'All screenshot ordinals accounted');
 for(const p of actual.pictures){let path,expectedHash;
  if(p.kind==='stage'){const s=p.data,e=profiles[s.profile].entries[s.entry];path='action'+s.profile+'-'+s.entry;expectedHash=e.rgbSha256;}
  else if(p.kind==='entry'){const run=(p.run-1)%4,e=report.battle.numberTimeline.runs[run].entries[p.entry];path='number'+run+'-'+p.entry;expectedHash=e.rgbSha256;}
  else{const page=actual.pages.find(a=>a.screenshotOrdinal===p.ordinal),profile=page.ordinal%4,e=profiles[profile].entries.at(-1);path='action'+profile+'-'+(profiles[profile].entries.length-1);expectedHash=e.rgbSha256;}
  const expected=await fs.readFile(dir+'/'+path+'.rgb');check(hash(expected)===expectedHash,'Expected source pixels identity');
  check(screenshotRgb(await fs.readFile(cfg.home+'/Screenshots/'+shots[p.ordinal])).equals(expected),'Actual HP/window/status/numeral pixels '+path+' ordinal '+p.ordinal);
 }
 const a=[...log.matchAll(/audit:(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/g)].at(-1);check(a,'Bus audit');
 const [writes,bad,off,apuHash,apuWrites,maxLy,dma,badDma]=a.slice(1).map(Number);let expectedHash=end.gbHash;for(const reg of [2,7,12,17])expectedHash=(((expectedHash<<1)|(expectedHash>>>15))^(reg<<8))&65535;
 check(!bad&&!off&&!badDma&&apuHash===expectedHash&&apuWrites===end.gbWrites+4&&dma>100,'Actual audio/VRAM bus output');
 const memory=checkMemoryAudit(log),resident=[...log.matchAll(/scene-residency:(\d+),(\d+),(\d+),(\d+)/g)].at(-1);check(resident,'Residency audit');
 const [cacheWrites,activeWrites,objPaletteWrites,badObjPalette]=resident.slice(1).map(Number);check(!activeWrites&&!badObjPalette&&actual.stackUntouchedBytes>=128,'Bank residency/palette/stack');
 const critical=[...log.matchAll(/scene-critical:(\d+),(\d+),(\d+)/g)].at(-1);check(critical&&Number(critical[1])>100&&Number(critical[2])/Number(critical[3])<1/4096,'Bounded DMA critical section');
 const pub=[...log.matchAll(/scene-publication:(\d+),(\d+)/g)].at(-1);check(pub&&Number(pub[1])>100&&!Number(pub[2]),'Atomic scene publication');
 const ownership=[...log.matchAll(/scene-oam-ownership:(\d+),(\d+)/g)].at(-1);check(ownership&&Number(ownership[1])>100&&!Number(ownership[2]),'Never rebuild the active OAM shadow');
 const numberTimeline=checkNumberTimeline(log,report,actual),times=actual.pages.map(p=>p.seconds*1000).sort((a,b)=>a-b);
 const phaseCosts={};for(const m of log.matchAll(/scene-cost:(\d+),(\d+),(\d+),(\d+),(\d+)/g)){const [phase,cycles,count,max,rate]=m.slice(1).map(Number);phaseCosts[phase]={count,totalMs:cycles*1000/rate,meanMs:cycles*1000/rate/count,maxMs:max*1000/rate};}
 const result={romSha256,coreSha256,home:cfg.home,profiles:profiles.length,requests:actual.pages.length,actionStages:stages.length,returnedSelections:returned,screenshots:shots.length,pixels:shots.length*160*144,maxObjects,maxLine,numberTimeline,openingBoundaries:actual.openingStates?.length,externalSoundRequests:actual.externalAudio?.length,sourceTicks:end.ticks,sourceEvents:end.events,maxLate:0,underruns:0,apuWrites,apuHash,timerDriftSeconds:drift,videoWrites:writes,invalidVideoWrites:bad,invalidDma:badDma,lcdOffWrites:off,cacheWrites,activeWrites,objPaletteWrites,badObjPalette,maxLy,publications:Number(pub[1]),invalidPublications:Number(pub[2]),oamStagingWrites:Number(ownership[1]),activeOamStagingWrites:Number(ownership[2]),dmaCriticalMaxSeconds:Number(critical[2])/Number(critical[3]),memory:{...memory,stackUntouchedBytes:actual.stackUntouchedBytes},callerDuration:{medianMs:times[times.length>>1],maxMs:times.at(-1)},wholeSceneTimingGatePassed:false,normalGameplay:false,scope:report.battle.action.scope};
 if(opening)result.phaseCosts=phaseCosts;
 if(report.openingPipeline){
  const p=actual.openingPipeline,expected=profiles.reduce((sum,profile)=>sum+profile.entries.slice(0,-1).filter((e,i)=>e.run===255&&profile.entries[i+1].run===255).length,0)*2;
  check(p&&p.prefetches===expected&&p.overlapTicks>0&&p.late<=p.prefetches,'Every eligible lookahead and measured overlap');
  check(p.overlapTicks<report.audio.ticks*4096/60,'Bounded overlap clock');
  result.openingPipeline={...p,overlapMs:p.overlapTicks*1000/4096,maxLateMs:p.maxLateTicks*1000/4096,readyBeforeDeadline:p.prefetches-p.late,sourceHoldsPreserved:true,scope:'Prepare immutable next ordinary picture before source hold ends; source ack/sound/publication remain ordered. Numeral ownership is unchanged.'};
 }
 await fs.writeFile(out+'/load-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));return result;
}
