// Read what the original battle renderer actually put on screen. This is an
// observation decoder, not a replacement battle/menu state machine.
import {check,hash} from './source.mjs';
import {offset} from './render-budget-source.mjs';
export function messageWindowDescriptors(rom){
 return Array.from({length:5},(_,id)=>{const at=offset(0x34,0x8e83+id*9),address=rom.readUInt16LE(at),width=rom[at+2]+2;
  check(address>=0x2000&&address<0x23c0&&width>=3&&width<=32,'Original message rectangle');
  return {id,address,x:(address&31)*8,y:((address&1023)>>5)*8,width:width*8,height:32,save:rom.readUInt16LE(at+3),restoreAddress:rom.readUInt16LE(at+5),source:{bank:0x34,cpu:0x8e83+id*9,offset:at,bytes:9}};
 });
}
export function unpackUiObservation(raw){const get=(name,n)=>{const b=Buffer.from(raw[name].hex,'hex');check(b.length===n,'Incomplete original '+name);return b;};return {ppu:get('ppu',16384),ram:get('ram',2048),oam:get('oam',256),sram:get('sram',8192)};}
export function originalMenuPixel(s,x,y,{objects=true}={}){
 const {ppu:p,ram,oam}=s,world=(x+ram[0x10])&511,base=0x2000+(world>>8)*1024,xx=world&255,tx=xx>>3,ty=y>>3;
 const tile=p[base+ty*32+tx],attr=p[base+960+(ty>>2)*8+(tx>>2)],pal=(attr>>(((ty&2)<<1)+(tx&2)))&3,at=0x1000+tile*16+(y&7),bit=7-(xx&7),v=(p[at]>>bit&1)|((p[at+8]>>bit&1)<<1);
 let color=p[0x3f00+(v?pal*4+v:0)]&63;
 if(objects)for(let i=0;i<64;i++){const sy=oam[i*4]+1,sx=oam[i*4+3],a=oam[i*4+2];if(x<sx||x>=sx+8||y<sy||y>=sy+8)continue;
  const px=a&64?7-(x-sx):x-sx,py=a&128?7-(y-sy):y-sy,k=0x1000+oam[i*4+1]*16+py,z=(p[k]>>(7-px)&1)|((p[k+8]>>(7-px)&1)<<1);if(!z)continue;if(!(a&32)||!v)color=p[0x3f10+(a&3)*4+z]&63;break;
 }return color;
}
export function observeBattleUi(s){
 const p=s.ppu,panels=[];
 for(let nt=0;nt<2;nt++)for(let y=19;y<29;y++)for(let x=0;x<32;x++)if(p[0x2000+nt*1024+y*32+x]===247){
  let right=x+1;while(right<32&&p[0x2000+nt*1024+y*32+right]===248)right++;
  let bottom=y+1;while(bottom<30&&p[0x2000+nt*1024+bottom*32+x]===250)bottom++;
  panels.push({nametable:nt,x:x*8,y:y*8,right:right*8+8,bottom:bottom*8+8,rightComplete:p[0x2000+nt*1024+y*32+right]===249,bottomComplete:p[0x2000+nt*1024+bottom*32+x]===252});
 }
 return {menuScroll:s.ram[0x10],menuRemaining:s.ram[4],panels,palette:[...p.subarray(0x3f0c,0x3f10)],chrSha256:hash(p.subarray(0x1000,0x2000)),mapsSha256:hash(p.subarray(0x2000,0x2800)),scope:'Observed PPU frames and border endpoints, including occluded/scrolling windows; not inferred from action scripts.'};
}
