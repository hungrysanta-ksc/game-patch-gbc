import test from 'node:test';
import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {battleSceneAssets} from '../tools/battle-scene-assets.mjs';
import {numberTimeline} from '../tools/battle-number-timeline.mjs';

test('all source numeral waits survive deduplication with pinned graphics and an exact caller clear',async()=>{
 const {data}=await input(),assets=battleSceneAssets(data),timeline=assets.battle.numberTimeline;
 assert.equal(timeline.runs.length,4);
 for(const r of timeline.runs){
  assert.deepEqual(r.entries.map(e=>e.sourceStart),Array.from({length:33},(_,i)=>i));
  assert.ok(new Set(r.entries.slice(0,32).map(e=>e.frame)).size<32,'fixture exercises repeated visible poses');
  assert.equal(r.oam.length,33*160);
  assert.equal(r.entries.at(-1).timerOffset,2180);
  assert.equal(r.back,assets.frames[r.first].back);
  assert.equal(assets.frames[r.clear].label,r.label+'-clear');
  assert.ok(r.oam.subarray(32*160,32*160+r.numberObjects*4).every(v=>v===0));
  assert.deepEqual(r.oam.subarray(32*160+r.numberObjects*4),r.oam.subarray(r.numberObjects*4,160));
 }
 const r=timeline.runs[0],f=assets.frames[r.first],saved=f.numberFrames;
 f.numberFrames=saved.slice(1);assert.throws(()=>numberTimeline(assets.frames),/Complete original numeral waits/);f.numberFrames=saved;
 const next=assets.frames[r.entries.find(e=>e.frame!==r.first).frame],palette=next.palette;
 next.palette=Buffer.from(palette);next.palette[0]^=1;assert.throws(()=>numberTimeline(assets.frames),/Invariant numeral palette/);next.palette=palette;
 const graphic=next.atlas.objects;next.atlas.objects=Buffer.from(graphic);next.atlas.objects[0]^=1;
 assert.throws(()=>numberTimeline(assets.frames),/Invariant numeral objects/);next.atlas.objects=graphic;
});
