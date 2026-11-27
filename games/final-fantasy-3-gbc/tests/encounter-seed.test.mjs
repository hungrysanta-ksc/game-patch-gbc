import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {encounterSeedOriginal} from '../tools/encounter-seed-source.mjs';

test('whole original entry owns exactly 27 DP bytes and retains all sound scratch',async()=>{
 const {data}=await input(),dp=Buffer.from(Array.from({length:256},(_,i)=>i));
 for(const flags of [0,3,4,255])for(const vehicle of [0,3,4,7,255]){
  dp[0x46]=vehicle;const r=encounterSeedOriginal(data,dp,flags,{formation:1,background:8,carry:1});
  assert.equal(r.a,0);assert.equal(r.carry,+(vehicle>=4&&flags>=4));assert.equal(r.touched.length,27);assert.equal(r.inherited.length,229);
  assert.deepEqual(r.input.subarray(0xd0,0xe0),dp.subarray(0xd0,0xe0));for(const i of r.inherited)assert.equal(r.input[i],dp[i]);
  assert.ok(r.prefixInstructions>39000);assert.equal(r.input[0x7e],flags);assert.equal(r.input[0xab],0x17);
 }
});
test('field DP is immutable and incoming CPU carry/background do not replace source carry',async()=>{
 const {data}=await input(),dp=Buffer.alloc(256,255),copy=Buffer.from(dp);
 for(const flags of [0,4]){const a=encounterSeedOriginal(data,dp,flags,{carry:0,background:0}),b=encounterSeedOriginal(data,dp,flags,{carry:1,background:255});assert.equal(a.seed,b.seed);assert.deepEqual(a.input,b.input);}
 assert.deepEqual(dp,copy);assert.throws(()=>encounterSeedOriginal(data,dp.subarray(1)),/Complete source DP/);
});
