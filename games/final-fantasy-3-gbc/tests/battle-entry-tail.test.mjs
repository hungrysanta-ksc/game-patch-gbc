import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {tailReference,tailAssets} from '../tools/battle-entry-tail-source.mjs';
test('confusion removal walks back at source normal/mini/toad speeds and preserves unrelated counts',async()=>{
 const {data}=await input();for(const back of [false,true]){
  const r=tailReference(data,{back,normalized:[8,9,12,0],clearAfter:2,countSentinel:true}),refresh=r.frames.slice(r.refreshIndex);
  const moves=refresh.filter(f=>f.state[67]===5),inner=refresh.filter(f=>f.state[67]===6);
  assert.deepEqual([0,1,2].map(i=>moves.filter(f=>f.state[68]===i).length),[16,48,16]);
  // Remove confusion alone: mini/toad remain small during the return.
  assert.equal(r.frames.slice(0,r.refreshIndex).filter(f=>f.state[67]===5&&f.state[68]===1).length,48);
  assert.ok(moves.every(f=>f.state[5+f.state[68]]&8));
  assert.ok(inner.every(f=>!(f.state[5+f.state[68]]&8)));
  assert.deepEqual([...r.terminal.state.subarray(13,17)],[208,224,208,224]);
  assert.deepEqual([...r.terminal.state.subarray(59,64)],[9,8,7,6,5]);
 }
});
test('boss entry retains eight shifts per four-tile block, with no entry SFX synthesized',async()=>{
 const {data}=await input(),a=tailAssets(data);
 for(const back of [false,true])for(const boss of [0,8,16]){
  const r=tailReference(data,{back,boss}),b=r.frames.filter(f=>f.state[67]===1);
  assert.equal(b.length,a.bosses[boss].chunks*8);assert.equal(r.frames.length,b.length+5);
  for(let n=0;n<b.length;n++){assert.equal(b[n].work[4],64);assert.equal(b[n].work.readUInt16LE(2),Math.floor(n/8)*64);assert.equal(b[n].work.readUInt16LE(5),0x700+Math.floor(n/8)*64);}
  assert.equal(r.terminal.state[67],8);assert.equal(r.terminal.state.readUInt16LE(69),r.frames.length);
  assert.deepEqual(r.sounds,[]);
 }
});
test('status graphics cache hits avoid hide/reload waits; stone and clearing keep small map writes',async()=>{
 const {data}=await input();for(const back of [false,true]){
  const hit=tailReference(data,{back,normalized:[0,64,0,64],cache:[0,0,0,0]});
  assert.deepEqual(hit.frames.map(f=>f.state[67]),[2,7,7,7,7]);
  assert.deepEqual(hit.frames.slice(1).map(f=>f.work[1]),[3,0,3,0]);
  assert.deepEqual(hit.frames.slice(1).map(f=>f.work[4]),[8,6,8,6]);
  const miss=tailReference(data,{back,normalized:[128,4,1,0],cache:[0,0,0,1]});
  assert.equal(miss.frames.filter(f=>f.state[67]===3).length,4);
  assert.deepEqual(miss.frames.filter(f=>f.state[67]===4).map(f=>f.work[4]),[64,32,64,64,64,64,64,64,64,32]);
 }
});
test('confusion moves before inner and outer status publication, preserving duplicate waits',async()=>{
 const {data}=await input(),r=tailReference(data,{normalized:[8,0,0,0],rows:[1,0,0,0]});
 assert.equal(r.frames.filter(f=>f.state[67]===5).length,24); // E0 -> B0, two pixels per source step.
 const inner=r.frames.findIndex(f=>f.state[67]===6);assert.equal(r.frames[inner+1].state[67],7);
 assert.equal(r.frames[inner].state[9],1);assert.equal(r.frames[inner+1].state[9],0);
 assert.deepEqual(r.frames[inner].work,r.frames[inner+1].work);assert.equal(r.terminal.state[13],0xb0);
});
