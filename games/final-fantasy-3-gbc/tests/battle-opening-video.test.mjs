import test from 'node:test';
import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {openingPresentation} from '../tools/battle-opening-assets.mjs';
import {openingReference} from '../tools/battle-opening-source.mjs';
test('opening presentation keeps source request states, numeral lifetime and source sounds',async()=>{
 const {data}=await input();
 for(const back of [false,true])for(const hp of [1,500]){
  const p=openingPresentation(data,{back,hp});
  assert.deepEqual(p.trace,openingReference(data,p.state));
  assert.equal(p.music,32);
  assert.deepEqual(p.requests.flatMap(r=>r.sounds.map(s=>[s.op,s.arg])),hp===1?[[7,0],[7,49]]:[[7,0]]);
  assert.equal(p.requests.filter(r=>r.kind===6).length,32);
  const numbers=p.requests.filter(r=>r.kind===1&&r.value===28);
  assert.equal(numbers.length,2);
  assert.deepEqual(numbers[0].frames.filter(f=>f.numberFrame!==null).map(f=>f.numberFrame),Array.from({length:32},(_,i)=>i));
  assert.equal(numbers[1].frames.filter(f=>f.numberFrame!==null).length,0);
  assert.ok(numbers[1].frames[0].numberObjects.length>0,'No-value call leaves the preceding numeral OAM alive');
  assert.equal(p.trace.at(-1).kind,hp===1?9:7);
 }
});
