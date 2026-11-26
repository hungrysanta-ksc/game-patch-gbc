import {initializedBattle} from './battle-transition-source.mjs';
import {nativePartyTiles} from './battle-party-oam-source.mjs';
import {cgbPalette} from './field-source.mjs';
import {magicFrameAssets} from './battle-magic-frames.mjs';
// Immutable graphics requests 07/08 and palette, not composed animation frames.
export function magicAssets(rom){
 const a=magicFrameAssets(rom),{m}=initializedBattle(rom,{formation:3,rows:[0,1,0,1],terrain:0}),c=m.c,records=[];
 c.banks=[0x32,0x33,0x3e,0x3f];c.m[0x7cf6]=0x19;
 for(let spell=0;spell<88;spell++){
  c.m[0x7e88]=spell;m.call(0xaf6f);m.call(0xb589);c.a=c.m[0x7e8d];m.call(0xa440);
  records.push(Buffer.concat([nativePartyTiles(m.ppu.bytes.subarray(0x1490,0x1690)),cgbPalette(m.ppu.bytes.subarray(0x3f1c,0x3f20)),a.properties.subarray(spell*3,spell*3+3)]));
 }
 return {records,header:a.header,source:{...a.source,graphics:'33/B589 requests 07/08; PPU 1490..1690 after both loads',palette:'33/A440 using 7E8D; PPU 3F1C..3F20',recordBytes:523}};
}
