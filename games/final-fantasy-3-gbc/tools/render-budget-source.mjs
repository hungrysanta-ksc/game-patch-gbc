// Planning evidence from original ROM consumers. No gameplay or renderer policy changes.
import {check,hash} from './source.mjs';
import {Driver6502} from './driver6502.mjs';
import {segment} from './state-source.mjs';
import {sourceObjects} from './object-assets.mjs';
import {mapSelection} from './map-assets.mjs';
import {decodeEvent,conditional} from './registry-core.mjs';
import {cgbPalette} from './field-source.mjs';
export const offset=(bank,cpu)=>16+bank*8192+(cpu&8191);
const pairOffset=(pair,cpu)=>16+pair*16384+(cpu&16383);
const word=(c,a)=>c.m[a]|c.m[a+1]<<8;
function battleCpu(rom){const c=new Driver6502(rom);c.banks=[0x2e,0x2f,0x3e,0x3f];return c;}
export function tilePixels(bytes){check(bytes.length%16===0,'Whole NES tiles');return Array.from({length:bytes.length/16},(_,t)=>Uint8Array.from({length:64},(_,i)=>((bytes[t*16+(i>>3)]>>(7-(i&7)))&1)|(((bytes[t*16+(i>>3)+8]>>(7-(i&7)))&1)<<1)));}
export function monsterGraphic(rom,id,{externalTiles}={}){
 check(id>=0&&id<255,'Monster ID');const property=rom[0x5cb10+id],type=property>>5,index=property&31;
 const c=battleCpu(rom);c.m[0x7d73]=property;c.x=0;
 let begin,bytes,w,h,map,flip=false,attrBegin,attrBytes;
 if(type<6){
  const counts=[16,24,24,24,4,4];if(index>=counts[type])return {id,type,index,unresolved:{kind:'reserved-graphics-index'}};
  segment(c,0xa42e,0xf942);begin=pairOffset(c.m[0x84],word(c,0x7e));bytes=c.m[0x82]*16;
  w=rom[offset(0x2f,0xa4cc)+type*2];h=rom[offset(0x2f,0xa4cd)+type*2];check(bytes===w*h*16,'Original graphics transfer size');
  const bases=[0x40010,0x41010,0x44010,0x48010,0x4c010,0x4d210];check(begin===bases[type]+index*bytes,'Original graphics address');
  const attr=[0x5cf30,0x5cf30+16,0x5cf58,0x5cf58+48,0x5cfb8,0x5cfc4];attrBytes=[1,1,2,2,3,3][type];attrBegin=attr[type]+index*attrBytes;
 }else{
  if(index>=24)return {id,type,index,unresolved:{kind:'reserved-boss-index'}};c.call(0xa3b8);begin=pairOffset(c.m[0x84],word(c,0x7e));bytes=c.m[0x82]*16;w=18;h=12;
  const ptr=rom.readUInt16LE(0x5d078+index*2),expected=(ptr&0x2000?0x18010:0x40010+((ptr>>14)&3)*0x4000)+(ptr&0x3ff)*16;
  check(begin===expected&&bytes===0x900,'Original boss loader pointer/size');map=rom.subarray(0x54010+index*216,0x54010+(index+1)*216);flip=!!(ptr&0x1000);attrBegin=0x5cfd0+index*7;attrBytes=7;
 }
 check(begin>=16&&begin+bytes<=rom.length,'Graphics source range');const gfx=tilePixels(rom.subarray(begin,begin+bytes));
 const foreign=map?[...new Set(map)].filter(t=>t!==0&&t<0x70):[];
 if(foreign.some(t=>!externalTiles?.has(t)))return {id,type,index,w,h,source:{begin,bytes,attrBegin,attrBytes},unresolved:{kind:'boss-external-tile',tiles:foreign}};
 for(const t of foreign)check(externalTiles.get(t).length===64,'External tile pixel count');
 const tiles=map?Array.from(map,t=>t===0?new Uint8Array(64):t<0x70?externalTiles.get(t):gfx[t-0x70]):gfx;check(tiles.every(Boolean),'Boss source tile bounds');
 if(flip)for(let i=0;i<tiles.length;i++)tiles[i]=Uint8Array.from({length:64},(_,p)=>tiles[i][(p&~7)+7-(p&7)]);
 // A143 never stores its OR result. A07F consumes $7F, so the bitmap does
 // not invert palettes on this path. Preserve the original missing store.
 const inverse=0;
 const attrs=Uint8Array.from({length:w*h},(_,t)=>{const x=t%w,y=Math.floor(t/w)+(type===0?2:0),bit=Math.floor(y/2)*(w/2)+Math.floor(x/2);return ((rom[attrBegin+(bit>>3)]>>(7-(bit&7)))&1)^inverse;});
 // Execute the original attribute selector, loader and bit consumer independently.
 const ac=battleCpu(rom);ac.a=id;ac.call(0xa0e7);check(ac.m[0x7e]===property&&((ac.m[0x7f]>>7)&1)===inverse,'Original monster attribute selector');
 ac.m[0x7d6b]=id;ac.m[0x7d73]=property;ac.m[0x7d74]=ac.m[0x7f];ac.x=0;ac.call(type>=6?0xa820:0xa86c);
 check(offset(0x2e,word(ac,0x7e))===attrBegin,'Original attribute source address');
 ac.m[0x1a]=0;ac.m[0x1b]=0;const bits=[];for(let i=0;i<w*h/4+(type===0?2:0);i++){ac.call(0xa6fb);bits.push(ac.a);}
 for(let t=0;t<attrs.length;t++){const x=t%w,y=Math.floor(t/w)+(type===0?2:0);check(attrs[t]===bits[Math.floor(y/2)*(w/2)+Math.floor(x/2)],'Original palette bit consumer');}
 return {id,type,index,w,h,tiles,attrs,source:{begin,bytes,attrBegin,attrBytes,sha256:hash(rom.subarray(begin,begin+bytes))}};
}
export function battleInventory(rom){
 const formations=[],graphicIds=new Set(),layouts={};let originalComparisons=0;
 for(let id=0;id<512;id++){
  const c=battleCpu(rom);c.m[0x7ced]=id&255;c.m[0x7cee]=id>>8;segment(c,0xa02a,0xa0b7);
  const set=rom[0x5c010+id*2],flags=rom[0x5c011+id*2],group=rom.subarray(0x5c410+set*6,0x5c416+set*6),range=rom.subarray(0x5ca10+(flags&63)*4,0x5ca14+(flags&63)*4);
  check(Buffer.from(c.m.subarray(0x7d69,0x7d6f)).equals(group)&&Buffer.from(c.m.subarray(0x7d6f,0x7d73)).equals(range),'Original formation consumer '+id);originalComparisons++;
  const slots=Array.from({length:4},(_,i)=>({id:group[i+2],min:range[i]>>4,max:range[i]&15}));
  for(const s of slots)if(s.id!==255&&s.max)graphicIds.add(s.id);
  // Upper-count diagnostic, not a reachable RNG sequence or a normal battle claim.
  for(let i=0;i<4;i++)c.m[0x7d6f+i]=slots[i].max;c.call(0x9faa);const layout=c.m[0x7d7b];check(layout<10,'Original formation layout');
  c.m.fill(0xa5,0x7da7,0x7dc0);c.call(0xa31f);
  const active=Array.from(c.m.subarray(0x7da7,0x7daf)),maxCount=slots.reduce((n,s)=>n+(s.id===255?0:s.max),0);
  const key=String(layout);layouts[key]=(layouts[key]||0)+1;
  formations.push({id,set,flags,palettes:[group[0],group[1]],slots,layout,active,maxCount,scope:'table slot and upper-count diagnostic; story/RNG reachability unproven'});
 }
 const graphics=[];for(const id of [...graphicIds].sort((a,b)=>a-b)){graphics.push(monsterGraphic(rom,id));originalComparisons++;}
 // Exact transfer/table consumers; counts are table capacity, not simultaneous assets.
 const misc=[];for(let id=0;id<14;id++){const p=offset(0x2f,0xa15f)+id*6;misc.push({id,source:rom.readUInt16LE(p),ppu:rom.readUInt16LE(p+2),length:rom[p+4],lengthUnit:id===0?'tilemap rows':'16-byte tiles',bankPair:rom[p+5],tableOffset:p});}
 const weapons=[];for(let id=0;id<88;id++){const p=0x5d0a8+id*3,c=battleCpu(rom);c.m[0x7e1f]=id;segment(c,0xa8ea,0xa90f);check(c.m[0x7e1f]===rom[p]&&c.m[0x7e13]===rom[p+1]&&c.m[0x7e14]===rom[p+2],'Original weapon graphics selector');weapons.push({id,animation:rom[p],graphic:rom[p+1],palette:rom[p+2]});originalComparisons++;}
 const magic=[];for(let id=0;id<96;id++){const p=0x5d1e0+id*3,c=battleCpu(rom);c.banks[0]=0x32;c.banks[1]=0x33;c.m[0x7cf6]=0x19;c.m[0x7e88]=id;c.call(0xaf6f);check(Buffer.from(c.m.subarray(0x7e8b,0x7e8e)).equals(rom.subarray(p,p+3)),'Original magic graphics selector');magic.push({id,raw:[...rom.subarray(p,p+3)]});originalComparisons++;}
 const magicFrames=[];for(let id=0;id<128;id++){
  const pointer=rom.readUInt16LE(0x1718+id*2),begin=16+(pointer&16383);check(begin>=0x1818&&begin<0x225e,'Magic frame pointer');let at=begin;const decoded=[];
  while(decoded.length<36){check(at<0x225e,'Magic frame bounds');const v=rom[at++],n=v&128?rom[at++]:1;check(n>0&&decoded.length+n<=36,'Magic frame run length');for(let j=0;j<n;j++)decoded.push(v);}
  check(at-begin<=36,'Original fixed magic frame copy');const c=battleCpu(rom);c.banks=[0x32,0x33,0x3e,0x3f];c.m[0x7cf6]=0x19;c.m[0x7300]=id;c.m[0x7e9a]=64;c.call(0xb7cf);
  const oam=Buffer.from(c.m.subarray(0x7924,0x79b4));for(let j=0;j<36;j++){const v=decoded[j],tile=(v&127)===127?0:0x49+(v&31);check(oam[j*4+1]===tile&&oam[j*4+2]===(((v<<1)&192)|3),'Original magic frame decode '+id);}
  const rects=Array.from({length:36},(_,j)=>({x:oam[j*4+3],y:oam[j*4],h:8,tile:oam[j*4+1]})).filter(r=>r.tile);magicFrames.push({id,begin,bytes:at-begin,nonzeroTiles:rects.length,peak:spriteBudget(rects).peak,oam:[...oam]});originalComparisons++;
 }
 const magicScripts=[];for(let id=0;id<91;id++){
  const ptr=rom.readUInt16LE(0xcc10+id*2),begin=pairOffset(3,ptr),length=rom[begin];check(begin>=0xccc6&&begin+1+length<=0xce30,'Magic script boundary');const frames=[];
  for(let n=1;n<=length;n++){let v=rom[begin+n];if(v===255){check(++n<=length,'Magic vertical flip operand');v=rom[begin+n];}frames.push(v&127);}
  const c=battleCpu(rom);c.banks=[0x32,0x33,0x3e,0x3f];c.m[0x7cf6]=0x19;c.m[0x7e88]=id;segment(c,0xb696,0xb6ca);check(Buffer.from(c.m.subarray(0x7300,0x7400)).equals(rom.subarray(begin,begin+256)),'Original magic script 256-byte load');originalComparisons++;
  magicScripts.push({id,begin,length,frames,maxNonzeroFrameTiles:Math.max(0,...frames.map(f=>magicFrames[f].nonzeroTiles))});
 }
 return {formations,graphics,misc,weapons,magic,magicFrames,magicScripts,originalComparisons,layouts};
}
export function npcQuads(assets,state,world,phase=0){
 const g=assets.groups,a=state.part1,b=state.part2,out=[];
 for(let slot=0;slot<12;slot++){const k=slot*16;if(!a[k])continue;const pose=a.readUInt16LE(k+14)-0xb41a+b[k+5]+phase*8,gfx=g.npcSelection[0][a[k+10]+(world>=2?256:0)];
  const quads=[];for(let q=0;q<4;q++){const j=[0,2,1,3][q]*2,attr=g.npcPoses[0][pose+j+1]^((b[k+1]&(q<2?0x14:0x24))?0x20:0);quads.push({x:a[k+4]*16+(q&1)*8,y:a[k+5]*16-3+(q>=2?8:0),h:8,attr,tile:g.npcPoses[0][pose+j],gfx,slot,npc:a[k+10]});}
  out.push(quads);
 }return out;
}
export function spriteBudget(rects,x=0,y=0){const visible=rects.filter(r=>r.x-x>-8&&r.x-x<160&&r.y-y>-r.h&&r.y-y<144),lines=new Uint8Array(144);for(const r of visible)for(let yy=Math.max(0,r.y-y);yy<Math.min(144,r.y-y+r.h);yy++)lines[yy]++;return {entries:visible.length,peak:Math.max(...lines),totalOverflow:visible.length>40,lineOverflow:Math.max(...lines)>10};}
// Global 8x16 mode: unlike attributes require TWO masked 8x16 objects.
// A mixed 8x8/8x16 list is not hardware-supported. This is a conservative candidate.
export function tallCandidate(groups){const out=[];let splitColumns=0;
 for(const q of groups)for(let col=0;col<2;col++){const a=q[col],b=q[col+2];if(a.attr===b.attr)out.push({...a,h:16});else{out.push({...a,h:16},{...b,y:a.y,h:16});splitColumns++;}}
 return {rects:out,splitColumns};
}
export function denseCases(rom,assets){
 const cases=[];for(const [world,map,x,y]of [[1,86,12,0],[1,87,12,0],[2,86,12,0],[2,87,12,0],[0,139,0,42]])for(const flags of [0,2]){
  const switches=flags===2?Buffer.alloc(64,255):Buffer.from(rom.subarray(0x1610,0x1650)),state=sourceObjects(rom,assets,world,map,switches),groups=npcQuads(assets,state,world),tall=tallCandidate(groups),property=mapSelection(world,map).property;
  const ids=[...new Set(groups.map(q=>q[0].npc))];const references=[];
  for(let event=0;event<254;event++){const e=decodeEvent(rom,rom.readUInt16LE(0x58610+event*2));const hits=e.commands.filter(c=>[0xf4,0xf5].includes(c.op)&&ids.includes(c.operand));if(hits.length)references.push({event,hits,world:'F4/F5 use current world, not established by this lexical reference'});}
  const selectors=ids.filter(id=>id<224).map(id=>({npc:id,...conditional(rom,rom.readUInt16LE(0x58210+((world?256:0)+id)*2))}));
  cases.push({world,map,x,y,flags,placement:assets.groups.properties[property][4],ids,objects:groups.length,before:spriteBudget(groups.flat(),x*8,y*8),tall:spriteBudget(tall.rects,x*8,y*8),splitColumns:tall.splitColumns,references,selectors,state,groups});
 }return cases;
}
// Exact RGB555 nearest-center sample: deliberately no palette quantization.
// Normal 7/8 extension is a candidate, only 32x32->28x28 and 96x64 boss samples
// were visually approved earlier. Tile counts assume tile-aligned image anchors.
export function scaledColorInventory(rom,battle){
 const graphics=new Map(battle.graphics.map(g=>[g.id,g])),seen=new Set(),cases=[];
 for(const f of battle.formations)for(const slot of f.slots){const g=graphics.get(slot.id);if(!slot.max||!g||g.unresolved)continue;const key=slot.id+':'+f.palettes.join(',');if(seen.has(key))continue;seen.add(key);
  const colors=f.palettes.map(id=>{const p=cgbPalette([15,...rom.subarray(0x5cc10+id*3,0x5cc13+id*3)]);return Array.from({length:4},(_,i)=>p.readUInt16LE(i*2));});
  const sw=g.w*8,sh=g.h*8,w=g.type>=6?96:sw*7/8,h=g.type>=6?64:sh*7/8,pw=Math.ceil(w/8)*8,ph=Math.ceil(h/8)*8;
  const pixels=new Uint16Array(pw*ph);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.min(sw-1,Math.floor((x+.5)*sw/w)),sy=Math.min(sh-1,Math.floor((y+.5)*sh/h)),t=(sy>>3)*g.w+(sx>>3),v=g.tiles[t][(sy&7)*8+(sx&7)];pixels[y*pw+x]=v?colors[g.attrs[t]][v]:0;}
  let overColorTiles=0,maxColors=0;const tileColors=[];for(let y=0;y<ph;y+=8)for(let x=0;x<pw;x+=8){const set=new Set();for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)set.add(pixels[(y+yy)*pw+x+xx]);maxColors=Math.max(maxColors,set.size);overColorTiles+=+(set.size>4);tileColors.push([...set].sort((a,b)=>a-b));}
  cases.push({monster:slot.id,palettes:f.palettes,exampleFormation:f.id,source:[sw,sh],candidate:[w,h],tileCells:pw*ph/64,maxColors,overColorTiles,tileColors});
 }
 return {cases,summary:{imagePalettePairs:cases.length,pairsOverFourColors:cases.filter(c=>c.overColorTiles).length,maxColors:Math.max(...cases.map(c=>c.maxColors)),overColorTiles:cases.reduce((n,c)=>n+c.overColorTiles,0)},scope:'RGB555 source colors retained, no quantization; per-image feasibility only, placement/8-palette coexistence not established'};
}
