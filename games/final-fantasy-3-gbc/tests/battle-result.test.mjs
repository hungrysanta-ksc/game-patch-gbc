import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {R,resultSeed,sourceResult} from '../tools/battle-result-source.mjs';
import {fightSeed,sourceFight} from '../tools/battle-fight-source.mjs';
test('source outcomes preserve escape and defeat precedence, and use committed status rather than HP',async()=>{
 const {data}=await input();const s=resultSeed();s[R.remaining]=0;assert.equal(sourceResult(data,s,4).state[R.result],64);
 for(let i=0;i<4;i++){s[i*64+1]=i%2?64:128;s.writeUInt16LE(9999,i*64+3);}assert.equal(sourceResult(data,s,4).state[R.result],128);
 s[R.result]=2;assert.equal(sourceResult(data,s,4).state[R.result],2);
 s[R.result]=0;s[R.remaining]=1;s[1]=0;s.writeUInt16LE(0,3);assert.equal(sourceResult(data,s,4).state[R.result],0);
});
test('source run checks confusion in every slot; unconditional escape still obeys the battle flag',async()=>{
 const {data}=await input();for(const op of [2,3])for(let i=0;i<4;i++){
  const s=resultSeed();s[R.first]=1;s[i*64+2]=32;const r=sourceResult(data,s,op);assert.equal(r.state[R.message],31);assert.equal(r.state[R.result],0);
 }
 const s=resultSeed();assert.equal(sourceResult(data,s,3).state[R.result],2);s[R.flags]=1;assert.equal(sourceResult(data,s,3).state[R.message],31);
});
test('escape consumes no probability roll, normal run consumes rng1 even when first-strike bypasses failure',async()=>{
 const {data}=await input(),s=resultSeed();s[R.first]=1;
 assert.deepEqual([...sourceResult(data,s,3).counters],[17,0,239]);assert.deepEqual([...sourceResult(data,s,2).counters],[17,1,239]);
});
test('lethal source calculation stages status; victory waits for original graphics removal count',async()=>{
 const {data}=await input(),f=fightSeed();f[48]=128;f[23]=f[28]=8;f[24]=f[29]=100;f[97]=f[98]=f[40]=0;f.writeUInt16LE(1,67);
 const hit=sourceFight(data,f),s=resultSeed();s.set(hit.state.subarray(0,64));s.set(hit.state.subarray(64,128),256);s.set(hit.state.subarray(161,163),R.actorStatus);s.set(hit.state.subarray(163,165),R.targetStatus);
 assert.equal(s[257]&128,0);assert.equal(sourceResult(data,s,4).state[R.result],0);
 const committed=sourceResult(data,s,0).state;assert.ok(committed[257]&128);assert.ok(committed[R.dead]&128);assert.equal(sourceResult(data,committed,4).state[R.result],0);
 committed[R.remaining]=0;assert.equal(sourceResult(data,committed,4).state[R.result],64);
});
test('monster status commit retains the original destructive E8 mask and cannon skips near-fatal refresh',async()=>{
 const {data}=await input(),s=resultSeed();s[257]=0x17;s[R.targetStatus]=0x20;s[R.near]=0xa5;
 const r=sourceResult(data,s,1).state;assert.equal(r[257],0xa0);assert.equal(r[R.dead],0xa0);assert.equal(r[R.near],0xa5);
 s[R.actor]=255;assert.deepEqual(sourceResult(data,s,1).state.subarray(0,816),r.subarray(0,816));
});
