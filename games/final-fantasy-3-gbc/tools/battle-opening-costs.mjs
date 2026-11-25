import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {ROOT,check} from './source.mjs';
export const costNames=['audioService','transferWait','publicationWait','composition','sourceHold','numerals','caller'];
export function openingCosts(log,pages){
 const rows=[...new Set([...log.matchAll(/opening-cost:([\d,]+)/g)].map(m=>m[1]))].map(s=>s.split(',').map(Number));
 const seen=new Set(),runs=pages.map((p,i)=>({run:i+1,callerMs:p.seconds*1000,totalMs:0,costs:Object.fromEntries(costNames.map(k=>[k,0])),phases:{}}));
 for(const [run,key,cycles,rate]of rows){
  check(run>=1&&run<=runs.length&&cycles>=0&&rate===8388608&&key%10>=1&&key%10<=7,'Opening cost record domain');
  check(!seen.has(run+':'+key),'Conflicting opening cost record');seen.add(run+':'+key);
  const r=runs[run-1],ms=cycles*1000/rate,kind=costNames[key%10-1],phase=Math.floor(key/10);
  r.costs[kind]+=ms;r.totalMs+=ms;r.phases[phase]??={};r.phases[phase][kind]=ms;
 }
 for(const r of runs)check(r.totalMs>r.callerMs*0.98&&r.totalMs<=r.callerMs+1,'Complete bounded caller attribution');
 return runs;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const base=process.argv[2];check(base,'Usage: node tools/battle-opening-costs.mjs <PR50-baseline-folder>');
 const read=async p=>JSON.parse(await fs.readFile(p)),before=await read(base+'/report.json'),old=await read(base+'/load.json'),profile=await read(base+'/profile.json');
 const after=await read(ROOT+'/build/battle-opening-video/report.json'),actual=await read(ROOT+'/evidence/battle-opening-video/load.json'),result=await read(ROOT+'/evidence/battle-opening-video/load-result.json');
 check(before.romSha256==='3319eefd87bc12502befe73eb9f46e86f970b9a7023e259dfb29c56d305d3eea'&&old.romSha256===before.romSha256&&profile.romSha256===before.romSha256,'PR 50 baseline');
 check(after.romSha256===actual.romSha256&&result.romSha256===actual.romSha256&&actual.coreSha256===old.coreSha256&&profile.coreSha256===old.coreSha256,'Same verified artifact/core');
 for(const k of ['sourceSha256','frames','battle','text','audio'])check(JSON.stringify(before[k])===JSON.stringify(after[k]),'Unchanged presentation/source data '+k);
 check(old.pages.length===8&&actual.pages.length===8&&profile.pages.length===4&&!profile.done,'Eight acceptance runs and separate bounded baseline profile');
 const runs=actual.pages.map((p,i)=>{const b=old.pages[i];check(p.op===b.op&&p.page===b.page&&p.seconds<b.seconds,'Identical improved caller route');return {profile:i%4,cycle:i>>2,beforeMs:b.seconds*1000,afterMs:p.seconds*1000,reductionPercent:(1-p.seconds/b.seconds)*100};});
 for(let i=0;i<4;i++)check(profile.pages[i].seconds===old.pages[i].seconds,'Instrumentation does not change baseline emulated timing');
 const baseline=openingCosts(await fs.readFile(base+'/profile.json.lua.log','utf8'),profile.pages),candidate=openingCosts(await fs.readFile(ROOT+'/evidence/battle-opening-video/load.json.lua.log','utf8'),actual.pages);
 check(result.openingPipeline.sourceHoldsPreserved&&result.numberTimeline.timingGatePassed&&!result.maxLate&&!result.underruns,'Preserved original holds/numerals/audio');
 const output={baselineRomSha256:before.romSha256,romSha256:after.romSha256,runs,baseline,candidate,wholeSceneTimingGatePassed:false,scope:'Exclusive elapsed time, audio service includes nested IRQs; transfer wait excludes service. First four requests compared with identical source schedule; full acceptance uses eight requests and 21600 audio ticks.'};
 await fs.writeFile(ROOT+'/evidence/battle-opening-video/cost-performance.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
}
