import test from 'node:test';
import assert from 'node:assert/strict';
import {input,hash} from '../tools/source.mjs';
import {offset} from '../tools/render-budget-source.mjs';
import {originalBattleFrames,battleCompositionAssets} from '../tools/battle-composition-assets.mjs';
import {compilePixelComposition,pixelCompositionPalettes} from '../tools/npc-composition.mjs';
test('original normal pose supplies opaque unscaled party and original large-hit script order',async()=>{
 const {data}=await input(),s=originalBattleFrames(data),a=battleCompositionAssets(data);
 assert.deepEqual(s.frames.map(f=>f.frame),[13,13,14,14,15,15]);assert.equal(s.frames.at(-1).magicObjects,36);
 assert.deepEqual(s.source.partyPaletteIds,[0,0,1,0]);assert.ok(s.party.every(q=>q.pixels.some(Boolean)));
 for(let i=0;i<4;i++){const q=s.party.slice(i*6,i*6+6);assert.equal(Math.min(...q.map(p=>p.y)),10+i*24);assert.equal(Math.max(...q.map(p=>p.y))+8,34+i*24);}
 assert.equal(a.jobs.length,80);assert.equal(a.palettes,7);assert.ok(a.frames.every(f=>f.stats.objects<=11&&f.stats.peak<=3));
 assert.equal(Math.max(...a.battle.comparison.map(f=>f.partialPlusPartyObjects)),32);
 assert.equal(hash(Buffer.concat(a.frames.map(f=>f.rgb))),'d6155e3dca897472d97a39cea53138fb4f2ab144e9509437effca4410a7eea14');
 assert.equal(a.battle.uniqueVisuals,3);assert.ok(a.blocks.length<=255*16);
 for(const f of a.frames){assert.equal(f.atlas.blocks.length,76);assert.equal(f.atlas.objects.length,f.stats.objects*16);assert.ok(f.stats.objects<=16);}
 for(const f of a.frames)for(const previous of [undefined,...a.frames]){
  const restored=previous?Buffer.from(previous.atlas.maps):Buffer.alloc(1216,165),at=(previous?.atlas.visual??a.battle.uniqueVisuals)*8;
  for(let bank=0;bank<2;bank++){const offset=f.atlas.spans.readUInt16LE(at+bank*4),bytes=f.atlas.spans.readUInt16LE(at+bank*4+2);assert.equal((offset|bytes)&15,0);assert.ok(offset+bytes<=608);f.atlas.maps.copy(restored,bank*608+offset,bank*608+offset,bank*608+offset+bytes);}
  assert.deepEqual(restored,f.atlas.maps);
 }
 const changed=Buffer.from(data);changed[offset(0x2f,0xb50c)]=0;
 assert.throws(()=>originalBattleFrames(changed),/Original normal party pose/);
});
test('pixel compiler rejects unsupported palette or geometry rather than truncating data',()=>{
 const p=Buffer.alloc(32);assert.throws(()=>compilePixelComposition(new Uint16Array(64),p,{width:7,height:8}),/dimensions/);
 assert.throws(()=>compilePixelComposition(new Uint16Array(64).fill(32768),p,{width:8,height:8}),/RGB555/);
 assert.throws(()=>pixelCompositionPalettes([],p),/dimensions/);
 assert.throws(()=>pixelCompositionPalettes([new Uint16Array(64)],p,{width:8,height:8,maxPalettes:9}),/budget/);
});
