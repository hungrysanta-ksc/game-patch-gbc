import test from 'node:test';import assert from 'node:assert/strict';
import {audioProducerCosts} from '../tools/audio-producer-profile.mjs';
test('audio sub-costs must exactly partition the parent service interval',()=>{
 const parents=[{costs:{audioService:1000}}],log=[0,1,2,3].map(k=>'audio-cost:1,'+k+',2097152,8388608,10').join('\n');
 const [r]=audioProducerCosts(log+'\n'+log,parents);assert.equal(r.totalMs,1000);assert.equal(r.costs.snapshots,0);assert.equal(r.costs.originalVm,250);
 assert.throws(()=>audioProducerCosts('',parents),/attribution/);
 assert.throws(()=>audioProducerCosts(log,[{costs:{audioService:1016.8}}]),/attribution/);
 assert.throws(()=>audioProducerCosts(log+'\naudio-cost:1,1,2097153,8388608,10',parents),/Conflicting/);
 assert.throws(()=>audioProducerCosts(log.replaceAll('8388608','4194304'),parents),/domain/);
});
