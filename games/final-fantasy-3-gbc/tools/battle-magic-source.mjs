import {initializedBattle} from './battle-transition-source.mjs';
import {animationAssets} from './battle-animation-source.mjs';
import {cgbPalette} from './field-source.mjs';
import {check} from './source.mjs';
export function magicSource(rom,{profile,spell,mask}){
 const {m}=initializedBattle(rom,{formation:3,rows:[0,1,0,1],terrain:0,back:profile>=2,partyStatus:profile&1?[2,4,16,1]:[0,0,0,0]}),c=m.c;
 m.call(0xb469);m.call(0xb304);m.call(0xafd8);
 c.m[0x7e88]=spell;c.m[0x7e9d]=0;c.m[0x7e9a]=128;c.m[0x7e99]=c.m[0x7e9b]=mask;c.m[0x52]=0;c.m[0x7eb8]=0;c.m[0xc9]=0;c.m[0xca]=animationAssets(rom).tables.sounds[spell];
 const frames=[],sounds=[],step=c.step.bind(c),write=c.write.bind(c);
 c.write=function(a,v){if(a===0x7f49)sounds.push(v);write(a,v);};
 c.step=function(){
  // presentationMachine intercepts NMI waits. Execute the actual pending-sound
  // fragment there with interrupt-preserved registers; audio VM is a separate oracle.
  if(this.pc===0xfb80){const saved=[this.a,this.x,this.y,this.p,this.pc];this.pc=0xfaf6;while(this.pc!==0xfb05)step();[this.a,this.x,this.y,this.p,this.pc]=saved;}
  if(this.banks[1]===0x33&&[0xac40,0xb7ad,0xb70e,0xbb12].includes(this.pc))frames.push({pc:this.pc,target:this.m[0x90],props:this.m[0x7e8b],x:this.m[0xc0+this.m[0x90]],y:this.m[0xc4+this.m[0x90]],raw:Buffer.from(this.m.subarray(0x200,0x2a0)),chr:Buffer.from(m.ppu.bytes.subarray(0x1000,0x2000)),palette:cgbPalette(m.ppu.bytes.subarray(0x3f1c,0x3f20))});step();};
 m.call(0xb15e);check(frames.length&&frames[0].pc===0xac40&&frames.at(-1).pc===0xbb12,'Original ordinary magic owner boundaries');
 return {frames,sounds,scope:'Complete enemy ordinary B15E execution; explicit animation waits selected separately from loader/NMI transfer waits. No reflection or special body.'};
}
export function magicSourcePixels(frame,base,back){
 const rgb=Buffer.from(base);if(frame.pc!==0xb7ad)return rgb;
 const o=frame.raw,dx0=back?-16:-80,dy0=-33-frame.target*4;
 const rawx=i=>(back?(o[i+3]>=128?o[i+3]-256:o[i+3]):o[i+3]);
 const left=Math.min(...Array.from({length:36},(_,i)=>rawx(i*4)+dx0)),top=frame.y-12-(frame.props&32?12:0)+dy0;
 const dx=dx0+Math.max(0,-left)-Math.max(0,left-112),dy=dy0+Math.max(0,-top)-Math.max(0,top-96);
 for(let i=140;i>=0;i-=4){const t=o[i+1],a=o[i+2];if(!t)continue;const x=rawx(i)+dx,y=o[i]+dy;
  check(x>=0&&x+8<=160&&y>=0&&y+8<=144,'Whole original magic dot bounds');
  for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++){const sy=a&128?7-yy:yy,bit=a&64?xx:7-xx,v=((frame.chr[t*16+sy]>>bit)&1)|(((frame.chr[t*16+8+sy]>>bit)&1)<<1);if(!v)continue;
   const c=frame.palette.readUInt16LE(v*2),r=c&31,g=c>>5&31,b=c>>10;rgb.set([Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)],((y+yy)*160+x+xx)*3);
  }
 }return rgb;
}
