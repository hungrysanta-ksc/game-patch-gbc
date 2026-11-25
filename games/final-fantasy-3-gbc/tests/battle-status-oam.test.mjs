import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {statusOamReference,statusOamAssets} from '../tools/battle-status-oam-source.mjs';
import {statusVideoOracle,statusNativeOam} from '../tools/battle-status-video.mjs';
import {tailReference} from '../tools/battle-entry-tail-source.mjs';
import {partyEntryOracle} from '../tools/battle-party-oam-source.mjs';
test('status gate preserves previous OAM and counter; active animation wraps at 256',async()=>{
 const {data}=await input(),base=Buffer.from([208,224,208,224,44,72,100,128,0,1,2,255,0,0,0,0,...Array(16).fill(0),0,0,255]),prev=Buffer.alloc(64,0x37);
 assert.deepEqual(statusOamReference(data,base,prev),{counter:255,oam:prev});
 base[33]=1;const a=statusOamReference(data,base);assert.equal(a.counter,0);assert.equal(a.oam[25],0);assert.equal(a.oam[29],0);assert.ok(a.oam.subarray(32).every(v=>v===240));
 base[34]=0;const b=statusOamReference(data,base);assert.equal(a.oam[1]-b.oam[1],2);
 assert.equal(statusOamAssets(data).tables.reduce((n,t)=>n+t.size,0),36);
});
test('canonical wait retains physical OAM; following status wait publishes it',async()=>{
 const {data}=await input();for(const back of [false,true]){
  const r=tailReference(data,{back}),a=r.frames[0],b=r.frames[1];
  assert.equal(a.state[67],2);assert.deepEqual(a.published.oam.subarray(160),partyEntryOracle(data,{back}).frames.at(-1).original);
  if(back)assert.notDeepEqual(a.oam.subarray(160),a.published.oam.subarray(160));
  assert.deepEqual(b.oam.subarray(160),b.published.oam.subarray(160));
 }
});
test('native command graphics and icon animation follow B304 enable after canonical tail',async()=>{
 const {data}=await input();for(const back of [false,true]){
  const p=statusVideoOracle(data,{back,partyStatus:[2,4,16,1]});
  assert.deepEqual([...p.statusSeed.subarray(8,12)],[5,4,3,6]);
  assert.deepEqual(p.extra.slice(0,5).map(f=>f.stage),[1,1,1,1,1]);
  assert.ok(p.extra.slice(0,5).every(f=>f.icons.every(v=>v===240)));
  const a=p.extra[5],b=p.extra[13];assert.equal(b.icons[1]-a.icons[1],2);
  assert.equal(statusNativeOam(a.icons,back).length,32);
  assert.ok(p.commandBlocks.length>0);assert.ok(p.commandRanges.every(r=>r.begin>=0x1390));
 }
 assert.throws(()=>statusVideoOracle(data,{partyStatus:[64,0,0,0]}),/registered tail consumers/);
});
