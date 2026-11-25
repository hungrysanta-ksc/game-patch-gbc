import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {openingSeed,openingReference,fullOpeningReference,openingScript} from '../tools/battle-opening-source.mjs';
test('cannon action script comes from the supported original pointer and command stream',async()=>{const {data}=await input(),s=openingScript(data);assert.equal(s.at,0x953b);assert.deepEqual([...s.bytes],[9,11,12,14,10,4,255]);});
test('cannon numerals remain visible before the actor-number pass overwrites their buffer',async()=>{
 const {data}=await input(),s=openingSeed(data),trace=openingReference(data,s),numbers=trace.filter(r=>r.kind===1&&r.value===28);
 assert.equal(numbers.length,2);assert.deepEqual(numbers[0].state.subarray(567,583),s.subarray(567,583));assert.ok(numbers[1].state.subarray(567,583).every(v=>v===255));assert.deepEqual(numbers.map(r=>r.state[704]),[1,0]);
 assert.equal(trace.filter(r=>r.kind===1&&r.value===36).length,1);assert.equal(trace.at(-1).kind,7);assert.equal(trace.at(-1).state[697]&32,0);assert.equal(trace.at(-1).state[699],1);
});
test('death slots and rewards commit only after their presentation request, then victory replaces selection',async()=>{
 const {data}=await input(),trace=openingReference(data,openingSeed(data,{hp:1,speed:8})),death=trace.find(r=>r.kind===1&&r.value===10),end=trace.at(-1);
 assert.ok(death);assert.ok(death.state.subarray(665,673).some(v=>v!==255));assert.equal(end.kind,9);assert.equal(end.state[700],64);assert.ok(end.state.subarray(665,673).every(v=>v===255));assert.deepEqual([...end.state.subarray(689,693)],[2,2,2,2]);assert.ok(!trace.some(r=>r.kind===7));
});
test('initial incapacitated party and surprise attack retain original caller boundaries',async()=>{
 const {data}=await input();for(const status of [[128,128,128,128],[64,64,64,64]]){const t=openingReference(data,openingSeed(data,{status}));assert.equal(t.length,1);assert.equal(t[0].kind,8);assert.equal(t[0].state[0],4);}
 const t=openingReference(data,openingSeed(data,{cannon:false,first:128}));assert.deepEqual(t.map(r=>[r.kind,r.value]),[[1,0],[8,0]]);
 const mixed=openingReference(data,openingSeed(data,{status:[128,64,32,8]}));assert.equal(mixed.at(-1).state[0],2);
});
test('message speed holds source frames and A can shorten the wait',async()=>{
 const {data}=await input();for(const speed of [0,4,8]){const s=openingSeed(data,{speed}),t=openingReference(data,s);assert.equal(t.filter(r=>r.kind===6).length,(8-speed)*8);const short=openingReference(data,s,{shortWait:true});assert.equal(short.filter(r=>r.kind===6).length,speed===8?0:1);}
});
test('full original graphics and its metadata adapter agree through entry, cannon, death and return',async()=>{
 const {data}=await input();for(const hp of [1,500])for(const back of [false,true]){const full=fullOpeningReference(data,{hp,back});assert.deepEqual(full.trace,openingReference(data,full.state));assert.ok(full.boundaries.length>100);assert.ok(full.boundaries.some(r=>r.transfers.chr>0));assert.deepEqual(full.sounds.map(s=>s.request),hp===1?[128,177]:[128]);}
});
