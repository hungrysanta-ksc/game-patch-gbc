import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {magicFrameAssets,magicFrameReference,magicSequenceReference,magicBudgetAudit,magicPartySeed} from '../tools/battle-magic-frames.mjs';
test('128 source frames span both physical banks of pair 00 and preserve original slot density',async()=>{
 const {data}=await input(),a=magicFrameAssets(data),b=magicBudgetAudit(data);
 assert.equal(a.frames.length,128);assert.ok(a.locations.some(p=>p.pointer>=0xa000));
 assert.equal(a.source.sha256,'2758f00cd55087f96fc6e781999fb6dad65b4645b36f3c13667329910cdce414');
 assert.equal(b.maxObjects,36);assert.equal(b.maxRow,6);assert.equal(b.overSixteen,25);
 assert.equal(b.magicDispatch.length,19);assert.equal(b.summonDispatch.length,24);
 assert.ok(b.maxObjects+b.partyReservation>b.gbcObjectLimit);
});
test('invalid repeat counts fail at compilation instead of overrunning the frame buffer',async()=>{
 const {data}=await input(),a=magicFrameAssets(data),at=a.locations[0].offset;
 for(const count of [0,37,255]){const changed=Buffer.from(data);changed[at]=128;changed[at+1]=count;assert.throws(()=>magicFrameAssets(changed),/Magic RLE capacity/);}
});
test('enemy-target priority swaps are temporary and four waits hold exactly the same OAM',async()=>{
 const {data}=await input();
 for(const enemy of [0,1])for(const back of [0,1])for(const vertical of [0,1]){
  const r=magicFrameReference(data,{code:11,vertical,enemy,back,x:88,y:80,properties:32,magic:5});
  assert.deepEqual(r.restored.subarray(160),magicPartySeed());
  if(enemy){assert.deepEqual(r.visible.subarray(0,96),magicPartySeed());assert.deepEqual(r.visible.subarray(160),r.restored.subarray(0,96));}
  else assert.deepEqual(r.visible,r.restored);
 }
});
test('all 88 sequence programs use prefix decoding and four waits per picture plus one cleanup',async()=>{
 const {data}=await input(),a=magicFrameAssets(data);let prefixes=0;const ids=new Set();
 for(let spell=0;spell<88;spell++){
  const r=magicSequenceReference(data,spell),p=a.sequences[spell];let i=1;
  for(const e of r.events){const vertical=p[i]===255?1:0;if(vertical){i++;prefixes++;}assert.equal(e.code,p[i++]);assert.equal(e.vertical,vertical);assert.equal(e.index,i);ids.add(e.code&127);}
  assert.equal(i,p[0]+1);assert.equal(r.waits,r.events.length*4);assert.equal(r.cleanup,1);assert.equal(r.soundPending,1);
 }
 assert.ok(prefixes>0);assert.equal(ids.size,128);
});
