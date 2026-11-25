// Spatial resource compiler: one immutable 448-pixel-wide enemy plane, not
// observed frames or a table indexed by the entry animation's frame number.
import {check,hash} from './source.mjs';
import {compilePixelComposition} from './npc-composition.mjs';
import {scenePixels} from './battle-scene-pixels.mjs';
import {nativePartyTiles,v6PartyOam} from './battle-party-oam-source.mjs';
export function residentScroll(state){
 const scroll=state[29],page=state[32]&1;
 check(!(scroll&15),'Unsupported enemy scroll granularity');
 return (scroll*7/8+page*224)%448;
}
export function residentEnemy(p){
 const b=p.initialPpu,pal=p.bgPalette,patterns=[Buffer.alloc(16)],ids=new Map([[Buffer.alloc(16).toString('hex'),0]]),maps=Buffer.alloc(56*11*2),objects=[];
 const palettes=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>pal.readUInt16LE(i*8+j*2)));
 function pixel(x,y){x=(x%512+512)%512;const base=0x2000+(x>>8)*1024; x&=255;
  const tx=x>>3,ty=y>>3,t=b[base+ty*32+tx],a=b[base+960+(ty>>2)*8+(tx>>2)],pl=(a>>(((ty&2)<<1)+(tx&2)))&3,bit=7-(x&7),at=t*16+(y&7),v=(b[at]>>bit&1)|((b[at+8]>>bit&1)<<1);
  return pal.readUInt16LE((v?pl*4+v:0)*2);
 }
 const words=Uint16Array.from({length:448*88},(_,i)=>{const x=i%448,y=i/448|0;
  return y<84?pixel(p.back?239-Math.floor((167-x+.5)*8/7):16+Math.floor((x+8+.5)*8/7),48+Math.floor((y+.5)*8/7)):0;
 });
 function id(tile){const key=tile.toString('hex');if(!ids.has(key)){check(patterns.length<256,'Resident bank-1 tile capacity');ids.set(key,patterns.length);patterns.push(tile);}return ids.get(key);}
 for(let y=0;y<11;y++)for(let x=0;x<56;x++){
  const tile=Uint16Array.from({length:64},(_,i)=>words[(y*8+(i>>3))*448+x*8+(i&7)]),c=compilePixelComposition(tile,pal,{width:8,height:8,palettes});
  const at=y*56+x;maps[at]=id(c.background);maps[616+at]=8+c.attributes[0];
  for(const o of c.sprites)objects.push({x:x*8,y:16+y*8,tile:id(c.objGraphics.subarray(o.tile*16,o.tile*16+16)),attr:12+o.palette});
 }
 const residual=Buffer.concat(objects.map(o=>Buffer.from([o.x&255,o.x>>8,o.y,o.tile,o.attr])));
 // Dynamic terrain occupies 0600..06ff. Enemy patterns and maps must stay
 // resident across this prefix; a new owner must explicitly invalidate it.
 for(const f of p.frames){check(f.ppu.subarray(0x700,0x1000).equals(b.subarray(0x700,0x1000))&&f.ppu.subarray(0x2000,0x2800).equals(b.subarray(0x2000,0x2800)),'Enemy resource changed during resident lifetime');}
 return {patterns:Buffer.concat(patterns),maps,residual,objects,words,palette:pal,stats:{tiles:patterns.length,residualTiles:objects.length,assetBytes:patterns.length*16+maps.length+residual.length+pal.length,sourceSha256:hash(b.subarray(0x700,0x1000))}};
}
export function residentMap(a,scroll){const out=Buffer.alloc(704),coarse=scroll>>3;
 for(let y=0;y<11;y++)for(let i=0;i<21;i++){const from=y*56+(coarse+i)%56,to=y*32+((coarse+i)&31);out[to]=a.maps[from];out[352+to]=a.maps[616+from];}return out;
}
export function residentOam(p,f,a){const out=Buffer.alloc(160),party=v6PartyOam(f.original,p.back);party.copy(out);let n=24;const scroll=residentScroll(f.state);
 if(f===p.frames[0])return out; // Source palette is still black at the first wait.
 for(const o of a.objects){let x=(o.x-scroll+448)%448;if(x>440)x-=448;if(x<=-8||x>=160)continue;check(n<40,'Resident native OBJ total');out.set([o.y+16,x+8,o.tile,o.attr],n++*4);}
 for(let y=0;y<144;y++)check(Array.from({length:40},(_,i)=>y>=out[i*4]-16&&y<out[i*4]-8).filter(Boolean).length<=10,'Resident native scanline budget');return out;
}
const rgb=v=>{const r=v&31,g=(v>>5)&31,b=v>>10;return [Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)];};
export function residentRgb(p,f,a,terrainPixel){const map=residentMap(a,residentScroll(f.state)),oam=residentOam(p,f,a),tiles=nativePartyTiles(p.chr),out=Buffer.alloc(160*144*3),scroll=residentScroll(f.state)&255;
 for(let y=0;y<144;y++)for(let x=0;x<160;x++){
  let color=0;if(f!==p.frames[0]&&y>=16&&y<104){const px=(x+scroll)&255,at=((y-16)>>3)*32+(px>>3),t=map[at]*16+(y&7)*2,bit=7-(px&7),v=(a.patterns[t]>>bit&1)|((a.patterns[t+1]>>bit&1)<<1);color=a.palette.readUInt16LE(((map[352+at]&7)*4+v)*2);}
  if(terrainPixel&&y<11)color=terrainPixel(x,y);
  for(let i=0;i<40;i++){const at=i*4,sx=oam[at+1]-8,sy=oam[at]-16,attr=oam[at+3];if(x<sx||x>=sx+8||y<sy||y>=sy+8)continue;const xx=attr&32?7-(x-sx):x-sx,yy=attr&64?7-(y-sy):y-sy,t=oam[at+2]*16+yy*2,bits=attr&8?a.patterns:tiles,v=(bits[t]>>(7-xx)&1)|((bits[t+1]>>(7-xx)&1)<<1);if(v){const palette=attr&8?a.palette:p.pal;color=palette.readUInt16LE((((attr&7)%4)*4+v)*2);break;}}
  out.set(rgb(color),(y*160+x)*3);
 }return out;
}
export function originalResidentRgb(p,f,terrainHeight=0){const c={m:new Uint8Array(65536)};c.m.fill(0xf0,0x200,0x300);c.m.set(f.original,0x2a0);c.m[15]=f.state[29];c.m[7]=f.state[32];
 const words=scenePixels(c,{bytes:f.ppu},{back:p.back,layout:{shift:8},partyY:[10,34,58,82],terrainHeight}).pixels,out=Buffer.alloc(160*144*3);
 for(let y=0;y<144;y++)for(let x=0;x<160;x++)out.set(rgb(words[y*168+x]),(y*160+x)*3);return out;
}
