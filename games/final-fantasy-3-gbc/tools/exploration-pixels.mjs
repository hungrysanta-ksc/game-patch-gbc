import {check} from './source.mjs';import {stateCpu} from './state-source.mjs';import {fieldAddresses} from './exploration-source.mjs';
// Player tile/attribute/animation decisions execute the NES renderer. Only the
// viewport anchor and the CGB tile/palette numbering change below.
export function fieldOam(rom,assets,f,part1,part2){
 const c=stateCpu(rom);fieldAddresses.forEach((a,i)=>c.m[a]=f[i]);c.y=0;c.call(0xd8d3);const sprites=[];
 const add=(x,y,t,a,p)=>{if(x<=-8||x>=160||y<=-8||y>=144)return;sprites.push(y+16,x+8,t,8+p+(a&1)+((a&64)?32:0)+((a&128)?64:0)+((a&32)?128:0));};
 for(let q=0;q<4;q++){const a=0x200+q*4;add(c.m[a+3]-40,c.m[a]+1-48,192+c.m[a+1],c.m[a+2],2);}
 const cameraX=((((f[0]+7)&63)*16+f[2])-72)&1023,cameraY=((((f[1]+7)&63)*16+f[3])-64)&1023;
 for(let slot=0;slot<12;slot++){const i=slot*16;if(!part1[i])continue;
  const x=((part1[i+4]*16+part1[i+6]-cameraX+512)&1023)-512,y=((part1[i+5]*16+part1[i+7]-cameraY+512)&1023)-515;
  if(x<=-16||x>=160||y<=-16||y>=144)continue;
  // Use original NPC object renderer AEAD with viewport-relative coordinates.
  const n=stateCpu(rom);n.banks=[0x3a,0x3b,0x3e,0x3f];let pose=part1.readUInt16LE(i+14);
  if(f[19]===2&&f[22]===i&&!(part1[i+1]&0x30))pose=f[4]&1?0xb42a:f[4]&2?0xb41a:f[4]&4?0xb44a:0xb43a;
  n.m[0x40]=80;n.m[0x41]=76;n.m[0x80]=pose&255;n.m[0x81]=pose>>8;n.m[0x82]=i;n.m[0x7105]=part2[i+5];n.m[0x7101]=part2[i+1];n.call(0xaead);
  for(let q=0;q<4;q++){const a=0x200+q*4;add(x+n.m[a+3]-80,y+n.m[a]-76,n.m[a+1],n.m[a+2],0);}
 }
 check(sprites.length<=160,'Original OAM budget');const oam=Buffer.alloc(160);Buffer.from(sprites).copy(oam);return {oam,cameraX,cameraY};
}
const rgb=value=>{const r=value&31,g=value>>5&31,b=value>>10&31;return [Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)];};
export function fieldPixels(rom,assets,report,s){
 const f=Buffer.from(s.field,'hex'),a=Buffer.from(s.part1,'hex'),b=Buffer.from(s.part2,'hex'),expected=fieldOam(rom,assets,f,a,b),g=assets.groups,p=g.properties[29],set=p[0]>>5,[layout,graphic]=g.selection[29],bgTiles=Buffer.concat([g.graphics[graphic],g.font[0]]),gfx=Buffer.alloc(3328),pal=Buffer.concat([g.npcPalette[29],Buffer.from(report.exploration.paletteBytes)]);
 check(s.oam===expected.oam.toString('hex'),'Original OAM composition '+s.label);check(Buffer.from(s.scroll,'hex').equals(Buffer.from([expected.cameraY&255,expected.cameraX&255])),'Camera latch '+s.label);
 for(let i=0;i<12;i++)if(a[i*16+10])g.npcGraphics[g.npcSelection[0][a[i*16+10]]].copy(gfx,i*256);g.npcGraphics[0].copy(gfx,3072);
 const out=Buffer.alloc(160*144*3),o=expected.oam;
 for(let y=0;y<144;y++)for(let x=0;x<160;x++){
  const wx=(expected.cameraX+x)&1023,wy=(expected.cameraY+y)&1023,m=(wx>=512||wy>=512)?p[3]:g.layout[layout][(wy>>4)*32+(wx>>4)],tile=g.metas[set][m*4+((wy>>3)&1)*2+((wx>>3)&1)],at=tile*16+(wy&7)*2,bit=7-(wx&7),bc=((bgTiles[at]>>bit)&1)|(((bgTiles[at+1]>>bit)&1)<<1);let value=g.palette[29].readUInt16LE((g.attributes[set][m]*4+bc)*2);
  for(let i=0;i<40;i++){const j=i*4,sx=o[j+1]-8,sy=o[j]-16,attr=o[j+3];if(x<sx||x>=sx+8||y<sy||y>=sy+8)continue;const px=attr&32?7-x+sx:x-sx,py=attr&64?7-y+sy:y-sy,t=o[j+2]*16+py*2,k=7-px,color=((gfx[t]>>k)&1)|(((gfx[t+1]>>k)&1)<<1);if(!color)continue;if(!(attr&128)||!bc)value=pal.readUInt16LE(((attr&7)*4+color)*2);break;}
  const color=rgb(value);for(let k=0;k<3;k++)out[(y*160+x)*3+k]=color[k];
 }
 return out;
}
