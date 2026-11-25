import test from 'node:test';import assert from 'node:assert/strict';import {refillCosts} from '../tools/audio-refill-costs.mjs';
test('refill bursts partition audio service and retain worst wait phase',()=>{
 const p=[{costs:{audioService:1000}}],s='refill-cost:1,25,10,8388608,4194304,100,140,2,31';
 const [r]=refillCosts(s+'\n'+s,p);assert.equal(r.maxMs,500);assert.equal(r.phases[0].phase,9);assert.equal(r.phases[0].transfer,true);
 assert.throws(()=>refillCosts('',p),/Complete/);assert.throws(()=>refillCosts(s,[{costs:{audioService:1001}}]),/Complete/);
 assert.throws(()=>refillCosts(s.replace('4194304','8388609'),p),/domain/);
});
