import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {partyEntryOracle} from '../tools/battle-party-oam-source.mjs';
import {residentEnemy,residentScroll,residentRgb,originalResidentRgb,residentMap,residentOam} from '../tools/battle-resident-bg.mjs';
test('resident 7:8 enemy plane matches original entry in both directions and mixed party states',async()=>{
 const {data}=await input();let frames=0;
 for(const back of [false,true])for(const partyStatus of [[0,0,0,0],[128,64,32,8]]){
  const p=partyEntryOracle(data,{back,partyStatus}),a=residentEnemy(p);
  assert.equal(a.patterns.length,130*16);assert.equal(a.maps.length,56*11*2);assert.equal(a.objects.length,6);
  for(const f of p.frames){assert.ok(residentRgb(p,f,a).equals(originalResidentRgb(p,f)));assert.equal(residentOam(p,f,a).length,160);frames++;}
  // Prove the compiler owns immutable source assets, not future observations.
  const empty=residentEnemy({...p,frames:[]});assert.ok(empty.patterns.equals(a.patterns));assert.ok(empty.maps.equals(a.maps));assert.ok(empty.residual.equals(a.residual));
 }
 assert.equal(frames,123);
});
test('spatial map wraps 448 pixels independently of GBC 256-pixel ring and preserves clipped edge objects',async()=>{
 const {data}=await input(),p=partyEntryOracle(data),a=residentEnemy(p);
 for(let scroll=0;scroll<448;scroll+=2){const map=residentMap(a,scroll),coarse=scroll>>3;
  for(let y=0;y<11;y++)for(let x=0;x<21;x++){const from=y*56+(coarse+x)%56,to=y*32+((coarse+x)&31);assert.equal(map[to],a.maps[from]);assert.equal(map[352+to],a.maps[616+from]);}
 }
 assert.ok(p.frames.some(f=>{const o=residentOam(p,f,a);return Array.from({length:16},(_,i)=>o[96+i*4+1]).some(x=>x>0&&x<8);}));
 const bad=Buffer.from(p.frames[1].state);bad[29]|=1;assert.throws(()=>residentScroll(bad),/granularity/);
 const changed={...p,frames:[{...p.frames[1],ppu:Buffer.from(p.frames[1].ppu)}]};changed.frames[0].ppu[0x700]^=1;assert.throws(()=>residentEnemy(changed),/resource changed/);
});
