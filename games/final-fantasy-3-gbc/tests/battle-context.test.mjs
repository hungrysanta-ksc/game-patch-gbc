import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {contextReference,contextCases,initialPartyPresentation,cannonDispatchReference} from '../tools/battle-context-source.mjs';
test('Invincible vehicle seven suppresses surprise RNG and sets one-shot cannon flag',async()=>{
 const {data}=await input(),run=contextReference(data);
 for(let vehicle=0;vehicle<256;vehicle++){const s=Buffer.alloc(26);s[2]=vehicle;s.fill(33,4,16);const r=run(1,s);assert.equal(!!(r.state[0]&32),vehicle===7);if(vehicle===7){assert.deepEqual([...r.counters],[17,0,239]);assert.equal(r.state[24],0);assert.equal(r.state[25],0);}}
});
test('initial persistent death/stone/toad/mini use original graphics before command selection',async()=>{
 const {data}=await input();for(const back of [false,true])for(const partyStatus of [[0,128,64,32],[8,160,136,96],[2,4,16,1],[128,128,128,128]]){
  const r=initialPartyPresentation(data,{partyStatus,back});assert.equal(r.members.length,4);assert.ok(r.boundaries.length>1);
 }
});
test('cannon damage consumes RNG only for non-dead slots and preserves exact-zero boundary',async()=>{
 const {data}=await input(),run=contextReference(data),s=Buffer.alloc(578);for(let i=0;i<8;i++){s[i*64+1]=128;s.writeUInt16LE(500,i*64+3);}s[1]=0;
 const first=run(3,s),damage=first.state.readUInt16LE(512);assert.ok(damage>=250&&damage<=312);
 for(const delta of [-1,0,1]){s.writeUInt16LE(damage+delta,3);const r=run(3,s);assert.equal(r.state.readUInt16LE(3),delta&65535);assert.equal(r.state[1],delta<0?128:0);assert.equal(r.state[544],delta<0?128:0);assert.deepEqual([...r.counters],[17,1,239]);assert.equal(r.state.readUInt16LE(514),65535);}
});
test('original cannon dispatcher clears pending flag and branches to victory before another command collection',async()=>{
 const {data}=await input();for(const victory of [false,true]){const calls=cannonDispatchReference(data,{victory});assert.deepEqual(calls.map(x=>x.pc),[0xfa0e,0x8f0b,0x8ff7,0xa458,victory?0x811c:0xfa0e]);assert.equal(calls[0].a,15);assert.equal(calls[1].message,61);assert.equal(calls[1].flags,0x88);assert.equal(calls[2].script,3);if(!victory)assert.equal(calls.at(-1).a,14);}
});
test('retarget failure marker and split reservation follow source without inventing graphics commit',async()=>{
 const {data}=await input(),run=contextReference(data),rows=contextCases();let splits=0,failed=0;
 for(const row of rows.filter(r=>r.op>=4)){const r=run(row.op,row.state,row.counters);assert.equal(r.ok,1);if(row.op===4&&r.state[27])failed++;if(row.op===5&&r.state[614]===0x6f){splits++;assert.deepEqual(r.state.subarray(592,600),row.state.subarray(592,600));assert.equal(r.state[613],row.state[613]);}}
 assert.ok(splits>0);assert.ok(failed>0);
});
