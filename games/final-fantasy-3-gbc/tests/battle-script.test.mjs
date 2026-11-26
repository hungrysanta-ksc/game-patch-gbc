import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {scriptAssets,scriptSeed,scriptReference,scriptCases} from '../tools/battle-script-source.mjs';
test('six original scripts retain external graphics barriers, message queue loops and source waits',async()=>{
 const {data}=await input(),a=scriptAssets(data);assert.deepEqual([...a.tables.lengths],[15,15,4,7,6,5]);
 const cases=scriptCases(data);assert.equal(cases.length,217);
 for(const row of cases){const trace=scriptReference(data,row.seed,row);assert.equal(trace.at(-1).state[23],5);assert.equal(trace.at(-1).state[24],255);assert.ok(trace.every(e=>e.state.readUInt16LE(27)>0));}
 const loop=scriptReference(data,scriptSeed(0,{speed:8,messages:[65,65,65]}));
 assert.equal(loop.filter(e=>e.state[23]===1&&e.state[24]===9).length,3);
 assert.equal(loop.filter(e=>e.state[23]===4&&e.state[24]===11).length,1);
 assert.equal(loop.filter(e=>e.state[23]===4&&e.state[24]===12).length,1);
});
test('source wait is 64..0 frames and early A ends after one frame',async()=>{
 const {data}=await input();for(const speed of [0,1,4,7,8]){const seed=scriptSeed(2,{speed});for(const early of [false,true]){const trace=scriptReference(data,seed,{early});assert.equal(trace.filter(e=>e.state[23]===2).length,early&&speed<8?1:(8-speed)*8);}}
 const skip=scriptReference(data,scriptSeed(255,{effect:0}));assert.equal(skip.length,1);assert.equal(skip[0].state[23],5);
});
