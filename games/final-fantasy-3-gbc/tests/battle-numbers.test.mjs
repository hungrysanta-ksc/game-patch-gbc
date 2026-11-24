import test from 'node:test';
import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {initializedBattle} from '../tools/battle-transition-source.mjs';
import {originalNumberRun} from '../tools/battle-number-source.mjs';
import {originalSceneSequence,sceneComposition} from '../tools/battle-scene-pixels.mjs';
import {originalFormation} from '../tools/battle-placement-source.mjs';

test('original numeral conversion distinguishes zero, leading zeros, MISS, recovery and absent targets',async()=>{
 const {data}=await input();
 const {m}=initializedBattle(data,{formation:3,back:false,rows:[0,0,0,0],terrain:0});m.call(0xb469);
 const r=originalNumberRun(data,m,{enemy:true,values:[0,9,10,999,9999,0x4000,0x8038,65535]});
 assert.equal(r.frames.length,32);
 assert.deepEqual(r.frames[0].groups.map(g=>g.tiles),[[0,0,0,86],[0,0,0,95],[0,0,87,86],[0,95,95,95],[95,95,95,95],[0,100,101,0],[0,0,107,108],[0,0,0,0]]);
 assert.equal(r.frames[0].allocated,32);assert.equal(r.frames.at(-1).frame,31);
 const absent=originalNumberRun(data,m,{enemy:false,values:Array(4).fill(65535)});assert.equal(absent.frames.length,0);
});

test('source enemy anchors and sine offsets survive both directions without mirroring digit order',async()=>{
 const {data}=await input(),formation=originalFormation(data,3),runs=[];
 for(const back of [false,true]){
  const {m}=initializedBattle(data,{formation:3,back,rows:[0,0,0,0],terrain:0});m.call(0xb469);
  for(const s of formation.slots){assert.deepEqual([...m.c.m.subarray(0x7dd7+s.slot*2,0x7dd9+s.slot*2)],s.center);assert.equal(m.c.m[0x7e07+s.slot],s.frontTop[1]+s.rect[3]);}
  const r=originalNumberRun(data,m,{enemy:true,values:Array(8).fill(1234)});runs.push(r);
  for(const f of r.frames)for(const g of f.groups){const cx=formation.slots[g.target].center[0];assert.equal(g.sourceBase[0],back?238-cx:cx-16);assert.deepEqual(g.tiles,[87,88,89,90]);}
 }
 assert.deepEqual(runs[0].frames.map(f=>f.groups.map(g=>g.sourceBase[1])),runs[1].frames.map(f=>f.groups.map(g=>g.sourceBase[1])));
 assert.ok(new Set(runs[0].frames.map(f=>f.groups[0].sourceBase[1])).size>10);
});

test('same scene displays and clears single-enemy damage plus party zero/MISS/recovery without changing party pixels',async()=>{
 const {data}=await input();for(const back of [false,true]){
  const s=sceneComposition(data,{back,numbers:true});assert.equal(s.failures.length,0);assert.equal(s.frames.length,113);
  assert.deepEqual(s.numberRuns.map(r=>r.frames.length),[32,32]);
  const last=p=>s.frames.filter(f=>f.phase===p).at(-1);
  for(const p of ['enemy-numbers-clear','party-numbers-clear']){assert.deepEqual(last(p).pixels,last('next-selection').pixels);assert.equal(last(p).sourceOamSha256,last('next-selection').sourceOamSha256);}
  assert.notDeepEqual(last('enemy-numbers').pixels,last('enemy-numbers-clear').pixels);
  assert.notDeepEqual(last('party-numbers').pixels,last('party-numbers-clear').pixels);
  const apex=s.frames.filter(f=>f.phase==='party-numbers'&&f.numberFrame>=5&&f.numberFrame<=9);
  assert.ok(apex.length>0&&apex.every(f=>f.numberCoverage.sourcePixels>0));
  assert.ok(s.frames.every(f=>f.numberCoverage.sourcePixels===f.numberCoverage.viewportPixels));
  assert.ok(s.frames.every(f=>f.composition.stats.objects<=40&&f.composition.stats.peak<=10&&f.composition.stats.bgPalettes<=7));
 }
});

test('eight simultaneous four-digit values remain an explicit unresolved whole-scene capacity case',async()=>{
 const {data}=await input();for(const back of [false,true]){
  const options={back,numbers:true,enemyValues:Array(8).fill(1234)},raw=originalSceneSequence(data,options),s=sceneComposition(data,options);
  assert.equal(raw.numberRuns[0].frames.length,32);assert.ok(raw.numberRuns[0].frames.every(f=>f.allocated===32&&f.groups.length===8));
  // This is a limitation regression, never a fit pass or filtered ROM input.
  assert.ok(s.failures.length>0);assert.equal(s.frames.length+s.failures.length,s.summary.observations);
  assert.ok(s.failures.every(f=>f.phase==='enemy-numbers'&&/capacity/.test(f.reason)));
 }
});
