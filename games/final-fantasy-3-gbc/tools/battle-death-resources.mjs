// 2F/B33E -> BB0A -> BB5E: the map is rebuilt from surviving slots before
// the 37-picture wipe. Pattern identity is NOT an enemy identity. All frame
// observations below are private verification oracles, never ROM movies.
import {initializedBattle} from './battle-transition-source.mjs';
import {cgbPalette} from './field-source.mjs';
import {residentEnemy} from './battle-resident-bg.mjs';
import {check,hash} from './source.mjs';

export function deathMachine(rom,options={}){
 const o={formation:3,back:false,rows:[0,1,0,1],terrain:8,partyStatus:[0,0,0,0],...options};
 const {m,f}=initializedBattle(rom,o);m.call(0xb469);m.call(0xb304);
 // Damage numerals precede script 0D's death consumer. Graphics 13 includes
 // the resident 61..63 black-mask glyphs; command-entry CHR is not that set.
 const c=m.c;c.banks=[0x32,0x33,0x3e,0x3f];c.m[0x7cf6]=0x19;c.a=13;m.call(0xbf1e);
 c.banks=[0x2e,0x2f,0x3e,0x3f];c.m[0x7cf6]=0x17;
 const p={...o,frames:[],initialPpu:Buffer.from(m.ppu.bytes),bgPalette:cgbPalette(c.m.subarray(0x7cf7,0x7d07))};
 if(o.formation===0)p.enemyYOffsets=[-4,-6];
 return {m,f,p};
}
export function sourceCoordinate(p,x,y){
 return [p.back?239-Math.floor((167-x+.5)*8/7):16+Math.floor((x+8+.5)*8/7),48+Math.floor((y+.5)*8/7)];
}
function index(b,x,y){
 const base=0x2000+(x>>8)*1024,xx=x&255,t=b[base+(y>>3)*32+(xx>>3)],at=t*16+(y&7),bit=7-(xx&7);
 return (b[at]>>bit&1)|((b[at+8]>>bit&1)<<1);
}
// A static spatial ownership map from the actual BAA2/BB13/A247 consumer.
// It is independent of tile deduplication, HP, animation frame or command.
export function deathOwnership(rom,options={}){
 const {m,p}=deathMachine(rom,options),c=m.c,types=Buffer.from(c.m.subarray(0x7da7,0x7daf)),maps=[];
 for(let slot=0;slot<8;slot++){
  c.m.set(types,0x7da7);c.m[0x7dca]=128>>slot;m.call(0xbaa2);m.call(0xbb13);m.call(0xa247);
  maps.push(Buffer.from(c.m.subarray(0x7900,0x7b00)));
 }
 const owner=Buffer.alloc(160*88),sourceY=Buffer.alloc(160*88),base=residentEnemy(p);
 for(let y=0;y<84;y++)for(let x=0;x<160;x++){
  const [sx,sy]=sourceCoordinate(p,x,y);if(!index(p.initialPpu,sx,sy))continue;
  const yy=y+(p.enemyYOffsets?.[y<42?0:1]??0),at=yy*160+x,key=((sy-40)>>3)*32+(sx>>3);
  const slots=maps.flatMap((map,i)=>types[i]!==255&&map[key]===0?[i]:[]);
  check(slots.length===1,'Exactly one source enemy owns a colored pixel '+JSON.stringify({options,x,y,sx,sy,slots}));
  check(!owner[at],'Source-to-native placement collision');owner[at]=128>>slots[0];sourceY[at]=sy;
 }
 for(let y=0;y<88;y++)for(let x=0;x<160;x++)check(!!owner[y*160+x]===!!base.words[y*448+x],'Ownership covers every visible enemy dot');
 const glyphs=Buffer.from(m.ppu.bytes.subarray(0x1610,0x1640));
 return {p,types,owner,sourceY,glyphs,base,maps,sha256:hash(Buffer.concat([owner,sourceY,glyphs]))};
}
// Publish boundary is BCB1, AFTER DMA and the PPU column write, not BC84.
// The previous kernel oracle at BC84 is valid for state, not visible pixels.
export function deathPictures(rom,options={},mask=128){
 const {m,p}=deathMachine(rom,options),c=m.c,frames=[],step=c.step.bind(c);
 c.step=function(){if(this.pc===0xbcb1)frames.push({x:Buffer.from(Array.from({length:13},(_,i)=>this.m[0x7342+i*2]&31)),ppu:Buffer.from(m.ppu.bytes),oam:Buffer.from(m.physicalOam),frame:37-this.m[0x90]});step();};
 c.a=mask;m.call(0xbb0a);check(frames.length===37,'Original death publication count');
 return {p,frames,types:Buffer.from(c.m.subarray(0x7da7,0x7daf)),remaining:c.m[0x7dd2],counts:Buffer.from(c.m.subarray(0x7dd3,0x7dd7))};
}
export function deathSourceVisible(frame,sx,sy){
 if(!index(frame.ppu,sx,sy))return false;
 // Only 25..63 are the black-mask owner. Party OAM is saved in 0..23.
 for(let i=25;i<64;i++){
  const [y,t,a,x]=frame.oam.subarray(i*4,i*4+4),dy=sy-y-1,dx=sx-x;
  if(dx<0||dx>=8||dy<0||dy>=8)continue;
  const xx=a&64?7-dx:dx,yy=a&128?7-dy:dy,at=0x1000+t*16+yy;
  if(((frame.ppu[at]|frame.ppu[at+8])>>(7-xx))&1)return false;
 }return true;
}
// Coordinate consumer used to audit a native cell-mask implementation. The
// eight original glyph rows are read from graphics 13, never hand-drawn.
export function deathPixelVisible(back,cursor,glyphs,sx,sy){
 const col=sx>>3;if(back?col<=cursor:col>=cursor)return false;
 const distance=back?col-cursor:cursor-col;
 if(distance>3)return true;
 const tile=3-distance,bit=back?(sx&7):7-(sx&7),at=tile*16+(sy&7);
 return !(((glyphs[at]|glyphs[at+8])>>bit)&1);
}

export function deathCells(a){
 const cells=[];
 for(let y=0;y<11;y++)for(let x=0;x<20;x++){
  const parts=new Map();
  for(let v=0;v<8;v++)for(let u=0;u<8;u++){
   const at=(y*8+v)*160+x*8+u,owner=a.owner[at];if(!owner)continue;
   if(!parts.has(owner))parts.set(owner,{owner,sy:Buffer.alloc(8),bits:Buffer.alloc(8)});
   const p=parts.get(owner),sy=a.sourceY[at];check(!p.bits[v]||p.sy[v]===sy,'One source row per slot/cell row');p.sy[v]=sy;p.bits[v]|=128>>u;
  }
  if(!parts.size)continue;check(parts.size<=2,'Registered mixed-cell owner capacity');
  const object=a.base.objects.find(o=>o.x===x*8&&o.y===16+y*8),key=y*56+x;
  cells.push({x,y,parts:[...parts.values()],tile:a.base.maps[key],attr:a.base.maps[616+key],object});
 }return cells;
}
export function deathBounds(a){
 const b=Buffer.alloc(208);for(let i=0;i<104;i++)b[i*2]=255;
 for(let y=0;y<88;y++)for(let x=0;x<160;x++){const at=y*160+x,owner=a.owner[at];if(!owner)continue;
  const slot=7-Math.log2(owner),row=(a.sourceY[at]-48)>>3,col=sourceCoordinate(a.p,x,0)[0]>>3,k=(slot*13+row)*2;
  b[k]=Math.min(b[k],col);b[k+1]=Math.max(b[k+1],col);
 }return b;
}
export function deathMayChange(bounds,back,x,previous,mask,first=false){
 for(let slot=0;slot<8;slot++)if(mask&(128>>slot))for(let row=0;row<13;row++){
  const at=(slot*13+row)*2,lo=bounds[at],hi=bounds[at+1],cursor=x[row],old=previous[row];if(lo===255)continue;
  if(first?(back?lo<=cursor+3:hi+3>=cursor):(cursor!==old&&(back?(old<=hi&&cursor+3>=lo):(old>=lo&&cursor<=hi+3))))return true;
 }return false;
}
// Static spatial stamps for every possible source tile column. These are
// projections of three ROM glyphs, not pictures indexed by animation time.
export function deathStamps(back,glyphs){
 const b=Buffer.alloc(32*8*20);
 for(let cursor=0;cursor<32;cursor++)for(let row=0;row<8;row++)for(let x=0;x<160;x++){
  const [sx]=sourceCoordinate({back},x,0);if(deathPixelVisible(back,cursor,glyphs,sx,48+row))b[(cursor*8+row)*20+(x>>3)]|=128>>(x&7);
 }return b;
}
export function deathCapacity(a,frames){
 const cells=deathCells(a),stamps=deathStamps(a.p.back,a.glyphs),slots=[...a.types.keys()].filter(i=>a.types[i]!==255);
 const combinations=Array.from({length:3**slots.length},(_,n)=>{const b=Array(8).fill(0);for(const slot of slots){b[slot]=n%3;n=n/3|0;}return b;});
 let peak=0,witness;
 for(const frame of frames){
  const sums=new Uint8Array(combinations.length);
  for(const cell of cells){
   const ids=[cell.tile,cell.object?.tile].filter(Boolean),partSlots=cell.parts.map(p=>7-Math.log2(p.owner)),costs=[];
   for(let code=0;code<3**cell.parts.length;code++){
    let n=code;const clear=Buffer.alloc(8);
    for(const p of cell.parts){const state=n%3;n=n/3|0;for(let y=0;y<8;y++)if(p.bits[y]){
     clear[y]|=p.bits[y]&(state===1?255:state===2?~stamps[(frame[65+((p.sy[y]-48)>>3)]*8+(p.sy[y]&7))*20+cell.x]:0);
    }}
    let count=0;for(const id of ids){const b=a.base.patterns.subarray(id*16,id*16+16);let changed=0,nonzero=0;
     for(let y=0;y<8;y++){const bits=b[y*2]|b[y*2+1];changed|=bits&clear[y];nonzero|=bits&~clear[y];}if(changed&&nonzero)count++;
    }costs.push(count);
   }
   for(let i=0;i<combinations.length;i++)sums[i]+=costs[combinations[i][partSlots[0]]+(partSlots.length===2?3*combinations[i][partSlots[1]]:0)];
  }
  const n=Math.max(...sums);if(n>peak){peak=n;witness={frame:frame[79],states:combinations[sums.indexOf(n)]};}
 }
 // A flash is never concurrent with the death owner. Only cells with more
 // than one slot can need partial patterns after removal; two layers is a
 // conservative bound, independent of each flash palette's decomposition.
 const flashBound=cells.filter(c=>c.parts.length>1).length*2;
 return {peak,flashBound,witness,combinations:combinations.length,pictures:frames.length};
}
