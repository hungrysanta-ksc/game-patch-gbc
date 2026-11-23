import {deflateSync} from 'node:zlib';
import {check} from './source.mjs';
import {mapSelection} from './map-assets.mjs';
export function png(rgb,w=160,h=144){
 const crc=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
 const chunk=(name,b)=>{const t=Buffer.from(name),n=Buffer.alloc(4),z=Buffer.alloc(4);n.writeUInt32BE(b.length);z.writeUInt32BE(crc(Buffer.concat([t,b])));return Buffer.concat([n,t,b,z]);};
 const head=Buffer.alloc(13);head.writeUInt32BE(w);head.writeUInt32BE(h,4);head[8]=8;head[9]=2;const raw=Buffer.alloc(h*(w*3+1));for(let y=0;y<h;y++)rgb.copy(raw,y*(w*3+1)+1,y*w*3,(y+1)*w*3);
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',head),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
export function screenAssets(assets,r){
 const g=assets.groups,s=mapSelection(r.world,r.map),p=g.properties[s.property],[layout,graphic]=g.selection[s.selection],set=p[0]>>5,map=Buffer.alloc(360),attributes=Buffer.alloc(360);
 for(let y=0;y<18;y++)for(let x=0;x<20;x++){const wx=r.x+x,wy=r.y+y,m=g.layout[layout][(wy>>1)*32+(wx>>1)];map[y*20+x]=128+g.metas[set][m*4+(wy&1)*2+(wx&1)];attributes[y*20+x]=g.attributes[set][m]&3;}
 return {background:Buffer.concat([g.graphics[graphic],g.font[0]]),map,attributes,bgPalette:g.palette[s.property],objPalette:g.npcPalette[s.property]};
}
function quadPixels(g,q){const b=g.npcGraphics[q.gfx],pixels=new Uint8Array(64);for(let y=0;y<8;y++)for(let x=0;x<8;x++){const xx=q.attr&64?7-x:x,yy=q.attr&128?7-y:y,t=q.tile*16+yy*2;pixels[y*8+x]=((b[t]>>(7-xx))&1)|(((b[t+1]>>(7-xx))&1)<<1);}return pixels;}
export function tallScene(assets,r){
 const screen=screenAssets(assets,r),sprites=[],original=[];
 for(const q of r.groups){for(const a of q)original.push({x:a.x-r.x*8,y:a.y-r.y*8,h:8,palette:a.attr&1,behind:!!(a.attr&32),pixels:quadPixels(assets.groups,a)});
  for(let col=0;col<2;col++){const a=q[col],b=q[col+2],parts=a.attr===b.attr?[[a,b]]:[[a,null],[null,b]];
   for(const [top,bottom]of parts){const pixels=new Uint8Array(128);if(top)pixels.set(quadPixels(assets.groups,top));if(bottom)pixels.set(quadPixels(assets.groups,bottom),64);const owner=top||bottom;
    const s={x:a.x-r.x*8,y:a.y-r.y*8,h:16,palette:owner.attr&1,behind:!!(owner.attr&32),pixels};if(s.x>-8&&s.x<160&&s.y>-16&&s.y<144)sprites.push(s);
   }
  }
 }
 check(sprites.length<=40,'Probe OAM capacity');const objGraphics=Buffer.alloc(sprites.length*32),oam=Buffer.alloc(160);
 for(const [i,s]of sprites.entries()){for(let y=0;y<16;y++)for(let x=0;x<8;x++){const v=s.pixels[y*8+x];objGraphics[i*32+y*2]|=(v&1)<<(7-x);objGraphics[i*32+y*2+1]|=(v>>1)<<(7-x);}oam.set([s.y+16,s.x+8,i*2,8+s.palette+(s.behind?128:0)],i*4);}
 return {...screen,sprites,original,objGraphics,oam};
}
const rgb=v=>{const r=v&31,g=(v>>5)&31,b=(v>>10)&31;return [Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)];};
export function renderScene(s,{hardware=true,original=false}={}){
 const out=Buffer.alloc(160*144*3),sprites=original?s.original:s.sprites;
 for(let y=0;y<144;y++){let selected=sprites.filter(o=>y>=o.y&&y<o.y+o.h);if(hardware)selected=selected.slice(0,10);
  for(let x=0;x<160;x++){const at=(y>>3)*20+(x>>3),tile=s.map[at]-128,j=tile*16+(y&7)*2,bit=7-(x&7),index=((s.background[j]>>bit)&1)|(((s.background[j+1]>>bit)&1)<<1);let color=s.bgPalette.readUInt16LE((s.attributes[at]*4+index)*2);
   for(const o of selected){if(x<o.x||x>=o.x+8)continue;const n=o.pixels[(y-o.y)*8+x-o.x];if(!n)continue;if(!o.behind||!index)color=s.objPalette.readUInt16LE((o.palette*4+n)*2);break;}
   out.set(rgb(color),(y*160+x)*3);
  }
 }return out;
}
