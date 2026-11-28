// Execute the source dispatcher/writer. This is an ownership audit, not a
// replacement renderer or evidence of native pure-stone integration.
import {check,hash} from './source.mjs';
import {offset} from './render-budget-source.mjs';
import {initializedBattle} from './battle-transition-source.mjs';
import {partyEntryOracle} from './battle-party-oam-source.mjs';
import {stoneAssets,stoneTop} from './battle-stone.mjs';
const word=(c,a)=>c.m[a]|c.m[a+1]<<8;
export function stoneDispatchAudit(rom){
 let cases=0,writes=0,deadStoneClears=0;const kinds=[0,0,0,0];
 for(const back of [false,true]){
  const {m}=initializedBattle(rom,{formation:3,back,terrain:8,rows:[0,0,0,0]}),c=m.c;
  for(let row=0;row<2;row++)for(let actor=0;actor<4;actor++)for(let status=0;status<256;status++){
   c.m[0x99]=status;c.m[0x7d8f+actor]=row;c.x=actor;m.call(0xb72b);
   const kind=(status&192)!==64?3:status&4?1:status&1?2:0;
   const ptr=kind===3?0xb82d:0xb7cd+kind*32+actor*8;
   const rows=rom[offset(0x2f,0xb7bb+actor)];
   const base=rom.readUInt16LE(offset(0x2f,0xb7bf+actor*2));
   const col=rom[offset(0x2f,0xb7c7+(back?3:0)+(status&8?2:row))];
   check(word(c,0x7dc7)===ptr,'Source stone/death precedence '+status.toString(16));
   check(word(c,0x7dc5)===base+col&&c.m[0x7dc9]===rows,'Source stone position');
   const expected=Buffer.from(m.ppu.bytes.subarray(0x2000,0x2800));
   for(let y=0;y<rows;y++)for(let x=0;x<2;x++)expected[base+col-0x2000+y*32+x]=rom[offset(0x2f,ptr+y*2+(x^(back?1:0)))];
   m.call(0xb6c8);
   check(expected.equals(m.ppu.bytes.subarray(0x2000,0x2800)),'Source exact stone writes and untouched map');
   cases++;kinds[kind]++;writes+=rows*2;if((status&192)===192){check(kind===3,'Death overrides stone');deadStoneClears++;}
  }
 }
 const begin=offset(0x2f,0xb6c8),end=offset(0x2f,0xb835);
 return {cases,writes,kinds,deadStoneClears,source:{bank:47,begin:0xb6c8,end:0xb835,sha256:hash(rom.subarray(begin,end))},scope:'Actual source B72B/B6C8; normalized status bytes, both rows/directions, all four actors. No raster/audio timing.'};
}
export function stoneGeometryAudit(rom){
 const glyphs=[];
 for(const back of [false,true]){
  const p=partyEntryOracle(rom,{back,terrain:8}),a=stoneAssets(rom,p);
  for(let actor=0;actor<4;actor++)for(let kind=0;kind<3;kind++){
   const id=actor*3+kind,g=a.glyphs.subarray(id*160,(id+1)*160);let ink=0,footerInk=0,minY=144,maxY=-1,cells=0;
   for(let cell=0;cell<10;cell++){
    if(g.subarray(cell*16,cell*16+16).some(Boolean))cells++;
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(((g[cell*16+y*2]|g[cell*16+y*2+1])>>(7-x))&1){
     const sy=stoneTop[actor]*8+(cell>>1)*8+y;ink++;minY=Math.min(minY,sy);maxY=Math.max(maxY,sy);if(sy>=104)footerInk++;
    }
   }
   glyphs.push({back,actor,kind,ink,cells,minY,maxY,footerInk,sha256:hash(g)});
  }
 }
 return {glyphs,uiStartsAtY:104,scope:'Immutable source stone glyph coverage at the existing V6 placement; no composed palette/residual-OBJ capacity claim.'};
}
export function deathPoolHeadroom(profiles){
 return profiles.map(p=>{const perPage=Math.max(p.peak,p.flashBound);return {profile:p.profile,pool:p.pool,perPage,remaining:256-p.pool-2*perPage};}).sort((a,b)=>a.remaining-b.remaining);
}
