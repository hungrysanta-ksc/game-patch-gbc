import test from 'node:test';import assert from 'node:assert/strict';
import {input,hash} from '../tools/source.mjs';import {offset} from '../tools/render-budget-source.mjs';import {battleCompositionAssets,originalBattleFrames} from '../tools/battle-composition-assets.mjs';
test('entire original non-reflect hit loop retains four waits per entry and final OAM clear',async()=>{
 const {data}=await input(),a=battleCompositionAssets(data,{timeline:true}),t=a.battle.timeline;
 assert.equal(t.waits,25);assert.deepEqual(t.entries.map(e=>e.sourceStart),[0,4,8,12,16,20,24]);assert.deepEqual(t.entries.map(e=>e.timerOffset),[0,273,546,818,1091,1364,1636]);
 assert.deepEqual(t.entries.map(e=>e.sourceFrame),[13,13,14,14,15,15,null]);assert.equal(a.jobs.length,80);
 const old=battleCompositionAssets(data);assert.equal(hash(Buffer.concat(a.frames.slice(0,6).map(f=>f.rgb))),hash(Buffer.concat(old.frames.map(f=>f.rgb))));
 for(const f of a.frames)for(const previous of [undefined,...a.frames]){const b=previous?Buffer.from(previous.atlas.maps):Buffer.alloc(1216,165),at=(previous?.atlas.visual??a.battle.uniqueVisuals)*8;for(let bank=0;bank<2;bank++){const o=f.atlas.spans.readUInt16LE(at+bank*4),n=f.atlas.spans.readUInt16LE(at+bank*4+2);f.atlas.maps.copy(b,bank*608+o,bank*608+o,bank*608+o+n);}assert.deepEqual(b,f.atlas.maps);}
 const bad=Buffer.from(data);bad[offset(0x33,0xb7aa)]=3;assert.throws(()=>originalBattleFrames(bad,{includeClear:true}),/Original hit hold/);
});
import {checkBattleTimeline} from '../tools/battle-timeline-verifier.mjs';
test('timeline evidence rejects skipped entries, late preparation and a missed eligible VBlank across timer wrap',()=>{
 const entries=[0,273,546,818,1091,1364,1636].map((timerOffset,frame)=>({frame,timerOffset,sourceStart:frame*4}));
 const frames=[0,0,1,1,2,2,3].map(visual=>({atlas:{visual}})),timing={timerHz:4096,sourceRateNumerator:600988,sourceRateDenominator:10000},report={frames,battle:{timeline:{entries,timing}}};
 const lines=[],pictures=[];for(let run=1;run<=2;run++)for(const e of entries){const origin=65500,frame=Math.ceil(e.timerOffset/(70224/1024)),master=run*10000000+frame*70224,clock=(origin+Math.floor(frame*70224/1024))&65535,due=(origin+e.timerOffset)&65535,prepared=(due-30)&65535,lcdc=131+((Math.floor(e.frame/2)&1)*8);
  lines.push(`battle-check:${run},${e.frame},${due},${clock},1,${master},4194304`);lines.push(`battle-present:${run},${e.frame},${origin},${due},${clock},${prepared},0,${master+100},4194304,${lcdc},145`);pictures.push({kind:'entry',run,entry:e.frame});
 }
 lines.push('battle-oam:20,0');const log=lines.join('\n'),actual={pictures,pages:[{op:5},{op:5}]};assert.equal(checkBattleTimeline(log,report,actual).timingGatePassed,true);
 assert.throws(()=>checkBattleTimeline(lines.filter(l=>!l.startsWith('battle-present:1,1,')).join('\n'),report,actual),/Complete autonomous/);
 const one=lines.find(l=>l.startsWith('battle-present:1,2,')).split(',');one[5]=(Number(one[3])+1)&65535;assert.throws(()=>checkBattleTimeline(log.replace(lines.find(l=>l.startsWith('battle-present:1,2,')),one.join(',')),report,actual),/Prepared before/);
 assert.throws(()=>checkBattleTimeline(log+'\nbattle-check:1,2,510,511,1,10000001,4194304',report,actual),/First eligible/);
});
