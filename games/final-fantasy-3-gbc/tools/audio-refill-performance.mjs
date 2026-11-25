import fs from 'node:fs/promises';import {ROOT,check,hash} from './source.mjs';import {refillCosts} from './audio-refill-costs.mjs';
const base=process.argv[2];check(base,'Usage: node tools/audio-refill-performance.mjs <PR52-baseline>');const read=async p=>JSON.parse(await fs.readFile(p));
const before=await read(base+'/report.json'),old=await read(base+'/load.json'),b=await read(base+'/load-result.json'),profile=await read(base+'/profile.json'),after=await read(ROOT+'/build/battle-opening-video/report.json'),actual=await read(ROOT+'/evidence/battle-opening-video/load.json'),r=await read(ROOT+'/evidence/battle-opening-video/load-result.json');
check(before.romSha256==='8c34e84dfd538f351b704e5bbf9a420b055180ccbba77105d5ad0426bb39f130'&&old.romSha256===before.romSha256&&profile.romSha256===before.romSha256,'PR52 baseline');
check(after.romSha256===actual.romSha256&&r.romSha256===actual.romSha256&&r.coreSha256===b.coreSha256&&profile.coreSha256===b.coreSha256,'Candidate/core identity');
for(const k of ['sourceSha256','frames','battle','text','audio'])check(JSON.stringify(before[k])===JSON.stringify(after[k]),'Unchanged source contract '+k);
check(actual.pages.length===8&&old.pages.length===8&&profile.pages.length===8&&!profile.done,'Eight requests and bounded baseline profile');
const runs=actual.pages.map((p,i)=>{const o=old.pages[i];check(profile.pages[i].seconds===o.seconds&&p.op===o.op&&p.page===o.page&&p.seconds<o.seconds,'Same faster caller route');return {profile:i%4,cycle:i>>2,beforeMs:o.seconds*1000,afterMs:p.seconds*1000,reductionPercent:(1-p.seconds/o.seconds)*100};});
// The requested maximum-latency reduction is mandatory. Also retain the
// exploratory late-count goal as an independent result; do not mislabel a
// faster maximum as improvement of every individual frame/deadline.
const preparationGoals={maximumImproved:r.openingPipeline.maxLateMs<b.openingPipeline.maxLateMs,lateCountImproved:r.openingPipeline.late<b.openingPipeline.late};
check(preparationGoals.maximumImproved,'Worst preparation latency improves');
check(r.openingPipeline.sourceHoldsPreserved&&r.numberTimeline.timingGatePassed&&!r.maxLate&&!r.underruns,'Preserved holds/numbers/audio');
const burstsBefore=refillCosts(await fs.readFile(base+'/profile.json.lua.log','utf8'),b.callerCosts),burstsAfter=refillCosts(await fs.readFile(ROOT+'/evidence/battle-opening-video/load.json.lua.log','utf8'),r.callerCosts);
const probe=await read(ROOT+'/build/audio-output-probe/result.json'),object=await read(ROOT+'/build/audio-output-probe/object-identity.json');check(probe.status===1&&!probe.failure&&probe.testCase===8192&&probe.coreSha256===r.coreSha256&&hash(await fs.readFile(ROOT+'/build/audio-output-probe/audio-output-probe.gbc'))===probe.romSha256&&hash(await fs.readFile(ROOT+'/build/battle-opening-video/obj/'+object.path))===object.sha256,'Candidate object output equivalence');
const result={romSha256:r.romSha256,runs,preparationGoals,allExploratoryGoalsPassed:Object.values(preparationGoals).every(Boolean),pipelineBefore:b.openingPipeline,pipelineAfter:r.openingPipeline,audioBefore:b.audioProducerCosts,audioAfter:r.audioProducerCosts,burstsBefore,burstsAfter,probe,wholeSceneTimingGatePassed:false};
await fs.writeFile(ROOT+'/evidence/battle-opening-video/refill-performance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
