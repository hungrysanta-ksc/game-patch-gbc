// 2F/B5C3 -> B72B -> B6C8 owns the stone map, not the OBJ palette.
// Evidence for the current renderer's next integration step. These functions
// are reference/asset checks; they do not enable the native pure-stone route.
import {check,hash} from './source.mjs';
import {partyEntryOracle} from './battle-party-oam-source.mjs';
import {stoneAssets,stoneTop} from './battle-stone.mjs';
import {initializedBattle} from './battle-transition-source.mjs';

function value(tile,x,y){return (tile[y*2]>>(7-x)&1)|((tile[y*2+1]>>(7-x)&1)<<1);}
function put(tile,x,y,v){const bit=128>>x;tile[y*2]=(tile[y*2]&~bit)|((v&1)?bit:0);tile[y*2+1]=(tile[y*2+1]&~bit)|((v&2)?bit:0);}

// Independent per-pixel oracle for the native two-plane paint kernel.
// Ownership is explicit: zero in a selected source pixel clears that pixel.
// An ink mask is appropriate for overlays; FF fills a source-owned rectangle.
export function paintCell(base,source,mask){
 check(base.length===16&&source.length===16&&mask.length===8,'Cell paint ABI');
 const out=Buffer.from(base);
 for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(mask[y]&(128>>x))put(out,x,y,value(source,x,y));
 const changed=!out.equals(base);return {glyph:out,result:changed?(out.some(Boolean)?2:1):0};
}

export function sourceStonePaletteCells(rom,back){
 const {m}=initializedBattle(rom,{formation:3,back,terrain:8,rows:[0,1,0,1],partyStatus:[64,64,64,64]});m.call(0xb469);
 const c=m.c;let inkCells=0;
 for(let actor=0;actor<4;actor++)for(const status of [64,65,68,72,73,76])for(const row of [0,1]){
  c.m[0x99]=status;c.m[0x7d8f+actor]=row;c.x=actor;m.call(0xb72b);
  const at=c.m[0x7dc5]|c.m[0x7dc6]<<8,n=c.m[0x7dc9];m.call(0xb6c8);
  for(let y=0;y<n;y++)for(let x=0;x<2;x++){
   const address=at+y*32+x,t=m.ppu.bytes[address],tx=address&31,ty=(address&1023)>>5;
   if(!m.ppu.bytes.subarray(t*16,t*16+16).some(Boolean))continue;
   const attr=m.ppu.bytes[(address&0xfc00)+960+(ty>>2)*8+(tx>>2)],pal=attr>>((ty&2)*2+(tx&2))&3;
   check(pal===3,'Actual source stone ink palette');inkCells++;
  }
 }
 return inkCells;
}
export function stoneSurfaces(rom){return [false,true].map(back=>{
 const p=partyEntryOracle(rom,{back,terrain:8}),a=stoneAssets(rom,p);
 const unique=[...new Map(Array.from({length:120},(_,i)=>a.glyphs.subarray(i*16,i*16+16)).filter(g=>g.some(Boolean)).map(g=>[g.toString('hex'),g])).values()];
 return {back,...a,palette:Buffer.from(p.bgPalette.subarray(24,32)),sourceInkCells:sourceStonePaletteCells(rom,back),unique};
});}

export function stoneSurfaceContract(surfaces,ui){
 check(ui.palette.length===8&&ui.rect.length===36,'Live UI surface ABI');
 for(const s of surfaces)check(s.palette.equals(ui.palette),'Stone and live UI palette bytes must agree');
 for(let i=0;i<6;i++)check(ui.rect[i*6+1]>=2,'Live UI frame must start below stone feet');
 const views=[ui.initial,...ui.cases.filter(c=>c.pixels).map(c=>Buffer.from(c.pixels,'hex'))].map(v=>{
  // The UI oracle marks unowned pixels with FF; render() initializes the
  // corresponding native tile bytes to zero. Do not treat FF as a color.
  check(v.length===160*40&&v.subarray(0,320).every(x=>x===255),'Live UI first two rows must remain blank');
  const out=Buffer.from(v);out.fill(0,0,320);return out;
 });
 const boundaries=[];let footerCases=0,footerInk=0;
 for(const s of surfaces)for(let actor=0;actor<4;actor++)for(let kind=0;kind<3;kind++){
  const g=s.glyphs.subarray((actor*3+kind)*160,(actor*3+kind+1)*160);let head=0,body=0,foot=0;
  for(let cell=0;cell<10;cell++)for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(value(g.subarray(cell*16,cell*16+16),x,y)){
   const sy=stoneTop[actor]*8+(cell>>1)*8+y;
   if(sy<16){check(sy>=11,'Stone ink must not overlap the terrain pixels');head++;}
   else if(sy<104)body++;
   else{check(sy<106,'Stone feet must not cover live UI frame/text');foot++;}
  }
  boundaries.push({back:s.back,actor,kind,head,body,foot});
  if(foot)for(const col of s.back?[0,2,6]:[16,18,12])for(const view of views){
   const out=Buffer.from(view);let n=0;
   for(let x=0;x<16;x++)for(let y=0;y<2;y++){
    const v=value(g.subarray((6+(x>>3))*16,(7+(x>>3))*16),x&7,y);
    if(v){const at=y*160+col*8+x;check(view[at]===0,'Stone/UI live content collision');out[at]=v;n++;}
   }
   check(n===foot&&out.subarray(320).equals(view.subarray(320)),'Whole feet and untouched live UI');footerCases++;footerInk+=n;
  }
 }
 // Current bank-0 UI owns 112..211; numerals own 223..255. Forty
 // immutable glyphs per facing do NOT fit the eleven intervening slots.
 // Do not turn a palette success into an unproven VRAM reservation.
 return {paletteSha256:hash(ui.palette),paletteCount:1,additionalPalettes:0,sourceInkCells:surfaces.reduce((n,s)=>n+s.sourceInkCells,0),views:views.length,footerCases,footerInk,boundaries,
  patterns:surfaces.map(s=>({back:s.back,unique:s.unique.length,bytes:s.unique.length*16})),
  bank0:{ui:[112,212],numerals:[223,256],free:[212,223],fitsImmutableStone:surfaces.every(s=>s.unique.length<=11)},
  scope:'Source glyphs/palette plus every generated live UI view; exact boundary pixels. Not a native stone/death/magic coexistence or capacity proof.'};
}

export function stonePaintExamples(surfaces){const rows=[],seen=new Set();
 for(const s of surfaces)for(const source of s.unique){const key=source.toString('hex');if(seen.has(key))continue;seen.add(key);
  // Every ink bit and every source-owned zero is independently compared.
  // Both planes of the background are deliberately occupied, so OR-only,
  // plane-swapping, stale-byte and black-as-transparent implementations fail.
  for(const full of [false,true]){const base=Buffer.from([255,85,170,255,85,170,240,15,15,240,204,51,51,204,255,255]),mask=Buffer.from(Array.from({length:8},(_,y)=>full?255:source[y*2]|source[y*2+1]));
   const expected=paintCell(base,source,mask);rows.push({base,source,mask,...expected});
  }
 }return rows;
}
