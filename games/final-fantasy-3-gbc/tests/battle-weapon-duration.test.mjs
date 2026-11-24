import test from 'node:test';import assert from 'node:assert/strict';import {input} from '../tools/source.mjs';import {weaponDuration} from '../tools/battle-weapon-duration.mjs';
test('whole original sword body repeats eight waits per swing and caps at four visual swings',async()=>{
 const {data}=await input();for(const n of [0,1,2,3,4,5,6,7,8,255])for(const critical of [0,1]){
  const r=weaponDuration(data,{hits:[n,0],critical}),swings=r.events.filter(e=>e.kind==='swing'),slices=r.events.filter(e=>e.kind==='slice'),sounds=r.events.filter(e=>e.kind==='sound-request'&&e.value===182),count=Math.max(1,Math.min(n,4));
  assert.equal(swings.length,count);assert.equal(sounds.length,count);assert.equal(slices.length,n?count*4:0);assert.equal(r.weaponWaits,2+count*8+(n&&critical?2:0));
  for(let i=1;i<count;i++)assert.equal(swings[i].wait-swings[i-1].wait,8+(critical&&n&&i===1?2:0));
  assert.deepEqual(sounds.map(e=>e.wait),swings.map(e=>e.wait));assert.equal(r.events.filter(e=>e.kind==='hand').length,2);
 }
});
test('two swords retain independent repeats while a bare offhand does not add an unarmed animation',async()=>{
 const {data}=await input();for(const hits of [[0,0],[1,3],[3,2],[6,9]]){const r=weaponDuration(data,{left:0x1f,hits}),counts=hits.map(n=>Math.max(1,Math.min(n,4)));
  assert.equal(r.weaponWaits,4+8*(counts[0]+counts[1]));for(let hand=0;hand<2;hand++)assert.equal(r.events.filter(e=>e.kind==='swing'&&e.hand===hand).length,counts[hand]);
 }
 const r=weaponDuration(data,{hits:[3,0],confused:true});assert.equal(r.events.filter(e=>e.kind==='swing').length,1);assert.equal(r.events.filter(e=>e.kind==='slice').length,0);assert.equal(r.weaponWaits,10);
});
