import {mapSelection} from './map-assets.mjs';
import {sourceObjects} from './object-assets.mjs';
import {mapRgb} from './map-pixels.mjs';

export function objectReference(rom,assets,r){
 const switches=Buffer.from(rom.subarray(0x1610,0x1650));if(r.flags===1)switches.fill(0);if(r.flags===2)switches.fill(255);
 const state=sourceObjects(rom,assets,r.world,r.map,switches),{part1:a,part2:b}=state,g=assets.groups;
 const s=mapSelection(r.world,r.map),props=g.properties[s.property],oam=[],graphics=Buffer.alloc(3072);
 for(let slot=0;slot<12;slot++){
  const at=slot*16;if(!a[at+10])continue;
  const graphic=g.npcSelection[0][a[at+10]+(r.world>=2?256:0)];g.npcGraphics[graphic].copy(graphics,slot*256);
  if(!a[at])continue;
  const px=a[at+4]*16-r.x*8,py=a[at+5]*16-r.y*8-3,pose=a.readUInt16LE(at+14)-0xb41a+b[at+5]+r.phase*8;
  for(let q=0;q<4;q++){
   const x=px+(q&1)*8,y=py+(q>=2?8:0);if(x<=-8||x>=160||y<=-8||y>=144)continue;
   const j=[0,2,1,3][q]*2,attr=g.npcPoses[0][pose+j+1]^((b[at+1]&(q<2?0x14:0x24))?0x20:0);
   oam.push([y+16,x+8,slot*16+g.npcPoses[0][pose+j],8+(attr&1)+((attr&64)?32:0)+((attr&128)?64:0)+((attr&32)?128:0)]);
  }
 }
 let peak=0;for(let y=0;y<144;y++)peak=Math.max(peak,oam.filter(o=>y>=o[0]-16&&y<o[0]-8).length);
 const error=oam.length>40?12:peak>10?13:0,packed=Buffer.alloc(160);
 if(!error)Buffer.from(oam.flat()).copy(packed);
 return {...state,switches,graphics,oam:packed,count:(g.placements[props[4]].length-1)/4,entries:oam.length,peak,error,palette:g.npcPalette[s.property]};
}
// Pixel oracle consumes original loader output, source patterns and pose table.
// It never reads expected pixels from the GBC's VRAM or screenshots.
export function objectRgb(assets,r,expected){
 const bg=mapRgb(assets,{world:r.world,id:r.map,x:r.x,y:r.y}),out=Buffer.from(bg);
 if(expected.error)return out;
 const g=assets.groups,s=mapSelection(r.world,r.map),p=g.properties[s.property],[layout,graphic]=g.selection[s.selection],set=p[0]>>5,bgTiles=Buffer.concat([g.graphics[graphic],g.font[0]]);
 for(let y=0;y<144;y++)for(let x=0;x<160;x++){
  for(let i=0;i<expected.entries;i++){
   const at=i*4,o=expected.oam,ox=o[at+1]-8,oy=o[at]-16,attr=o[at+3];
   if(x<ox||x>=ox+8||y<oy||y>=oy+8)continue;
   const dx=attr&32?7-(x-ox):x-ox,dy=attr&64?7-(y-oy):y-oy,t=o[at+2]*16+dy*2,bit=7-dx;
   const color=((expected.graphics[t]>>bit)&1)|(((expected.graphics[t+1]>>bit)&1)<<1);if(!color)continue;
   const wx=r.x+(x>>3),wy=r.y+(y>>3),m=g.layout[layout][(wy>>1)*32+(wx>>1)],bt=g.metas[set][m*4+(wy&1)*2+(wx&1)]*16+(y&7)*2,bb=7-(x&7),bgColor=((bgTiles[bt]>>bb)&1)|(((bgTiles[bt+1]>>bb)&1)<<1);
   if(!(attr&128)||!bgColor){
    const v=expected.palette.readUInt16LE(((attr&1)*4+color)*2),red=v&31,green=(v>>5)&31,blue=(v>>10)&31;
    out[(y*160+x)*3]=Math.min(240,(red*26+green*4+blue*2)>>2);out[(y*160+x)*3+1]=Math.min(240,(green*24+blue*8)>>2);out[(y*160+x)*3+2]=Math.min(240,(red*6+green*4+blue*22)>>2);
   }
   break; // OAM selection precedes BG priority, even when BG hides the winner.
  }
 }
 return out;
}
