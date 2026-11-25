import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {partyOamTables,partyEntryOracle,partyOamCases,v6PartyOam,partyRgb,nativePartyTiles} from '../tools/battle-party-oam-source.mjs';
test('original party shape pointers and 21 poses are extracted from their actual consumers',async()=>{
 const {data}=await input(),t=partyOamTables(data);assert.deepEqual(t.tables.map(t=>t.size),[144,42,4,126]);
 const cases=partyOamCases(data);assert.equal(cases.length,848);assert.ok(cases.every(c=>c.original.length===96&&c.native.length===96));
});
test('entry keeps reset-hidden OAM for two waits before publishing moving party poses',async()=>{
 const {data}=await input();for(const back of [false,true])for(const partyStatus of [[0,0,0,0],[128,64,32,8]]){
  const p=partyEntryOracle(data,{back,partyStatus}),tiles=nativePartyTiles(p.chr);
  assert.ok(p.frames[0].original.equals(Buffer.alloc(96,0xf0)));assert.ok(p.frames[1].original.equals(p.frames[0].original));assert.ok(!p.frames[2].original.equals(p.frames[0].original));
  assert.ok(p.pal.some(Boolean));assert.ok(p.frames.slice(2).every(f=>f.palette.equals(p.pal)));
  assert.ok(partyRgb(v6PartyOam(p.frames.at(-1).original,back),tiles,p.pal).rgb.some(Boolean));
  for(const f of p.frames){const v=partyRgb(v6PartyOam(f.original,back),tiles,p.pal);assert.ok(v.peak<=10);}
 }
});
test('native OBJ conversion hides offscreen source objects by Y, preserving visible flips and pixels',()=>{
 const source=Buffer.alloc(96,0xf0);source.set([43,1,0xc2,208],0);const out=v6PartyOam(source,false);
 assert.deepEqual([...out.subarray(0,4)],[26,136,1,0x62]);assert.equal(out[4],0);
 const bad=Buffer.from(source);bad[2]|=32;assert.throws(()=>v6PartyOam(bad,false),/attributes/);
});
