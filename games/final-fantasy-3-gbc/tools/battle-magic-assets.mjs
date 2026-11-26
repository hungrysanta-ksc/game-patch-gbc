import {initializedBattle} from './battle-transition-source.mjs';
import {nativePartyTiles} from './battle-party-oam-source.mjs';
import {cgbPalette} from './field-source.mjs';
import {magicFrameAssets,magicFrameReference} from './battle-magic-frames.mjs';
import {check} from './source.mjs';
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
// Geometry-free tile dictionary. Original RLE/sequence execution still chooses
// cells, coordinates, target order and holds at runtime; no scene/OAM movies.
export function magicResidentAssets(rom,original=magicAssets(rom)){
 const source=magicFrameAssets(rom),templates=new Map(),records=[],banks=[];let chunks=[],used=0;
 for(let spell=0;spell<88;spell++){
  const program=source.sequences[spell],reachable=[];for(let i=1;i<program.length;){let code=program[i++];if(code===255)code=program[i++];reachable.push(code&127);}
  const codes=[...new Set(reachable)],patterns=[],lookup=new Map(),frames=[];
  for(const code of codes){
   if(!templates.has(code))templates.set(code,magicFrameReference(rom,{code,vertical:0,enemy:0,back:0,x:80,y:80,properties:0,magic:0}).template);
   const o=templates.get(code),row=[code];
   for(let pair=0;pair<18;pair++){
    const bytes=Buffer.alloc(32),cell=Math.floor(pair/6)*12+pair%6;
    for(let half=0;half<2;half++){const at=(cell+half*6)*4,t=o[at+1],flags=o[at+2];if(!t)continue;
     const tile=original.records[spell].subarray((t-73)*16,(t-72)*16);
     for(let y=0;y<8;y++)for(let x=0;x<8;x++){const sy=flags&128?7-y:y,bit=flags&64?x:7-x;for(let plane=0;plane<2;plane++)bytes[half*16+y*2+plane]|=((tile[sy*2+plane]>>bit)&1)<<(7-x);}
    }
    if(!bytes.some(v=>v)){row.push(255);continue;}
    const key=bytes.toString('hex');if(!lookup.has(key)){lookup.set(key,patterns.length);patterns.push(bytes);}row.push(lookup.get(key));
   }frames.push(Buffer.from(row));
  }
  check(patterns.length<=32,'Resident magic pool capacity');
  const prefix=Buffer.concat([original.records[spell].subarray(512,521),Buffer.from([frames.length]),...frames]),offset=(prefix.length+15)&~15;
  const bytes=Buffer.concat([prefix,Buffer.alloc(offset-prefix.length),...patterns]);check(!(bytes.length&15),'Resident record alignment');
  if(used+bytes.length>16384){banks.push(Buffer.concat(chunks));chunks=[];used=0;}
  records.push({spell,bank:66+banks.length,offset:used,patterns:used+offset,bytes:patterns.length*32,frames:codes.length});chunks.push(bytes);used+=bytes.length;
 }
 banks.push(Buffer.concat(chunks));check(banks.length<=4,'Resident magic bank reservation');
 const header='#include <stdint.h>\ntypedef struct {const uint8_t *data,*patterns;uint16_t bytes;uint8_t bank;} MagicAsset;\n'+banks.map((_,i)=>'extern const uint8_t magic_resources'+i+'[];').join('\n')+'\nstatic const MagicAsset magic_assets[]={'+records.map(r=>'{magic_resources'+(r.bank-66)+'+'+r.offset+',magic_resources'+(r.bank-66)+'+'+r.patterns+','+r.bytes+','+r.bank+'}').join(',')+'};\n';
 return {banks,records,header,source:'33/B589 loads 07/08 once; B711 selects resident cells. Lossless 8x16 dictionary, shared whole-pair flips, no runtime frame pixels.'};
}
