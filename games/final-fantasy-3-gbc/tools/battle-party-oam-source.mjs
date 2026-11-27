import {check,hash} from './source.mjs';
import {offset} from './render-budget-source.mjs';
import {initializedBattle} from './battle-transition-source.mjs';
import {entryState} from './battle-entry-source.mjs';
import {segment} from './state-source.mjs';
import {cgbPalette} from './field-source.mjs';
import {scenePixels} from './battle-scene-pixels.mjs';
export function partyOamTables(rom){
 const tables=[['shapes',0x91d7,144,15114],['ids',0x926b,42,15164],['offsets',0x9295,4,15173],['tiles',0x972e,126,15645]].map(([name,cpu,size,line])=>{const begin=offset(0x32,cpu),bytes=rom.subarray(begin,begin+size);check(bytes.length===size,'Party OAM table bounds');return {name,bank:0x32,cpu,size,begin,bytes,sha256:hash(bytes),consumer:'32/9111..91CA',asmRef:'ff3j.asm:'+line};});
 const ptr=offset(0x32,0x91cb);for(let i=0;i<6;i++)check(rom.readUInt16LE(ptr+i*2)===0x91d7+i*24,'Party shape pointer roundtrip');
 check(tables[1].bytes.every(v=>v<6),'Party shape IDs');
 return {tables,header:'#include <stdint.h>\n'+tables.map(t=>'static const uint8_t ff3_po_'+t.name+'[]={'+[...t.bytes]+'};').join('\n')+'\n'};
}
export const partyOamInput=c=>Buffer.from([...c.m.subarray(0xc0,0xc8),...c.m.subarray(0x7d83,0x7d87),...c.m.subarray(0x7d93,0x7d97),...c.m.subarray(0x7d97,0x7d9b),...c.m.subarray(0x7e22,0x7e26),c.m[0x78c3],c.m[0x98]]);
export function runPartyOam(c,input){
 check(input.length===26,'Party input ABI');c.m.set(input.subarray(0,8),0xc0);c.m.set(input.subarray(8,12),0x7d83);c.m.set(input.subarray(12,16),0x7d93);c.m.set(input.subarray(16,20),0x7d97);c.m.set(input.subarray(20,24),0x7e22);c.m[0x78c3]=input[24];c.m[0x98]=input[25];
 c.banks=[0x32,0x33,0x3e,0x3f];c.m[0x7cf6]=0x19;c.call(0x90d8);return Buffer.from(c.m.subarray(0x2a0,0x300));
}
export function v6PartyOam(source,back){const out=Buffer.alloc(96),srcY=[44,72,100,128],dstY=[10,34,58,82];
 for(let i=0;i<24;i++){const [sy,t,a,sx]=source.subarray(i*4,i*4+4),slot=Math.floor(i/6),x=sx-(back?16:80),y=sy+1-srcY[slot]+dstY[slot];check(sy>=239||!(a&0x3c),'Unsupported source party attributes');out.set([sy>=239||x<=-8||x>=160||y<=-8||y>=144?0:y+16,(x+8)&255,t,(a&3)|((a&64)>>1)|((a&128)>>1)],i*4);}return out;
}
export function partyOamCases(rom){
 const {m}=initializedBattle(rom,{formation:3,back:false,rows:[0,1,0,1],terrain:0}),seed=partyOamInput(m.c),rows=[];
 for(const back of [false,true])for(const mirror of [0,1])for(const flip of [0,128])for(let p=0;p<21;p++)for(const hidden of [0,1]){
  const input=Buffer.from(seed);input[24]=back?0x88:0;input[25]=mirror;
  for(let i=0;i<4;i++){input[i]=[0,176,208,248][(p+i)%4];input[i+4]=[44,72,100,128][i];input[i+8]=((p+i)%21)|flip;input[i+12]=i%3;input[i+16]=(p&1)?3:0;input[i+20]=hidden&&i===(p%4)?1:0;}
  const original=runPartyOam(m.c,input);rows.push({input,original,native:v6PartyOam(original,back)});
 }
 // All byte coordinates in each facing mode anchor the unsigned V6 clipping
 // optimization against the independent signed-coordinate oracle.
 for(const back of [false,true])for(let n=0;n<256;n++){
  const input=Buffer.from(seed);input[24]=back?0x88:0;input[25]=0;
  for(let i=0;i<4;i++){input[i]=(n+i*64)&255;input[i+4]=(n+i*37)&255;input[i+8]=2;}
  const original=runPartyOam(m.c,input);rows.push({input,original,native:v6PartyOam(original,back)});
 }return rows;
}
// This is an oracle, not runtime frame data. The video runs the C entry
// state machine; these observations remain in private verification files.
export function partyEntryOracle(rom,{back=false,partyStatus=[0,0,0,0],cache,normalized,second,formation=3,counts,terrain=0}={}){
 const frames=[];let seed;
 const {m}=initializedBattle(rom,{formation,counts,back,rows:[0,1,0,1],terrain,partyStatus,capture:(b,c,p)=>{if(b.reason==='before-NMI-wait')frames.push({input:partyOamInput(c),original:Buffer.from(c.m.subarray(0x2a0,0x300)),state:entryState(c),palette:cgbPalette(p.bytes.subarray(0x3f10,0x3f20)),rawPalette:Buffer.from(p.bytes.subarray(0x3f10,0x3f20)),ppu:Buffer.from(p.bytes),chrSha256:hash(p.bytes.subarray(0x1000,0x2000))});}});
 // 9D88 first clears the physical palette, then fills 7CF7..7D16. AD53
 // publishes that buffer before visible party OBJ. The initial physical
 // palette is black and cannot be used as the resident display palette.
 const c=m.c;if(normalized)for(let i=0;i<4;i++){c.m[0x7d9b+i*2]=normalized[i];c.m[0x7d9c+i*2]=second?.[i]??0;}if(cache)c.m.set(cache,0x7da3);seed=Buffer.concat([entryState(c),Buffer.alloc(4)]);const initial=partyOamInput(c),chr=Buffer.from(m.ppu.bytes.subarray(0x1000,0x2000)),pal=cgbPalette(c.m.subarray(0x7d07,0x7d17));
 const initialPpu=Buffer.from(m.ppu.bytes),bgPalette=cgbPalette(c.m.subarray(0x7cf7,0x7d07));
 m.begin();segment(c,0xb469,0xb479);
 const terrainSource=Buffer.from(c.m.subarray(0x7900,0x7a00));
 check(pal.some(Boolean)&&frames.slice(2).every(f=>f.palette.equals(pal)),'Original visible party palette publication');
 check(frames.every(f=>f.chrSha256===hash(chr)),'Original prefix keeps resident OBJ patterns');
 return {back,formation,counts,terrain,partyStatus,seed,initial,chr,pal,initialPpu,bgPalette,terrainSource,frames};
}
export function nativePartyTiles(chr){const out=Buffer.alloc(chr.length);for(let t=0;t<chr.length;t+=16)for(let y=0;y<8;y++){out[t+y*2]=chr[t+y];out[t+y*2+1]=chr[t+y+8];}return out;}
export function originalPartyRgb(p,f){
 const c={m:new Uint8Array(65536)},ppu={bytes:Buffer.alloc(16384)};c.m.fill(0xf0,0x200,0x300);c.m.set(f.original,0x2a0);p.chr.copy(ppu.bytes,0x1000);ppu.bytes[0x3f00]=15;f.rawPalette.copy(ppu.bytes,0x3f10);
 // Existing NES-bitplane V6 oracle, independent of nativePartyTiles,
 // native OAM conversion and GB sprite decoding in partyRgb.
 const words=scenePixels(c,ppu,{back:p.back,partyY:[10,34,58,82],terrainHeight:11}).pixels,out=Buffer.alloc(160*144*3);
 for(let y=0;y<144;y++)for(let x=0;x<160;x++){const v=words[y*168+x],r=v&31,g=(v>>5)&31,b=v>>10;out.set([Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)],(y*160+x)*3);}return out;
}
export function partyRgb(oam,tiles,pal){const out=Buffer.alloc(160*144*3),used=new Uint8Array(160*144);let pixels=0,peak=0;
 for(let y=0;y<144;y++){let count=0;for(let i=0;i<24;i++){const a=i*4;if(y>=oam[a]-16&&y<oam[a]-8)count++;}peak=Math.max(peak,count);}
 for(let i=0;i<24;i++){const a=i*4,sx=oam[a+1]-8,sy=oam[a]-16,t=oam[a+2]*16,attr=oam[a+3];for(let y=0;y<8;y++)for(let x=0;x<8;x++){const px=attr&32?7-x:x,py=attr&64?7-y:y,v=(tiles[t+py*2]>>(7-px)&1)|((tiles[t+py*2+1]>>(7-px)&1)<<1),dx=sx+x,dy=sy+y;if(!v||dx<0||dx>=160||dy<0||dy>=144)continue;const at=dy*160+dx;if(used[at])continue;used[at]=1;pixels++;const color=pal.readUInt16LE(((attr&7)*4+v)*2),r=color&31,g=(color>>5)&31,b=color>>10;out.set([Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)],at*3);}}
 check(peak<=10,'Native party scanline budget');return {rgb:out,pixels,peak};
}
