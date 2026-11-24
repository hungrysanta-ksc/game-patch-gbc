import test from 'node:test';
import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {sceneComposition,originalSceneSequence,scenePixels} from '../tools/battle-scene-pixels.mjs';
import {initializedBattle} from '../tools/battle-transition-source.mjs';
import {battleSceneAssets,stableSceneTiles} from '../tools/battle-scene-assets.mjs';
import {compositionWords,compositionRgb} from '../tools/npc-composition.mjs';
import {formationPixels,budgetFormationIds,placementBudgetAudit} from '../tools/battle-placement-budget.mjs';
import {originalFormation} from '../tools/battle-placement-source.mjs';
import {rearAnchor,rearLayout} from '../tools/battle-layout.mjs';

test('back-attack entry reads the original enemy raster page rather than wrapping onto the party',async()=>{
 const {data}=await input(),correct=[],wrong=[],trace=[];
 const {m}=initializedBattle(data,{formation:3,back:true,rows:[0,0,0,0],terrain:0,capture:(row,c,ppu)=>{
  const actual=c.m[7],options={back:true,layout:{shift:8}};
  correct.push(scenePixels(c,ppu,options).partyEnemyOverlapPixels);trace.push({scroll:row.enemyScroll,page:actual&1});
  c.m[7]=c.m[6];wrong.push(scenePixels(c,ppu,options).partyEnemyOverlapPixels);c.m[7]=actual;
 }});m.begin();m.call(0xb469);m.finish();
 assert.equal(wrong.filter(Boolean).length,2);assert.equal(Math.max(...wrong),88);assert.ok(correct.every(n=>n===0));
 assert.ok(trace.some(r=>r.scroll===48&&r.page===1));assert.deepEqual(trace.at(-1),{scroll:0,page:0});
});

test('same source scene composes entry, stone/toad restoration and item return in both directions',async()=>{
 const {data}=await input();for(const back of [false,true]){const s=sceneComposition(data,{back});assert.equal(s.failures.length,0);
  assert.equal(s.frames.length,56);assert.ok(s.summary.maxBgTiles>128);assert.ok(s.summary.maxObjects<=40&&s.summary.maxLine<=10);
  assert.ok(s.frames.every(f=>f.partyEnemyOverlapPixels===0),'Entry, status and item all have disjoint party/enemy silhouettes');
  if(back){assert.ok(s.frames.some(f=>f.phase==='entry'&&f.enemyScroll!==0&&f.enemyPage===1));assert.equal(s.frames.filter(f=>f.phase==='entry').at(-1).enemyPage,0);}
  const last=p=>s.frames.filter(f=>f.phase===p).at(-1);
  assert.deepEqual(last('entry').pixels,last('restored').pixels);assert.deepEqual(last('entry').pixels,last('normal').pixels);
  assert.notDeepEqual(last('stone').pixels,last('entry').pixels);assert.notDeepEqual(last('toad').pixels,last('normal').pixels);
  assert.deepEqual(last('item').pixels,last('next-selection').pixels);
 }
});
test('inactive-page dirty masks reconstruct every pattern/map/OBJ occupant and invalidate after window borrowing',async()=>{
 const {data}=await input(),s=battleSceneAssets(data);assert.equal(s.frames.length,226);
 for(const f of s.frames){assert.ok(f.stats.bgTiles<=256);assert.ok(f.atlas.background.length<=4096);
  for(let page=0;page<2;page++)for(const old of [undefined,...s.frames]){
   const at=(old?.atlas.visual??s.battle.uniqueVisuals)*48;
   for(let part=0;part<4;part++){
    const target=part<2?f.atlas.maps.subarray((part&&page?2:part)*608,(part&&page?3:part+1)*608):part===2?f.atlas.background:f.atlas.objects;
    const before=old?(part<2?old.atlas.maps.subarray((part&&page?2:part)*608,(part&&page?3:part+1)*608):part===2?old.atlas.background:old.atlas.objects):Buffer.alloc(0);
    const restored=Buffer.alloc(Math.max(target.length,before.length),165);before.copy(restored);
    const base=at+[0,5,10,42][part],blocks=[40,40,256,40][part];
    for(let block=0;block<blocks;block++)if(f.atlas.spans[base+(block>>3)]&(1<<(block&7))){const offset=block*16;assert.ok(offset+16<=target.length);assert.notDeepEqual(target.subarray(offset,offset+16),before.subarray(offset,offset+16));target.copy(restored,offset,offset,offset+16);}
    assert.deepEqual(restored.subarray(0,target.length),target);
   }
  }
  for(let i=0;i<399;i++){const pos=(i/21|0)*32+i%21;assert.equal(f.atlas.maps[pos],(f.ids[i]+128)&255);assert.equal(f.atlas.maps[1216+pos]^f.atlas.maps[608+pos],8);}
 }
});
test('stable tile IDs preserve exact source pixels and reuse surviving patterns without an animation union',async()=>{
 const {data}=await input(),frames=[false,true].flatMap(back=>sceneComposition(data,{back}).frames),stable=stableSceneTiles(frames.map(f=>f.composition));
 for(const [i,c]of stable.entries()){assert.deepEqual(compositionWords(c),frames[i].pixels);assert.ok(c.background.length<=4096);
  if(i){const old=stable[i-1];for(let p=0;p<c.background.length;p+=16){const key=c.background.subarray(p,p+16);for(let q=0;q<old.background.length;q+=16)if(key.equals(old.background.subarray(q,q+16))&&c.map.includes(p/16))assert.equal(p,q);}}
 }
 const assets=battleSceneAssets(data,{numbers:false});for(const [i,f]of assets.frames.entries()){const raw=compositionRgb(stable[i]),rgb=Buffer.alloc(160*144*3);for(let y=0;y<144;y++)raw.copy(rgb,y*480,y*504,y*504+480);assert.deepEqual(f.rgb,rgb);}
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
