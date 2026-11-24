import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {offset} from '../tools/render-budget-source.mjs';
import {physicalRng,sourcePhysical,sourceWeaponSequence,sourceMonsterFlash,sourcePartyHurt} from '../tools/battle-physical-source.mjs';
import {sourceEquipmentStats,equipmentProperties} from '../tools/battle-equipment-source.mjs';import {sourceInitialState} from '../tools/state-source.mjs';
test('all 22 jobs feed level and job proficiency into equipment-derived physical stats',async()=>{
 const {data}=await input(),initial=sourceInitialState(data),properties=equipmentProperties(data).bytes;
 for(let job=0;job<22;job++)for(const level of [1,15,16,99])for(const proficiency of [0,1,3,4,98,99]){
  const s=Buffer.concat([initial.subarray(0x100,0x140),initial.subarray(0x200,0x240),Buffer.alloc(64)]);s[0]=job;s[1]=level;s[16]=proficiency;s[67]=0x1e;s[69]=0;
  const r=sourceEquipmentStats(data,s);assert.equal(r[33],(level>>4)+(r[24]>>4)+1);assert.equal(r[34],Math.min(99,properties[0x1e*8+1]+(r[24]>>2)+(proficiency>>2)));
 }
});
test('original hit rolls preserve RNG consumption, zero attempts and strict chance boundary',async()=>{
 const {data}=await input(),table=physicalRng(data);
 for(let attempts=0;attempts<256;attempts++)for(const chance of [0,1,49,99,100,255]){let counter=255,hits=0;for(let n=0;n<attempts;n++){const product=99*((table[counter++&255]<<8)|128),roll=(product>>>16)+((product&32768)?1:0);hits+=roll<chance;}
  assert.deepEqual(sourcePhysical(data,1,[attempts,chance,0,0,0,0,0,1,0,128,255],table),Buffer.from([hits,0,17,counter&255,239]));}
});
test('original damage uses integer widths, character-versus-character defense exception and 9999 cap',async()=>{
 const {data}=await input(),table=physicalRng(data);let seed=0x46334633;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;};
 for(let i=0;i<4096;i++){const p=Array.from({length:11},next);p[7]=p[7]||1;const upper=(p[0]>>1)|((p[1]&1)<<7),product=upper*((table[p[10]]<<8)|128),roll=upper?(product>>>16)+((product&32768)?1:0):0;
  let damage=((p[0]|p[1]<<8)+roll)&65535;damage=p[3]>>1?(damage*(p[3]>>1))&65535:damage>>1;damage=(damage+p[4]*p[5])&65535;if((p[8]|p[9])&128)damage=Math.max(0,damage-p[2]);damage=Math.min(9999,Math.floor(((damage*p[6])&65535)/p[7]));
  assert.deepEqual(sourcePhysical(data,2,p,table),Buffer.from([damage&255,damage>>8,17,(p[10]+!!upper)&255,239]));
 }
 assert.throws(()=>sourcePhysical(data,2,Array(11).fill(0)),/target/);
 const p=[0,0,255,2,0,0,1,1,0,128,255];assert.deepEqual(sourcePhysical(data,2,p),Buffer.from([0,0,17,255,239]));
});
test('weapon controller preserves right-left order, bow pairing, harp shared hits and confusion',async()=>{
 const {data}=await input();
 for(let right=0;right<10;right++)for(let left=0;left<10;left++)for(const confused of [false,true])for(const hits of [[0,0],[1,2],[6,7],[241,242],[255,255]]){
  const expectedHits=confused?[0,0]:[...hits],bow=right===3&&left===8||right===8&&left===3,pairs=bow?[[right===3?0:1,3]]:[[0,right],[1,left]];
  if(bow||right===4||left===4)expectedHits[1]=expectedHits[0];
  const events=pairs.map(([hand,animation])=>{const limit=data[offset(0x33,0xa077+animation)];if(expectedHits[hand]>=limit)expectedHits[hand]=(limit-1)&255;return {hand,animation,hits:expectedHits[hand],target:data.readUInt16LE(offset(0x33,0xa080+animation*2))};});
  const actual=sourceWeaponSequence(data,{right,left,hits,confused});assert.deepEqual(actual.events,events);assert.deepEqual(actual.hits,expectedHits);
 }
});
test('monster pre-attack flash alternates eight uploads and excludes flare-wave ID',async()=>{
 const {data}=await input();for(let id=0;id<256;id++)for(const mask of [1,2,128,255]){const events=[];if(id!==9)for(let n=0;n<8;n++)events.push([n&1?'restore':'flash',mask],['upload']);assert.deepEqual(sourceMonsterFlash(data,id,mask).events,events);}
});
test('party hurt gate preserves misses and moves/restores cover actor around the hit',async()=>{
 const {data}=await input(),xy=[192,192,192,192,40,72,104,136];
 for(const hits of [[0,0],[1,0],[0,1],[255,255]])for(let cover=0;cover<5;cover++)for(let target=0;target<4;target++){
  const r=sourcePartyHurt(data,{hits,cover:cover?128>>(cover-1):0,target:128>>target});assert.deepEqual(r.xy,xy);assert.equal(r.events.filter(e=>e.kind==='hurt').length,+(!!(hits[0]|hits[1])));
  assert.deepEqual(r.events.map(e=>e.kind),['load-hurt',...(cover?['sprites']:[]),...((hits[0]|hits[1])?['hurt']:[]),...(cover?['sprites']:[])]);
  if(cover){const moved=[...xy];moved[cover-1]=168;moved[cover+3]=xy[target+4];assert.deepEqual(r.events[1].xy,moved);assert.deepEqual(r.events.at(-1).xy,xy);}
 }
});
