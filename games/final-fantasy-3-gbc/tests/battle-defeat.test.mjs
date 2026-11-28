import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {restartSource} from '../tools/battle-restart-source.mjs';
import {sourceEnd,sourceEndAnimation} from '../tools/battle-command-source.mjs';
import {initializedBattle} from '../tools/battle-transition-source.mjs';
test('actual soft-restart loads three save windows plus new-game and speed, defaulting to new game',async()=>{
 const {data}=await input(),s=restartSource(data);assert.deepEqual(s.windows,[17,18,19,12,33]);assert.deepEqual(s.strings,[34,35]);
 assert.deepEqual([...s.oam.subarray(0,16)],[16,228,3,8,16,229,3,16,24,230,3,8,24,231,3,16]);assert.ok(s.oam.subarray(16).every(v=>v===240));
});
test('all jobs load six source dead tiles and preserve the untouched eight resident tiles',async()=>{
 const {data}=await input();for(let job=0;job<22;job++){
  const {m}=initializedBattle(data,{formation:3,back:false,rows:[0,0,0,0],terrain:8,jobs:[job,0,0,0]}),c=m.c;m.call(0xb469);const prior=Buffer.from(m.ppu.bytes.subarray(0x1010,0x10f0));c.m[0x7d9b]=128;c.x=0;m.call(0xb5c3);
  assert.equal(c.m[0x7da3],1);assert.equal(c.m[0x7d83],9);assert.deepEqual(m.ppu.bytes.subarray(0x1070,0x10f0),prior.subarray(96));
 }
});
test('defeat control keeps event 0179 separate from ordinary 0079, and skips party export',async()=>{
 const {data}=await input();for(const id of [0,3,0x79,0x173,0x178,0x179,511]){
  const e=sourceEnd(data,id,128,8);assert.deepEqual(e.map(v=>v.request),[1,2,3,7,8,id===0x179?9:10]);assert.equal(sourceEndAnimation(data,id,128).inputCalls,id===0x179?0:2);
 }
});
