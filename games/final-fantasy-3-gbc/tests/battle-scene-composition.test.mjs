import test from 'node:test';
import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {sceneComposition,originalSceneSequence} from '../tools/battle-scene-pixels.mjs';
import {battleSceneAssets} from '../tools/battle-scene-assets.mjs';
import {formationPixels,budgetFormationIds,placementBudgetAudit} from '../tools/battle-placement-budget.mjs';
import {originalFormation} from '../tools/battle-placement-source.mjs';
import {rearAnchor,rearLayout} from '../tools/battle-layout.mjs';

test('same source scene composes entry, stone/toad restoration and item return in both directions',async()=>{
 const {data}=await input();for(const back of [false,true]){const s=sceneComposition(data,{back});assert.equal(s.failures.length,0);
  assert.equal(s.frames.length,back?53:56);assert.ok(s.summary.maxBgTiles>128);assert.ok(s.summary.maxObjects<=40&&s.summary.maxLine<=10);
  const last=p=>s.frames.filter(f=>f.phase===p).at(-1);
  assert.deepEqual(last('entry').pixels,last('restored').pixels);assert.deepEqual(last('entry').pixels,last('normal').pixels);
  assert.notDeepEqual(last('stone').pixels,last('entry').pixels);assert.notDeepEqual(last('toad').pixels,last('normal').pixels);
  assert.deepEqual(last('item').pixels,last('next-selection').pixels);
 }
});
test('inactive-page spans reconstruct every pattern/map occupant and invalidate after the window borrows VRAM',async()=>{
 const {data}=await input(),s=battleSceneAssets(data);assert.equal(s.frames.length,109);
 for(const f of s.frames){assert.ok(f.stats.bgTiles<=256);assert.ok(f.atlas.background.length<=4096);
  for(let page=0;page<2;page++)for(const old of [undefined,...s.frames]){
   const at=(old?.atlas.visual??s.battle.uniqueVisuals)*12;
   for(let part=0;part<3;part++){
    const target=part<2?f.atlas.maps.subarray((part&&page?2:part)*608,(part&&page?3:part+1)*608):f.atlas.background;
    const before=old?(part<2?old.atlas.maps.subarray((part&&page?2:part)*608,(part&&page?3:part+1)*608):old.atlas.background):Buffer.alloc(0);
    const restored=Buffer.alloc(Math.max(target.length,before.length),165);before.copy(restored);
    const offset=f.atlas.spans.readUInt16LE(at+part*4),size=f.atlas.spans.readUInt16LE(at+part*4+2);assert.equal((offset|size)&15,0);assert.ok(offset+size<=target.length);target.copy(restored,offset,offset,offset+size);
    assert.deepEqual(restored.subarray(0,target.length),target);
   }
  }
  for(let i=0;i<399;i++){const pos=(i/21|0)*32+i%21;assert.equal(f.atlas.maps[pos],(f.ids[i]+128)&255);assert.equal(f.atlas.maps[1216+pos]^f.atlas.maps[608+pos],8);}
 }
});
test('rear retreat preserves enemy pixels and relative anchors, reduces party overlap, and moves hit centers with the formation',async()=>{
 const {data}=await input();for(const id of budgetFormationIds){const f=originalFormation(data,id),a=formationPixels(data,f),b=formationPixels(data,f,{retreat:8});
  assert.equal(a.pixels.filter(Boolean).length,b.pixels.filter(Boolean).length);assert.ok(b.layout.shift<=b.layout.left&&b.layout.shift<=8);
  for(let i=0;i<a.images.length;i++)assert.deepEqual(b.images[i].candidateAnchor,rearAnchor(a.images[i].candidateAnchor,b.layout));
  for(let y=0;y<152;y++)for(let x=b.layout.shift;x<160;x++)assert.equal(b.pixels[y*168+x-b.layout.shift],a.pixels[y*168+x]);
 }
 for(const back of [false,true]){const a=originalSceneSequence(data,{back,retreat:0}),b=originalSceneSequence(data,{back});
  assert.equal(b.source.layout.shift,8);assert.ok(Math.max(...b.observations.map(f=>f.partyEnemyOverlapPixels))<Math.max(...a.observations.map(f=>f.partyEnemyOverlapPixels)));
  assert.ok(b.observations.filter(f=>f.phase!=='entry').every(f=>f.partyEnemyOverlapPixels===0));
  assert.deepEqual(rearAnchor([80,50],b.source.layout,back),[back?88:72,50]);
 }
 const r=placementBudgetAudit(data,{retreat:8});assert.equal(r.summary.states,197);assert.equal(r.rows.find(row=>row.formation===47).summary.failedStates,36);assert.ok(r.rows.every(row=>row.states.length>0));
 assert.throws(()=>rearLayout(new Uint16Array(168*152),{requested:1}),/Rear placement/);
 assert.throws(()=>rearLayout(new Uint16Array(168*152),{requested:17}),/Rear placement/);
});
