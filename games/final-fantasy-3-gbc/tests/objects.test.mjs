import test from 'node:test';
import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {makeMapAssets,packMapAssets} from '../tools/map-assets.mjs';
import {placement,makeObjectAssets,objectKinds,sourceObjects} from '../tools/object-assets.mjs';
import {objectReference} from '../tools/object-reference.mjs';
let cached;async function context(){if(!cached){const {data}=await input();cached={data,assets:makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false})};}return cached;}
test('NPC list end cannot enter adjacent script data; every map refers to a valid list',async()=>{
 const {data,assets}=await context();assert.equal(assets.groups.placements.length,197);assert.equal(assets.unresolved.length,59);
 for(let id=197;id<256;id++)assert.throws(()=>placement(data,id),/outside region/);
 for(const p of assets.groups.properties)assert.ok(p[4]<197);
 const corrupt=Buffer.from(data);corrupt.writeUInt16LE(0x1943,0x58010);assert.throws(()=>placement(corrupt,0),/outside region/);
});
test('extended object directory preserves source payloads, old group IDs and bank boundaries',async()=>{
 const {assets}=await context(),pack=packMapAssets(assets,objectKinds);let count=0;
 for(const g of pack.groups)for(let id=0;id<g.count;id++){
  const at=g.offset+id*5,b=pack.directory[at],off=pack.directory.readUInt16LE(at+1),size=pack.directory.readUInt16LE(at+3);
  assert.ok(off+size<=16384);assert.deepEqual(pack.banks.get(b).subarray(off,off+size),assets.groups[g.kind][id]);count++;
 }assert.equal(count,2691);assert.equal(pack.groups[9].kind,'placements');
});
test('original loader hides objects without erasing their identity and preserves reserved part-2 bytes',async()=>{
 const {data,assets}=await context();const hidden=sourceObjects(data,assets,0,2,Buffer.alloc(64)),visible=sourceObjects(data,assets,0,2,Buffer.alloc(64,255));
 assert.ok(visible.part1.some((v,i)=>i%16===0&&v));
 for(let i=0;i<12;i++){
  assert.equal(hidden.part1[i*16],0);assert.equal(hidden.part1[i*16+10],visible.part1[i*16+10]);
  for(const j of [4,7,8,9,10,11,12,13,14,15])assert.equal(hidden.part2[i*16+j],165);
 }
});
test('real dense placement examples are reported as hardware budget failures, never silently dropped',async()=>{
 const {data,assets}=await context();
 const total=objectReference(data,assets,{world:1,map:86,x:12,y:0,flags:2,phase:0});assert.equal(total.entries,48);assert.equal(total.error,12);assert.ok(total.oam.every(v=>v===0));
 const line=objectReference(data,assets,{world:0,map:139,x:0,y:42,flags:2,phase:0});assert.equal(line.peak,12);assert.equal(line.error,13);
});
