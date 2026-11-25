import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {statusVideoOracle} from '../tools/battle-status-video.mjs';
import {stoneAssets,stoneChange,stoneCompose,jobAssets} from '../tools/battle-stone.mjs';
import {residentEnemy} from '../tools/battle-resident-bg.mjs';import {terrainAssets,terrainFrames} from '../tools/battle-terrain.mjs';
import {tailReference} from '../tools/battle-entry-tail-source.mjs';
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
