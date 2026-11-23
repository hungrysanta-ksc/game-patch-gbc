import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {makeMapAssets,packMapAssets,mapSelection,convertTiles,kinds} from '../tools/map-assets.mjs';
test('all asset descriptors resolve to exact source-derived bytes without bank crossing',async()=>{
 const {data}=await input(),a=makeMapAssets(data,{verify:false}),p=packMapAssets(a);let count=0;
 for(const g of p.groups)for(let id=0;id<g.count;id++){const at=g.offset+id*5,bank=p.directory[at],off=p.directory.readUInt16LE(at+1),size=p.directory.readUInt16LE(at+3);assert.ok(bank>=16&&bank<p.romBanks&&off+size<=16384);assert.deepEqual(p.banks.get(bank).subarray(off,off+size),a.groups[g.kind][id]);count++;}assert.equal(count,1862);
});
test('map assets reject adjacent non-graphics data, empty assets, and oversized blocks',async()=>{
 const {data}=await input(),bad=Buffer.from(data);bad.writeUInt16LE(0x6c00,0xe10);assert.throws(()=>makeMapAssets(bad,{verify:false}),/Graphics pointer bounds/);
 const groups=Object.fromEntries(kinds.map(k=>[k,[]]));groups.properties=[Buffer.alloc(0)];assert.throws(()=>packMapAssets({groups}),/empty/);groups.properties=[Buffer.alloc(16385)];assert.throws(()=>packMapAssets({groups}),/exceeds/);
});
test('map selectors retain the mixed world-1 case and planar pixel ordering',()=>{
 assert.deepEqual(mapSelection(1,255),{property:511,selection:255});assert.deepEqual(mapSelection(2,255),{property:511,selection:511});assert.throws(()=>mapSelection(256,0),/range/);assert.throws(()=>mapSelection(0,-1),/range/);
 const nes=Buffer.alloc(16);nes[0]=0xaa;nes[8]=0xcc;const gb=convertTiles(nes);assert.deepEqual(Array.from({length:8},(_,x)=>((gb[0]>>(7-x))&1)|(((gb[1]>>(7-x))&1)<<1)),[3,2,1,0,3,2,1,0]);assert.throws(()=>convertTiles(Buffer.alloc(15)),/Tile length/);
});
