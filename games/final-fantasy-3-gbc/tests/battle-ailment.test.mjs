import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {ailmentSeed,sourceAilment,sourceAilmentTargets,sourceStatusRecovery,ailmentInventory} from '../tools/battle-ailment-source.mjs';
import {contextReference} from '../tools/battle-context-source.mjs';
import {resultSeed,sourceResult,R} from '../tools/battle-result-source.mjs';
test('stone suspends poison without erasing it; cure resumes poison, including exact-zero death',async()=>{
 const {data}=await input();let s=ailmentSeed(0x42,0x20);s.writeUInt16LE(62,67);s.writeUInt16LE(1000,69);
 let r=sourceAilment(data,s,6,0);assert.equal(r.state.readUInt16LE(67),62);assert.equal(r.state[65],0x42);assert.equal(r.state.readUInt16LE(169),65535);
 r=sourceAilment(data,r.state,2,64);assert.equal(r.state[65],2);assert.equal(r.state[66],32);
 r=sourceAilment(data,r.state,6,0);assert.equal(r.state.readUInt16LE(67),0);assert.equal(r.state[65],0x82);assert.equal(r.state[66],32);assert.equal(r.state.readUInt16LE(169),62);
});
test('ordinary target filtering excludes dead, stone and jump; resurrection/soft are explicit exceptions',async()=>{
 const {data}=await input();for(let a=0;a<256;a++)for(const b of [0,1,32,128]){
  assert.equal(sourceAilmentTargets(data,a,b,0x98),((a&192)||(b&1))?0:64);
  assert.equal(sourceAilmentTargets(data,a,b,0xa9),64);
  assert.equal(sourceAilmentTargets(data,a,b,0xaa),!(a&128)?64:0);
  assert.equal(sourceAilmentTargets(data,a,b,0,true),((a&192)||(b&1))?0:64);
  for(const id of [4,25])assert.equal(sourceAilmentTargets(data,a,b,id,true),64);
  for(const id of [11,18])assert.equal(sourceAilmentTargets(data,a,b,id,true),!(a&128)?64:0);
 }
});
test('small forms and confusion survive petrification; death suppresses stone/icons without clearing bits',async()=>{
 const {data}=await input(),view=contextReference(data);
 for(const small of [0,8,32,40]){const s=ailmentSeed(small|2,32),r=sourceAilment(data,s,1,64);assert.equal(r.state[163],small|66);assert.equal(r.state[164],32);
  const v=view(2,Buffer.from([r.state[163],32,0,0,0,0,0,0])).state;assert.equal(v[4],255);assert.equal(v[7],1);assert.equal(v[6],small&32?2:small&8?3:0);
  const dead=view(2,Buffer.from([r.state[163]|128,32,0,0,0,0,0,0])).state;assert.equal(dead[4],255);assert.equal(dead[7],0);
 }
 const s=ailmentSeed(64,32),c=sourceAilment(data,s,3,255);assert.equal(c.state[137],0);assert.equal(c.state[65],64);assert.equal(c.state[66],32);
});
test('death/revival retains uncured statuses and battle exit retains only the persistent byte',async()=>{
 const {data}=await input();let s=ailmentSeed(0xae,0xe6);s.writeUInt16LE(0,67);
 let r=sourceAilment(data,s,5,255);assert.equal(r.state[65],0x2e);assert.equal(r.state[66],0xe6);assert.equal(r.state.readUInt16LE(67),1000);assert.equal(r.state[174],0);
 r=sourceAilment(data,r.state,7,0);assert.equal(r.state[177],0x2e);r=sourceAilment(data,r.state,8,0);assert.equal(r.state[65],0x2e);assert.equal(r.state[66],0);assert.equal(r.state.readUInt16LE(67),1000);
});
test('a party entirely dead or stone loses even when petrified members still have HP',async()=>{
 const {data}=await input(),s=resultSeed();for(let i=0;i<4;i++)s[i*64+1]=64;
 assert.ok(s.readUInt16LE(3)>0);assert.equal(sourceResult(data,s,4).state[R.result],128);
 s[3*64+1]=0;assert.equal(sourceResult(data,s,4).state[R.result],0);
});
test('sleep/paralysis turn recovery uses one RNG draw and duration, not unconditional status clearing',async()=>{
 const {data}=await input();let cleared=0,retained=0;
 for(const status of [0x88,0x90,0x98,0x48,0x50,0x58])for(const enemy of [false,true])for(const counter of [0,17,73,174,255]){const r=sourceStatusRecovery(data,status,{enemy,counter});assert.equal(r.counters[1],(counter+1)&255);assert.equal(r.status,r.staged);if(!(r.status&192))cleared++;else retained++;}
 assert.ok(cleared&&retained);
});
test('status inventory includes actual weapon, item and magic consumers, including damage plus status',async()=>{
 const {data}=await input(),r=ailmentInventory(data);assert.equal(r.attackRecords,115);assert.ok(r.spells.every(s=>s.id<115));assert.ok(r.spells.some(s=>s.effect===0&&s.mask));assert.ok(r.spells.filter(s=>s.effect===5).every(s=>s.mask===128));assert.ok(r.items.some(s=>s.item===0xa9));assert.ok(r.items.some(s=>s.item===0xaa));assert.ok(r.weapons.some(s=>s.mask));
});
