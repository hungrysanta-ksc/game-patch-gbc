import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {statusVideoOracle} from '../tools/battle-status-video.mjs';
import {stoneAssets,stoneChange,stoneCompose,stoneOam,jobAssets} from '../tools/battle-stone.mjs';
import {residentEnemy} from '../tools/battle-resident-bg.mjs';import {terrainAssets,terrainFrames} from '../tools/battle-terrain.mjs';
import {tailReference} from '../tools/battle-entry-tail-source.mjs';
test('confused stone accepts its original column and rejects uncleared relocation',()=>{
 for(const back of [false,true]){
  const state=[],w=Buffer.from([3,3,0,0,8,back?168:182,32,0]);
  stoneChange(state,0,w,back);assert.equal(state[0].x,back?6:12);
  w[1]=0;
  stoneChange(state,0,w,back);assert.equal(state[0].kind,0);
  const occupied=structuredClone(state);w[5]+=back?-4:4;
  assert.throws(()=>stoneChange(state,0,w,back),/Stone relocation/);assert.deepEqual(state,occupied);
 }
});
test('HIDE publishes the prepared canonical shadow while LOAD retains physical OAM',async()=>{
 const {data}=await input(),r=tailReference(data,{back:true,partyStatus:[128,64,32,8],cache:[0,0,0,0]}),canonical=r.frames[0],hide=r.frames[1],load=r.frames[2];
 assert.deepEqual(r.frames.slice(0,3).map(f=>f.state[67]),[2,3,4]);
 assert.notDeepEqual(canonical.published.oam.subarray(184),canonical.oam.subarray(184));
 assert.ok(hide.published.oam.subarray(160,184).every(v=>v===240));
 assert.deepEqual(hide.published.oam.subarray(184),canonical.oam.subarray(184));
 assert.deepEqual(load.published.oam,hide.published.oam);
});
test('stone forms retain source glyphs and mixed terrain colors; source clearing restores the map',async()=>{
 const {data}=await input();for(const back of [false,true]){
  const p=statusVideoOracle(data,{back,stone:true,partyStatus:[64,96,72,64],clearAfter:true}),a=stoneAssets(data,p),bg=residentEnemy(p),g=terrainAssets(p),frame=terrainFrames(data,p,g).at(-1),state=[];
  let maxCells=0,maxResidual=0,clearCount=0;
  const base=(x,y)=>y<2?{tile:frame.subarray(g.map[y*20+x]*16,g.map[y*20+x]*16+16),attr:g.attributes[y*20+x]}:y<13?{tile:bg.patterns.subarray(bg.maps[(y-2)*56+x]*16,bg.maps[(y-2)*56+x]*16+16),attr:bg.maps[616+(y-2)*56+x]}:{tile:Buffer.alloc(16),attr:8};
  for(const f of p.extra){if(f.work?.[0]!==3)continue;stoneChange(state,f.tail[68],f.work,back);const c=stoneCompose(state,a,base,0);maxCells=Math.max(maxCells,c.cells.length);maxResidual=Math.max(maxResidual,c.residual.length);if(f.work[1]===3)clearCount++;}
  assert.ok(maxCells>16&&maxCells<=40);assert.equal(maxResidual,2);assert.equal(clearCount,4);
  assert.equal(stoneCompose(state,a,base,0).patterns.length,0);
  assert.deepEqual(p.extra.at(-1).ppu.subarray(0x2000,0x2800),p.initialPpu.subarray(0x2000,0x2800));
  const unchanged=stoneAssets(data,{...p,frames:[]});assert.deepEqual(unchanged,a);
 }
});
test('cache-miss and restoration blocks come from immutable original job/toad/mini resources',async()=>{
 const {data}=await input(),jobs=jobAssets(data);assert.equal(jobs.length,15040);let blocks=0,short=0;
 for(const back of [false,true])for(const options of [{partyStatus:[128,64,32,8],cache:[0,0,0,0]},{partyStatus:[64,96,72,64],clearAfter:true}]){
  const p=statusVideoOracle(data,{back,stone:true,...options});
  for(const f of p.extra){if(f.work?.[0]!==2)continue;const w=f.work,start=(w[1]<22?w[1]*672:14784+(w[1]-24)*128)+w.readUInt16LE(2);assert.deepEqual(jobs.subarray(start,start+w[4]),f.source);blocks++;if(w[4]===32)short++;}
 }
 assert.equal(blocks,28);assert.equal(short,6);
});

test('stone ownership masks both mapped and residual colors and restores original enemy OBJ',()=>{
 const glyphs=Buffer.alloc(1920),remap=Buffer.alloc(16,255);glyphs[0]=0xc0;remap[1]=1;
 const a={glyphs,remap,base:162,span:47},state=[{kind:0,x:12}],enemy=Buffer.alloc(32);enemy.fill(255,16);
 const source=Buffer.alloc(160);source.set([16,104,0,0]);source.set([16,104,1,13],4);
 const base=()=>({tile:Buffer.alloc(16,255),attr:8});
 const c=stoneCompose(state,a,base,1,source,enemy);assert.equal(c.masked.length,1);assert.equal(c.residual.length,0);
 const o=stoneOam(source,c);assert.equal(o[2],c.masked[0].tile);assert.equal(c.patterns.at(-16),63);assert.equal(c.patterns.at(-15),63);
 const clear=stoneCompose([{kind:3,x:12}],a,base,1,source,enemy);assert.equal(clear.patterns.length,0);assert.deepEqual(stoneOam(source,clear).subarray(0,4),source.subarray(4,8));
 remap[1]=255;const mixed=stoneCompose(state,a,base,0,source,enemy);assert.equal(mixed.residual.length,1);assert.equal(mixed.masked.length,1);
 assert.throws(()=>stoneCompose(state,{...a,span:2},base,0,source,enemy),/capacity/);
});
test('clearing stone alone preserves confusion and small forms at the original BG column',async()=>{
 const {data}=await input();for(const back of [false,true]){
  const r=tailReference(data,{back,normalized:[72,73,76,72],clearAfter:3,countSentinel:true}),refresh=r.frames.slice(r.refreshIndex);
  assert.deepEqual([...r.terminal.state.subarray(5,9)],[8,9,12,8]);
  assert.deepEqual([...r.terminal.state.subarray(13,17)],[176,176,176,176]);
  assert.equal(refresh.filter(f=>f.state[67]===5).length,0);
  assert.equal(refresh.filter(f=>f.work?.[0]===3&&f.work[1]===3).length,4);
  assert.deepEqual([...r.terminal.state.subarray(59,64)],[9,8,7,6,5]);
 }
});
