import test from 'node:test';import assert from 'node:assert/strict';
import {openingCosts} from '../tools/battle-opening-costs.mjs';
test('opening attribution rejects absent, conflicting, and incomplete measurements',()=>{
 const pages=[{seconds:1}],log='opening-cost:1,91,4194304,8388608\nopening-cost:1,94,2097152,8388608\nopening-cost:1,92,2097152,8388608';
 const [r]=openingCosts(log+'\n'+log,pages);
 assert.equal(r.totalMs,1000);assert.equal(r.costs.audioService,500);assert.equal(r.costs.composition,250);assert.equal(r.costs.transferWait,250);
 assert.throws(()=>openingCosts('',pages),/attribution/);
 assert.throws(()=>openingCosts(log+'\nopening-cost:1,91,4194303,8388608',pages),/Conflicting/);
 assert.throws(()=>openingCosts(log,[{seconds:2}]),/attribution/);
 assert.throws(()=>openingCosts(log.replaceAll('8388608','4194304'),pages),/domain/);
});
