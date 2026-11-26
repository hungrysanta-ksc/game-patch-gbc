import {initializedBattle} from './battle-transition-source.mjs';
import {nativePartyTiles} from './battle-party-oam-source.mjs';
import {offset} from './render-budget-source.mjs';import {cgbPalette} from './field-source.mjs';
import {check} from './source.mjs';
// Inverse of residentEnemy's 7:8 sampling and its eight-pixel retreat.
// Keep the original target center, not the opaque silhouette's bounding box.
export function strikeAnchor(x,y,back=false){const gx=Math.floor((x-16)*7/8)-8,gy=16+Math.floor((y-48)*7/8);return [back?159-gx:gx,gy];}
// Union of every nonblank 32/991F slash glyph: normal [-24,24),
// mirrored [-23,25), vertical [-15,33). Fit the whole four-frame sweep
// once, not each frame separately; its original dots never get clipped.
export function strikeSliceAnchor(x,y,back=false){const [gx,gy]=strikeAnchor(x,y,back);return [Math.max(back?23:24,Math.min(back?135:136,gx)),Math.max(15,Math.min(111,gy))];}
// 32/98E0 draws a 16x16 impact around a random 0..31 offset. Project that
// offset to the enemy's 7:8 scale (0..27), but retain every effect pixel.
// Whole RNG-domain union: normal [-24,19), back [-18,25), y [-15,28).
export function strikeImpactAnchor(x,y,back=false){const [gx,gy]=strikeAnchor(x,y,back);return [Math.max(back?18:24,Math.min(back?135:141,gx)),Math.max(15,Math.min(116,gy))];}
export function strikeAssets(rom,profiles){
 const props=Buffer.from(rom.subarray(offset(0x2e,0x9098),offset(0x2e,0x91a0))),patterns=[],palettes=[],jobs=[],centers=[],impactCenters=[],restore=[],restorePal=[];
 const {m}=initializedBattle(rom,{formation:3,rows:[0,1,0,1],terrain:0}),c=m.c;
 for(let id=0;id<88;id++){
  c.m.set([id,0],0x7e1f);m.call(0xa8ea);
  check(c.m[0x7e1f]===props[id*3],'Weapon loader property');
  const p=nativePartyTiles(m.ppu.bytes.subarray(0x1490,0x1510));patterns.push(p);
  c.banks=[0x32,0x33,0x3e,0x3f];c.m[0x7cf6]=0x19;c.a=props[id*3+2];m.call(0xa440);palettes.push(cgbPalette(m.ppu.bytes.subarray(0x3f1c,0x3f20)));
  c.banks=[0x2e,0x2f,0x3e,0x3f];c.m[0x7cf6]=0x17;
 }
 for(let job=0;job<22;job++){c.m[0x7d8b]=job;c.x=0;m.call(0xa9cf);jobs.push(nativePartyTiles(m.ppu.bytes.subarray(0x1390,0x1490)));}
 for(const p of profiles){const {m}=initializedBattle(rom,{formation:p.formation,counts:p.counts,back:p.back,rows:[0,1,0,1],terrain:0,partyStatus:p.partyStatus});m.call(0xb469,6000000);m.call(0xb304);const c=m.c,points=[];
  for(let i=0;i<8;i++){const x=c.m[0x7dd7+i*2],y=c.m[0x7dd8+i*2];points.push(x,y,...strikeSliceAnchor(x,y,p.back));}
  impactCenters.push(Buffer.from(points.flatMap((_,i)=>i%4?[]:[points[i],points[i+1],...strikeImpactAnchor(points[i],points[i+1],p.back)])));
  centers.push(Buffer.from(points));restore.push(nativePartyTiles(m.ppu.bytes.subarray(0x1390,0x1590)));restorePal.push(cgbPalette(m.ppu.bytes.subarray(0x3f1c,0x3f20)));
 }
 return {props,patterns:Buffer.concat(patterns),palettes:Buffer.concat(palettes),jobs:Buffer.concat(jobs),centers:Buffer.concat(centers),impact_centers:Buffer.concat(impactCenters),restore:Buffer.concat(restore),restore_pal:Buffer.concat(restorePal)};
}
