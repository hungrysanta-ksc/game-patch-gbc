import {initializedBattle} from './battle-transition-source.mjs';
import {nativePartyTiles} from './battle-party-oam-source.mjs';
import {cgbPalette} from './field-source.mjs';import {numeralSeed,numeralAssets} from './battle-numerals-source.mjs';import {animationAssets} from './battle-animation-source.mjs';
// Immutable source resource loads, not animation frames. The native number
// body supplies values, decimal glyph IDs, frame counters and positions.
export function effectsAssets(rom,profiles){const seeds=[],anchors=[];let tiles,palette;
 for(const p of profiles){const {m}=initializedBattle(rom,{formation:p.formation,counts:p.counts,back:p.back,rows:[0,1,0,1],terrain:0,partyStatus:p.partyStatus}),c=m.c;
  seeds.push(numeralSeed({enemy:1,back:+p.back,values:Array(8).fill(65535),types:[...c.m.subarray(0x7da7,0x7daf)],center:Array.from({length:8},(_,i)=>c.m[0x7dd7+i*2]),bottom:[...c.m.subarray(0x7e07,0x7e0f)]}));
  const points=[];for(let i=0;i<8;i++){const x=Math.floor((c.m[0x7dd7+i*2]-16)*7/8),y=18+Math.floor((c.m[0x7e07+i]+1-48)*7/8);points.push(Math.max(0,Math.min(128,(p.back?159-x+8:x-8)-16)),y&255);}anchors.push(Buffer.from(points));
  c.banks=[0x32,0x33,0x3e,0x3f];c.m[0x7cf6]=0x19;c.a=13;m.call(0xbf1e);c.a=0xbe;m.call(0xa440);
  tiles=nativePartyTiles(m.ppu.bytes.subarray(0x1000,0x2000)).subarray(0x560,0x770);palette=cgbPalette(m.ppu.bytes.subarray(0x3f1c,0x3f20));
 }
 return {values:{seeds:Buffer.concat(seeds),anchors:Buffer.concat(anchors),tiles,palette},numberHeader:numeralAssets(rom).header,animationHeader:animationAssets(rom).header};
}
