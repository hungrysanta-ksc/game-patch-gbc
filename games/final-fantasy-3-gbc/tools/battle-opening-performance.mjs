import fs from 'node:fs/promises';
import {ROOT,check} from './source.mjs';
// Baseline evidence is private. Regenerate it at PR 48, then supply its folder.
const base=process.argv[2];check(base,'Usage: node tools/battle-opening-performance.mjs <baseline-folder>');
const read=async p=>JSON.parse(await fs.readFile(p));
const before=await read(base+'/report.json'),old=await read(base+'/load.json'),after=await read(ROOT+'/build/battle-opening-video/report.json'),actual=await read(ROOT+'/evidence/battle-opening-video/load.json'),result=await read(ROOT+'/evidence/battle-opening-video/load-result.json');
check(before.romSha256==='01f15b3f582ea06adaa4d8c60ac5a788aaa59f0968627cbfece008dba030606d'&&old.romSha256===before.romSha256,'PR 48 baseline identity');
check(after.romSha256===actual.romSha256&&result.romSha256===actual.romSha256&&old.coreSha256===actual.coreSha256,'Same pinned core and verified candidate');
for(const k of ['sourceSha256','frames','battle','text','audio'])check(JSON.stringify(before[k])===JSON.stringify(after[k]),'Unchanged source/presentation contract '+k);
check(old.pages.length===8&&actual.pages.length===8,'Same eight complete caller requests');
const runs=actual.pages.map((p,i)=>{const b=old.pages[i];check(p.op===b.op&&p.page===b.page,'Identical caller route');return {profile:i%4,cycle:i>>2,beforeMs:b.seconds*1000,afterMs:p.seconds*1000,reductionPercent:(1-p.seconds/b.seconds)*100};});
check(runs.every(p=>p.afterMs<p.beforeMs),'Every route must improve');
check(result.underruns===0&&result.maxLate===0&&result.numberTimeline.timingGatePassed,'Preserved sound/numeral gates');
check(result.phaseCosts?.[1]?.count>0&&result.phaseCosts?.[9]?.count>0,'Opening preparation/overlay timing observations');
const output={baselineRomSha256:before.romSha256,romSha256:after.romSha256,coreSha256:actual.coreSha256,unchangedSourceFrames:after.frames.length,runs,phaseCosts:result.phaseCosts,wholeSceneTimingGatePassed:false,scope:'Same bounded opening routes; less preparation overhead, not full original scene cadence'};
await fs.writeFile(ROOT+'/evidence/battle-opening-video/performance.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
