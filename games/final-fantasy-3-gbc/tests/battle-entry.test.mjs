import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {entryAssets,entryReference} from '../tools/battle-entry-source.mjs';
test('entry writes only four resident terrain tiles per fade wait, never monster CHR',async()=>{
 const {data}=await input(),assets=entryAssets(data),mask=assets.tables.find(t=>t.name==='masks').bytes;
 for(const back of [false,true]){
  const r=entryReference(data,{back});assert.equal(r.frames.length,30);
  const ranges=r.frames.flatMap(f=>f.ranges),chr=ranges.filter(r=>r.begin<0x2000);
  assert.equal(chr.reduce((n,r)=>n+r.writes,0),1792);assert.ok(chr.every(r=>r.begin>=0x600&&r.end<=0x700&&r.writes===64&&r.writer===0xadfb));
  assert.ok(!ranges.some(r=>r.begin>=0x2000&&r.begin<0x3f00));
  for(const f of r.frames.filter(f=>f.upload))assert.deepEqual(f.upload,Buffer.from(r.terrain.subarray(f.state[37]*64,f.state[37]*64+64)).map((v,i)=>v&mask[f.state[36]*8+(i&7)]));
  assert.equal(r.tail[35],4);assert.equal(r.tail[34],29);
 }
});
test('mini keeps its longer original movement; dead/stone do not walk; toad keeps Y motion',async()=>{
 const {data}=await input();
 for(const back of [false,true]){
  const r=entryReference(data,{back,rows:[0,0,0,0],normalized:[1,128,64,4]});
  assert.equal(r.frames.length,back?30:33); // F0 -> D0 is 32 one-pixel steps.
  for(const f of r.frames){assert.equal(f.state[14],f.state[22]);assert.equal(f.state[15],f.state[23]);assert.equal(f.state[26],0);assert.equal(f.state[27],0);}
  assert.ok(new Set(r.frames.map(f=>f.state[20])).size>1);
 }
});
test('entry tables retain source provenance and remain independent of fixture frames',async()=>{
 const {data}=await input(),a=entryAssets(data);assert.equal(a.tables.reduce((n,t)=>n+t.size,0),92);
 for(const t of a.tables){assert.ok(t.consumer&&t.asmRef&&t.sha256.length===64);assert.deepEqual(t.bytes,data.subarray(t.begin,t.begin+t.size));}
});
